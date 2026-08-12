import { Champion, Entity, GameState, Monster, PlayerInput, CastCommand, Team } from "./types";
import { CHAMPIONS } from "./champions";
import { RECOMMENDED, ITEMS } from "./items";
import { STRUCTURES, WORLD, LANES, LaneId, lanePathFor, pointAlong, progressAlong } from "./constants";
import { add, angleTo, dist, fromAngle, norm, sub, scale, clamp } from "./math";
import { applyInput, unspentPoints } from "./simulation";
import { enemyTeam, isChampion, slowMultiplier, structureVulnerable } from "./combat";

// Difficulty knobs (tuned up: sharper reactions, better aim, smarter aggression).
const DIFF = {
  casual: { react: 0.28, aggro: 0.85, skillAim: 0.66, retreatHp: 0.28, jungle: true, teamfight: 0.7 },
  normal: { react: 0.14, aggro: 1.05, skillAim: 0.86, retreatHp: 0.32, jungle: true, teamfight: 1.0 },
  savage: { react: 0.07, aggro: 1.3, skillAim: 0.97, retreatHp: 0.38, jungle: true, teamfight: 1.2 },
};

// Bot roles: one jungler per team; the rest fill top/mid/bot in order.
type BotRole = "top" | "mid" | "bot" | "jungle";
const ROLE_LANE: Record<BotRole, LaneId> = { top: "top", mid: "mid", bot: "bot", jungle: "mid" };

function botRole(state: GameState, c: Champion): BotRole {
  const cached = c.passiveData.roleIdx;
  const ROLES: BotRole[] = ["mid", "top", "bot", "jungle", "bot"];
  if (cached != null) return ROLES[cached] || "mid";
  // Assign by seniority within the team: mid first (safest lane), then top,
  // then bot, then a jungler when there are at least four allies.
  const teamMates: Champion[] = [];
  for (const id in state.champions) {
    const o = state.champions[id];
    if (o.team === c.team) teamMates.push(o);
  }
  teamMates.sort((a, b) => a.id - b.id);
  const idx = teamMates.findIndex((o) => o.id === c.id);
  const teamSize = teamMates.length;
  // Pattern: idx0=mid, idx1=top, idx2=bot, idx3=jungle, idx4=bot(support-ish).
  const role: BotRole = teamSize >= 4 && idx === 3 ? "jungle" : (ROLES[idx] || "mid");
  c.passiveData.roleIdx = ROLES.indexOf(role);
  return role;
}

export function updateBots(state: GameState, dt: number) {
  if (state.phase !== "playing") return;
  const diff = DIFF[state.config.difficulty] || DIFF.normal;
  for (const id in state.champions) {
    const c = state.champions[id];
    if (!c.isBot) continue;
    // Throttle decision-making by reaction time.
    c.passiveData.aiAcc = (c.passiveData.aiAcc || 0) + dt;
    if (c.alive) {
      // Always allow buy check + level; movement decisions throttled.
      autoLevelBot(c);
      if ((c.passiveData.aiAcc || 0) >= diff.react) {
        c.passiveData.aiAcc = 0;
        decideBot(state, c, diff);
        // Bots are AI shoppers — they equip gear as they earn it (no fountain trek).
        c.passiveData.shopAcc = (c.passiveData.shopAcc || 0) + 1;
        if ((c.passiveData.shopAcc || 0) >= 3) {
          c.passiveData.shopAcc = 0;
          autoBuy(state, c);
        }
      }
    } else {
      // Buy when dead (in fountain conceptually).
      c.inFountain = true;
      autoBuy(state, c);
    }
  }
}

function autoLevelBot(c: Champion) {
  // Points are auto-spent by the sim already; nothing extra needed.
}

