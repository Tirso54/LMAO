import { Champion, Entity, GameState, PlayerInput, CastCommand, Team } from "./types";
import { CHAMPIONS } from "./champions";
import { RECOMMENDED, ITEMS } from "./items";
import { STRUCTURES, WORLD, LANES, LaneId, lanePathFor, pointAlong, progressAlong } from "./constants";
import { add, angleTo, dist, fromAngle, norm, sub, scale, clamp } from "./math";
import { applyInput, unspentPoints } from "./simulation";
import { enemyTeam, isChampion, slowMultiplier } from "./combat";

// Difficulty knobs (tuned up: sharper reactions, better aim, smarter aggression).
const DIFF = {
  casual: { react: 0.3, aggro: 0.8, skillAim: 0.62, retreatHp: 0.26, jungle: true },
  normal: { react: 0.16, aggro: 1.0, skillAim: 0.82, retreatHp: 0.3, jungle: true },
  savage: { react: 0.08, aggro: 1.25, skillAim: 0.96, retreatHp: 0.36, jungle: true },
};

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

/** Which lane this bot is assigned to (stable, spread across the team). */
function botLane(state: GameState, c: Champion): LaneId {
  const cached = c.passiveData.laneIdx;
  if (cached != null) return LANES[cached];
  // Count how many allies already claimed each lane and take the emptiest.
  const counts: Record<LaneId, number> = { top: 0, mid: 0, bot: 0 };
  for (const id in state.champions) {
    const o = state.champions[id];
    if (o.team !== c.team || o.id === c.id) continue;
    const l = o.passiveData.laneIdx;
    if (l != null) counts[LANES[l]]++;
  }
  let pick: LaneId = "mid";
  let bestN = Infinity;
  for (const l of LANES) {
    if (counts[l] < bestN) { bestN = counts[l]; pick = l; }
  }
  c.passiveData.laneIdx = LANES.indexOf(pick);
  return pick;
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
  const enemy = nearestEnemyChamp(state, c, def.stats.attackRange + 600);
  const anyEnemyChamp = nearestEnemyChamp(state, c, 2000);
  const ownFountain = STRUCTURES[c.team].fountain;

  // Recall if very low and safe, in own half with no enemy near.
  const nearEnemy = enemy && dist(c.pos, enemy.pos) < 700;
  if (hpRatio < 0.25 && !nearEnemy && c.mana >= 0) {
    // Move back toward fountain; recall if close-ish and safe.
    if (dist(c.pos, ownFountain) < 1200 && !anyEnemyClose(state, c, 900)) {
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
    // Use escape/mobility abilities.
    castEscape(state, c, input, enemy!);
    applyInput(state, c.ownerId, input);
    return;
  }

  // Engage nearby enemy champion if reasonable.
  if (enemy) {
    const d = dist(c.pos, enemy.pos);
    const engageRange = def.stats.attackRange + 240 * diff.aggro;
    const advantage = hpRatio > 0.4 && (c.level >= enemy.level - 1);
    if (d <= engageRange && advantage) {
      input.attackTarget = enemy.id;
      castOffense(state, c, input, enemy, diff);
      // Kite: ranged step back if enemy is melee & close.
      if (def.ranged && d < def.stats.attackRange * 0.6) {
        input.move = retreatPoint(c);
        input.attackTarget = enemy.id; // still attack while repositioning (attack-move-ish)
        input.attackMove = enemy.pos;
      }
      applyInput(state, c.ownerId, input);
      return;
    }
  }

  // Otherwise farm / push.
  const target = lastHittable(state, c);
  if (target && dist(c.pos, target.pos) <= c.attackRange + 300) {
    input.attackTarget = target.id;
    // Occasionally poke enemy champ with a spare ability.
    if (enemy && dist(c.pos, enemy.pos) < 700) castPoke(state, c, input, enemy, diff);
    applyInput(state, c.ownerId, input);
    return;
  }

  // Read the numbers: if the enemy is dead or outnumbered, it's a siege window —
  // commit to the base and end the game instead of farming or hovering at mid.
  const aliveAllies = countAliveChamps(state, c.team);
  const aliveEnemies = countAliveChamps(state, enemyTeam(c.team));
  const siegeWindow = aliveEnemies === 0 || (aliveAllies - aliveEnemies >= 1 && hpRatio > 0.5);

  // No lane threats: clear a jungle camp only if one is basically on the way
  // and we're healthy — never during a siege window.
  if (diff.jungle && hpRatio > 0.7 && !siegeWindow) {
    const camp = nearestCamp(state, c, hpRatio);
    if (camp) {
      input.attackMove = { x: camp.pos.x, y: camp.pos.y };
      applyInput(state, c.ownerId, input);
      return;
    }
  }

  // Push the lane toward the enemy base so games end. Attack-move toward the
  // enemy nexus; auto-acquire grabs minions & structures en route. During a
  // siege window, drive all the way into the base; otherwise stay with minions.
  const enemyNexus = c.team === "blue" ? STRUCTURES.red.nexus : STRUCTURES.blue.nexus;
  if (siegeWindow) {
    // Commit: walk straight into the enemy base and end it.
    input.attackMove = { x: enemyNexus.x, y: enemyNexus.y };
    applyInput(state, c.ownerId, input);
    return;
  }
  // Push our own lane: advance a bit past the minion frontier when healthy.
  const lane = botLane(state, c);
  const path = lanePathFor(lane, c.team);
  const f = frontier(state, c);
  const ahead = hpRatio > 0.6 ? 0.05 : 0;
  const push = pointAlong(path, Math.min(0.9, progressAlong(path, f) + ahead));
  input.attackMove = { x: push.x, y: push.y };
  applyInput(state, c.ownerId, input);
}

function countAliveChamps(state: GameState, team: Team): number {
  let n = 0;
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team === team) n++;
  }
  return n;
}

function nearestCamp(state: GameState, c: Champion, hpRatio: number): { pos: { x: number; y: number } } | null {
  let best: { pos: { x: number; y: number } } | null = null;
  let bd = 1150; // only camps essentially on the bot's path
  for (const id in state.monsters) {
    const mo = state.monsters[id];
    if (!mo.alive) continue;
    // Only very healthy bots contest the epic pits (Draggón / Nashø).
    if (mo.epic && hpRatio < 0.85) continue;
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