function autoBuy(state: GameState, c: Champion) {
  if (c.items.length >= 6) return;
  const def = CHAMPIONS[c.championId];
  const rec = RECOMMENDED[def.role] || RECOMMENDED.Fighter;
  for (const itemId of rec) {
    if (c.items.includes(itemId)) continue;
    const it = ITEMS[itemId];
    if (!it) continue;
    if (c.gold >= it.cost) {
      // Bots equip in the field (AI convenience — the fountain check is for humans).
      const wasFountain = c.inFountain;
      c.inFountain = true;
      applyInput(state, c.ownerId, { seq: c.lastInputSeq + 1, buy: [itemId] });
      c.inFountain = wasFountain;
    }
    // Only attempt the first not-yet-owned recommended item.
    break;
  }
}

function nearestEnemyChamp(state: GameState, c: Champion, maxD = 1200): Champion | null {
  let best: Champion | null = null;
  let bd = maxD;
  for (const id in state.champions) {
    const e = state.champions[id];
    if (!e.alive || e.team === c.team) continue;
    if (e.buffs.some((b) => b.id === "stealth")) continue;
    const d = dist(c.pos, e.pos);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function lastHittable(state: GameState, c: Champion): Entity | null {
  // Prefer an enemy minion we can last-hit; else nearest enemy minion to push.
  let killable: Entity | null = null;
  let killD = Infinity;
  let nearest: Entity | null = null;
  let nearD = Infinity;
  const estDmg = c.attackDamage * (CHAMPIONS[c.championId].ranged ? 1 : 1);
  for (const id in state.minions) {
    const m = state.minions[id];
    if (!m.alive || m.team === c.team) continue;
    const d = dist(c.pos, m.pos);
    if (d < nearD) { nearD = d; nearest = m; }
    if (m.hp <= estDmg * 1.05 && d <= c.attackRange + 220 && d < killD) { killD = d; killable = m; }
  }
  return killable || nearest;
}

/** Which lane this bot is assigned to (from its role). */
function botLane(state: GameState, c: Champion): LaneId {
  return ROLE_LANE[botRole(state, c)];
}

/** Count teammates near a point (for grouping / teamfight logic). */
function alliesNear(state: GameState, c: Champion, p: { x: number; y: number }, r: number): number {
  let n = 0;
  for (const id in state.champions) {
    const o = state.champions[id];
    if (o.team !== c.team || o.id === c.id || !o.alive) continue;
    if (dist(o.pos, p) <= r) n++;
  }
  return n;
}

function enemiesNear(state: GameState, c: Champion, p: { x: number; y: number }, r: number): number {
  let n = 0;
  for (const id in state.champions) {
    const o = state.champions[id];
    if (o.team === c.team || !o.alive) continue;
    if (o.buffs.some((b) => b.id === "stealth")) continue;
    if (dist(o.pos, p) <= r) n++;
  }
  return n;
}

/** Find the epic objective (Barón or Draggón) worth taking, if any. */
function epicObjective(state: GameState, c: Champion): Monster | null {
  let best: Monster | null = null;
  let bd = Infinity;
  for (const id in state.monsters) {
    const mo = state.monsters[id];
    if (!mo.alive || !mo.epic) continue;
    const d = dist(c.pos, mo.pos);
    if (d < bd) { bd = d; best = mo; }
  }
  return best;
}

/** Any turret in the enemy's front line that we could actually damage. */
function nearestBreakableTurret(state: GameState, c: Champion) {
  let best = null as null | { x: number; y: number; id: number };
  let bd = Infinity;
  for (const id in state.turrets) {
    const t = state.turrets[id];
    if (!t.alive || t.team === c.team) continue;
    if (!structureVulnerable(state, t)) continue;
    const d = dist(c.pos, t.pos);
    if (d < bd) { bd = d; best = { x: t.pos.x, y: t.pos.y, id: t.id }; }
  }
  return best;
}

/** The furthest-forward point along the bot's lane its team has pushed to. */
function frontier(state: GameState, c: Champion): { x: number; y: number } {
  const lane = botLane(state, c);
  const path = lanePathFor(lane, c.team);
  let best = 0.06; // default: just outside our own base
  let found = false;
  for (const id in state.minions) {
    const m = state.minions[id];
    if (!m.alive || m.team !== c.team || m.lane !== lane) continue;
    const t = progressAlong(path, m.pos);
    if (t > best) { best = t; found = true; }
  }
  if (!found) best = 0.14;
  return pointAlong(path, best);
}

function decideBot(state: GameState, c: Champion, diff: typeof DIFF.normal) {
  const seq = c.lastInputSeq + 1;
  const input: PlayerInput = { seq, casts: [] };
  const def = CHAMPIONS[c.championId];
  const hpRatio = c.hp / c.maxHp;
  const manaRatio = c.mana / Math.max(1, c.maxMana);
  const enemy = nearestEnemyChamp(state, c, def.stats.attackRange + 700);
  const anyEnemyChamp = nearestEnemyChamp(state, c, 2200);
  const ownFountain = STRUCTURES[c.team].fountain;
  const role = botRole(state, c);

  // Recall if very low and safe.
  const nearEnemy = enemy && dist(c.pos, enemy.pos) < 700;
  if (hpRatio < 0.25 && !nearEnemy) {
    if (dist(c.pos, ownFountain) < 1400 && !anyEnemyClose(state, c, 900)) {
      input.recall = true;
      applyInput(state, c.ownerId, input);
      return;
    }
    input.move = retreatPoint(c);
    applyInput(state, c.ownerId, input);
    return;
  }

  // Retreat when low and enemies threaten.
  if (hpRatio < diff.retreatHp && nearEnemy) {
    input.move = retreatPoint(c);
    castEscape(state, c, input, enemy!);
    applyInput(state, c.ownerId, input);
    return;
  }

  const aliveAllies = countAliveChamps(state, c.team);
  const aliveEnemies = countAliveChamps(state, enemyTeam(c.team));
  const siegeWindow = aliveEnemies === 0 || (aliveAllies - aliveEnemies >= 1 && hpRatio > 0.5);

  // Teamfight logic: if a group is fighting nearby, jump in intelligently.
  if (enemy) {
    const midpoint = { x: (c.pos.x + enemy.pos.x) / 2, y: (c.pos.y + enemy.pos.y) / 2 };
    const alliesHere = alliesNear(state, c, midpoint, 900);
    const enemiesHere = enemiesNear(state, c, midpoint, 900);
    const d = dist(c.pos, enemy.pos);

    // Focus lowest-hp enemy for kills.
    const lowest = lowestHpEnemy(state, c, 900);
    const target = lowest || enemy;
    const targetRatio = target.hp / target.maxHp;

    // Commit if we have the numbers or the target is executable.
    const numberEdge = alliesHere + 1 >= enemiesHere;
    const canExecute = targetRatio < 0.35 && hpRatio > 0.45;
    const engageRange = def.stats.attackRange + 260 * diff.aggro;

    if (d <= engageRange && (numberEdge || canExecute) && hpRatio > 0.4) {
      input.attackTarget = target.id;
      castOffense(state, c, input, target, diff);
      // Kite: ranged steps back if the target is melee & too close.
      if (def.ranged && d < def.stats.attackRange * 0.6) {
        const away = retreatPoint(c);
        input.move = away;
        input.attackMove = target.pos;
      }
      applyInput(state, c.ownerId, input);
      return;
    }

    // Outnumbered: bail out.
    if (enemiesHere > alliesHere + 1) {
      input.move = retreatPoint(c);
      castEscape(state, c, input, enemy);
      applyInput(state, c.ownerId, input);
      return;
    }
  }

  // Objective control: junglers and healthy siege windows target Barón/Draggón.
  if ((role === "jungle" || siegeWindow) && hpRatio > 0.55 && manaRatio > 0.4) {
    const epic = epicObjective(state, c);
    if (epic && enemiesNear(state, c, epic.pos, 900) === 0) {
      const d = dist(c.pos, epic.pos);
      if (d < 1600) {
        input.attackTarget = epic.id;
        input.attackMove = { x: epic.pos.x, y: epic.pos.y };
        applyInput(state, c.ownerId, input);
        return;
      }
    }
  }

  // Junglers clear camps as a primary occupation.
  if (role === "jungle" && hpRatio > 0.4) {
    const camp = nearestCamp(state, c, hpRatio);
    if (camp) {
      const cd = dist(c.pos, camp.pos);
      if (cd < 1400) {
        input.attackTarget = camp.id;
        input.attackMove = { x: camp.pos.x, y: camp.pos.y };
        applyInput(state, c.ownerId, input);
        return;
      }
    }
  }

  // If a nearby lane is falling behind, help push it (gank in).
  if (role !== "jungle" && !siegeWindow) {
    const gank = findWeakLane(state, c);
    if (gank && dist(c.pos, gank) < 1400 && hpRatio > 0.5) {
      input.attackMove = gank;
      applyInput(state, c.ownerId, input);
      return;
    }
  }

  // Break turrets that are actually breakable and near us.
  const breakable = nearestBreakableTurret(state, c);
  if (breakable && dist(c.pos, breakable) < 900 && (alliesNear(state, c, breakable, 500) >= 1 || siegeWindow)) {
    input.attackTarget = breakable.id;
    input.attackMove = { x: breakable.x, y: breakable.y };
    applyInput(state, c.ownerId, input);
    return;
  }

  // Otherwise farm / push.
  const target = lastHittable(state, c);
  if (target && dist(c.pos, target.pos) <= c.attackRange + 300) {
    input.attackTarget = target.id;
    if (enemy && dist(c.pos, enemy.pos) < 700) castPoke(state, c, input, enemy, diff);
    applyInput(state, c.ownerId, input);
    return;
  }

  // Push the lane; commit to nexus in a siege window.
  const enemyNexus = c.team === "blue" ? STRUCTURES.red.nexus : STRUCTURES.blue.nexus;
  if (siegeWindow) {
    input.attackMove = { x: enemyNexus.x, y: enemyNexus.y };
    applyInput(state, c.ownerId, input);
    return;
  }
  const lane = botLane(state, c);
  const path = lanePathFor(lane, c.team);
  const f = frontier(state, c);
  const ahead = hpRatio > 0.6 ? 0.05 : 0;
  const push = pointAlong(path, Math.min(0.9, progressAlong(path, f) + ahead));
  input.attackMove = { x: push.x, y: push.y };
  applyInput(state, c.ownerId, input);
}

/** Lowest-HP enemy nearby (for focus-fire in teamfights). */
function lowestHpEnemy(state: GameState, c: Champion, r: number): Champion | null {
  let best: Champion | null = null;
  let bestHp = Infinity;
  for (const id in state.champions) {
    const e = state.champions[id];
    if (!e.alive || e.team === c.team) continue;
    if (e.buffs.some((b) => b.id === "stealth")) continue;
    if (dist(c.pos, e.pos) > r) continue;
    if (e.hp < bestHp) { bestHp = e.hp; best = e; }
  }
  return best;
}

/** Point on the ally lane furthest behind the enemy push (a gank target). */
function findWeakLane(state: GameState, c: Champion): { x: number; y: number } | null {
  let worst: LaneId | null = null;
  let worstT = -1;
  for (const lane of LANES) {
    const path = lanePathFor(lane, c.team);
    let front = 0;
    for (const id in state.minions) {
      const m = state.minions[id];
      if (!m.alive || m.team !== c.team || m.lane !== lane) continue;
      front = Math.max(front, progressAlong(path, m.pos));
    }
    // Lower front = enemy is pushing that lane at us: worth ganking.
    if (front < 0.35 && front > 0.02 && front > worstT) {
      worstT = front;
      worst = lane;
    }
  }
  if (!worst) return null;
  const path = lanePathFor(worst, c.team);
  return pointAlong(path, Math.max(0.08, worstT + 0.05));
}

function countAliveChamps(state: GameState, team: Team): number {
  let n = 0;
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team === team) n++;
  }
  return n;
}

function nearestCamp(state: GameState, c: Champion, hpRatio: number): Monster | null {
  let best: Monster | null = null;
  let bd = 1400;
  for (const id in state.monsters) {
    const mo = state.monsters[id];
    if (!mo.alive) continue;
    // Only very healthy bots contest the epic pits (Draggón / Nashø).
    if (mo.epic && hpRatio < 0.75) continue;
    const d = dist(c.pos, mo.pos);
    if (d < bd) { bd = d; best = mo; }
  }
  return best;
}

function anyEnemyClose(state: GameState, c: Champion, r: number): boolean {
  for (const id in state.champions) {
    const e = state.champions[id];
    if (e.alive && e.team !== c.team && dist(c.pos, e.pos) < r) return true;
  }
  return false;
}

function retreatPoint(c: Champion): { x: number; y: number } {
  const f = STRUCTURES[c.team].fountain;
  const dir = norm(sub(f, c.pos));
  return add(c.pos, scale(dir, 350));
}

function aimAt(c: Champion, target: Entity, skill: number): { x: number; y: number } {
  // Lead the target a bit based on its velocity proxy (face + movespeed).
  const lead = target.kind === "champion" ? (target as Champion).moveSpeed * 0.12 * skill : 0;
  const mv = (target as Champion).moveTarget;
  if (mv) {
    const dir = norm(sub(mv, target.pos));
    return add(target.pos, scale(dir, lead));
  }
  return { x: target.pos.x, y: target.pos.y };
}

function castOffense(state: GameState, c: Champion, input: PlayerInput, enemy: Champion, diff: typeof DIFF.normal) {
  const def = CHAMPIONS[c.championId];
  const d = dist(c.pos, enemy.pos);
  for (let slot = 0; slot < 4; slot++) {
    const abil = c.abilities[slot];
    const ad = def.abilities[slot];
    if (abil.rank <= 0 || abil.cd > 0) continue;
    const cost = ad.manaCost[Math.min(abil.rank - 1, ad.manaCost.length - 1)] || 0;
    if (c.mana < cost) continue;
    if (ad.key === "teemoo_e") continue; // passive
    // Range gate.
    const rng = ad.range || 300;
    if ((ad.cast === "skillshot" || ad.cast === "ground" || ad.cast === "vector" || ad.cast === "target" || ad.cast === "dash") && d > rng * 1.05) continue;
    // Don't waste ults on nothing.
    const aim = aimAt(c, enemy, diff.skillAim);
    const cmd: CastCommand = { slot, x: aim.x, y: aim.y, targetId: enemy.id };
    input.casts!.push(cmd);
  }
}

function castPoke(state: GameState, c: Champion, input: PlayerInput, enemy: Champion, diff: typeof DIFF.normal) {
  const def = CHAMPIONS[c.championId];
  const d = dist(c.pos, enemy.pos);
  // Only poke with Q/W (slots 0,1), keep ult/escape.
  for (const slot of [0, 1]) {
    const abil = c.abilities[slot];
    const ad = def.abilities[slot];
    if (abil.rank <= 0 || abil.cd > 0) continue;
    if (ad.key === "teemoo_e") continue;
    if (ad.cast === "self") continue;
    const rng = ad.range || 300;
    if (d > rng) continue;
    const cost = ad.manaCost[Math.min(abil.rank - 1, ad.manaCost.length - 1)] || 0;
    if (c.mana < cost + 40) continue; // keep mana buffer
    if (Math.random() > 0.4) continue; // poke sometimes
    const aim = aimAt(c, enemy, diff.skillAim);
    input.casts!.push({ slot, x: aim.x, y: aim.y, targetId: enemy.id });
  }
}

function castEscape(state: GameState, c: Champion, input: PlayerInput, enemy: Champion) {
  const def = CHAMPIONS[c.championId];
  // Use self-speed buffs or dashes away.
  const escapeSlots: Record<string, number[]> = {
    teemoo: [1], ashee: [2, 0], garon: [0], jinix: [], luux: [1], blitzcronk: [1], darios: [], yasou: [],
  };
  const slots = escapeSlots[c.championId] || [];
  for (const slot of slots) {
    const abil = c.abilities[slot];
    const ad = def.abilities[slot];
    if (abil.rank <= 0 || abil.cd > 0) continue;
    const cost = ad.manaCost[Math.min(abil.rank - 1, ad.manaCost.length - 1)] || 0;
    if (c.mana < cost) continue;
    const away = retreatPoint(c);
    input.casts!.push({ slot, x: away.x, y: away.y, targetId: null });
  }
}
