import {
  Champion,
  Entity,
  GameState,
  Minion,
  Monster,
  Nexus,
  PlayerInput,
  Projectile,
  Team,
  Turret,
  Zone,
} from "./types";
import {
  DT,
  LANES,
  LaneId,
  lanePathFor,
  MINION,
  MAX_LEVEL,
  NEXUS,
  PASSIVE_GOLD_PER_SEC,
  PASSIVE_XP_PER_SEC,
  RECALL_TIME,
  STRUCTURES,
  TURRET,
  WORLD,
  FOUNTAIN_REGEN,
  CHAMPION_RADIUS,
  MINION_RADIUS,
  MONSTER,
  MONSTER_KINDS,
  MonsterKind,
  MINION_SIEGE_MULT,
  CHAMP_SIEGE_MULT,
} from "./constants";
import { CHAMPIONS } from "./champions";
import { ITEMS } from "./items";
import {
  add,
  angleTo,
  clamp,
  dist,
  fromAngle,
  norm,
  scale,
  sub,
} from "./math";
import {
  addBuff,
  dealDamage,
  decayDamagers,
  grantXp,
  enemyTeam,
  getEntity,
  hasBuff,
  healEntity,
  isCC,
  isChampion,
  isStunnedOrAirborne,
  killEntity,
  slowMultiplier,
  structureVulnerable,
} from "./combat";
import { recomputeChampStats } from "./stats";
import { ABILITY_HANDLERS, segHit } from "./abilities";

// ------------------------------------------------------------------
// Public: apply a player's input to their champion (called before step).
// ------------------------------------------------------------------
export function applyInput(state: GameState, ownerId: string, input: PlayerInput) {
  const champ = findChampByOwner(state, ownerId);
  if (!champ) return;
  champ.lastInputSeq = input.seq;

  // Shopping & leveling are allowed while dead (like the real thing).
  if (input.levelUp != null) spendLevelPoint(champ, input.levelUp);
  if (input.buy) for (const itemId of input.buy) tryBuy(state, champ, itemId);
  if (input.sell) for (const itemId of input.sell) trySell(champ, itemId);

  if (!champ.alive) return;

  // Any explicit order cancels recall.
  const cancelsRecall =
    input.move || input.attackMove || input.attackTarget != null || input.stop || (input.casts && input.casts.length);
  if (cancelsRecall && champ.recallTimer > 0) champ.recallTimer = 0;

  if (input.stop) {
    champ.moveTarget = null;
    champ.attackTargetId = null;
  }
  if (input.move) {
    champ.moveTarget = { x: input.move.x, y: input.move.y };
    champ.attackTargetId = null;
    champ.holdPosition = false;
  }
  if (input.attackTarget != null) {
    champ.attackTargetId = input.attackTarget;
    champ.moveTarget = null;
  }
  if (input.attackMove) {
    // Move toward point but auto-acquire targets along the way.
    champ.moveTarget = { x: input.attackMove.x, y: input.attackMove.y };
    champ.passiveData.attackMove = 1;
  } else if (input.move) {
    champ.passiveData.attackMove = 0;
  }

  if (input.recall && champ.recallTimer <= 0 && !isCC(champ)) {
    champ.recallTimer = RECALL_TIME;
  }

  if (input.casts) {
    for (const c of input.casts) {
      castAbility(state, champ, c.slot, c.x, c.y, c.targetId ?? null);
    }
  }

  if (input.ping) {
    state.fx.push({ t: "ping", x: input.ping.x, y: input.ping.y, team: champ.team, text: input.ping.kind });
  }
}

export function findChampByOwner(state: GameState, ownerId: string): Champion | null {
  for (const id in state.champions) {
    if (state.champions[id].ownerId === ownerId) return state.champions[id];
  }
  return null;
}

// ------------------------------------------------------------------
// Casting
// ------------------------------------------------------------------
export function castAbility(
  state: GameState,
  champ: Champion,
  slot: number,
  x: number,
  y: number,
  targetId: number | null
): boolean {
  if (slot < 0 || slot > 3) return false;
  if (!champ.alive || isStunnedOrAirborne(champ)) return false;
  const def = CHAMPIONS[champ.championId].abilities[slot];
  const abil = champ.abilities[slot];
  if (!def || abil.rank <= 0) return false;
  if (abil.cd > 0) return false;
  const cost = def.manaCost[Math.min(abil.rank - 1, def.manaCost.length - 1)] || 0;
  if (champ.mana < cost) return false;
  const handler = ABILITY_HANDLERS[def.key];
  if (!handler) return false;

  // Face the cast direction.
  if (targetId != null) {
    const t = getEntity(state, targetId);
    if (t) champ.face = angleTo(champ.pos, t.pos);
  } else {
    champ.face = angleTo(champ.pos, { x, y });
  }

  const ok = handler({ state, champ, rank: abil.rank, def, x, y, targetId });
  if (ok) {
    champ.mana -= cost;
    const cd = def.cooldown[Math.min(abil.rank - 1, def.cooldown.length - 1)] || 0;
    abil.cd = cd * (1 - champ.cooldownReduction);
    champ.recallTimer = 0;
  }
  return ok;
}

// ------------------------------------------------------------------
// Level points
// ------------------------------------------------------------------
export function unspentPoints(champ: Champion): number {
  const spent = champ.abilities.reduce((a, b) => a + b.rank, 0);
  return champ.level - spent;
}

export function canRank(champ: Champion, slot: number): boolean {
  const def = CHAMPIONS[champ.championId].abilities[slot];
  const abil = champ.abilities[slot];
  const maxRank = def.maxRank || 5;
  if (abil.rank >= maxRank) return false;
  if (def.ultLevels) {
    // ult: rank r requires level >= ultLevels[r]
    const need = def.ultLevels[abil.rank];
    if (champ.level < need) return false;
  } else {
    // regular ability: rank up gated softly by level (r*2-1)
    if (champ.level < abil.rank * 2 + 1 && abil.rank >= 1 && slot !== bestFirstSlot(champ)) {
      // allow but not strictly gated; keep permissive
    }
  }
  return true;
}

function bestFirstSlot(champ: Champion): number {
  return 0;
}

export function spendLevelPoint(champ: Champion, slot: number): boolean {
  if (unspentPoints(champ) <= 0) return false;
  if (!canRank(champ, slot)) return false;
  champ.abilities[slot].rank += 1;
  return true;
}

function autoLevel(champ: Champion) {
  // Spend leftover points automatically with a smart order.
  let guard = 0;
  while (unspentPoints(champ) > 0 && guard++ < 10) {
    // Prefer maxing R, then a champ order Q->W->E biased to highest impact.
    const order = levelPriority(champ);
    let done = false;
    for (const slot of order) {
      if (canRank(champ, slot)) {
        champ.abilities[slot].rank += 1;
        done = true;
        break;
      }
    }
    if (!done) break;
  }
}

function levelPriority(champ: Champion): number[] {
  // R first if available, then champ-specific maxing.
  const rOk = canRank(champ, 3);
  const orders: Record<string, number[]> = {
    yasou: [0, 2, 1],
    teemoo: [2, 0, 1],
    ashee: [1, 0, 2],
    garon: [2, 0, 1],
    jinix: [1, 0, 2],
    luux: [2, 0, 1],
    blitzcronk: [0, 1, 2],
    darios: [0, 1, 2],
  };
  const base = orders[champ.championId] || [0, 1, 2];
  return rOk ? [3, ...base] : [...base, 3];
}

// ------------------------------------------------------------------
// Shop
// ------------------------------------------------------------------
export function tryBuy(state: GameState, champ: Champion, itemId: string): boolean {
  const it = ITEMS[itemId];
  if (!it) return false;
  if (!champ.inFountain) return false;
  if (champ.items.length >= 6) return false;
  if (champ.gold < it.cost) return false;
  champ.gold -= it.cost;
  champ.items.push(itemId);
  const hpRatio = champ.hp / champ.maxHp;
  const manaRatio = champ.mana / champ.maxMana;
  recomputeChampStats(champ);
  champ.hp = champ.maxHp * hpRatio;
  champ.mana = champ.maxMana * manaRatio;
  state.fx.push({ t: "text", x: champ.pos.x, y: champ.pos.y, team: champ.team, text: `Bought ${it.name}` });
  return true;
}

export function trySell(champ: Champion, itemId: string): boolean {
  const idx = champ.items.indexOf(itemId);
  if (idx < 0) return false;
  const it = ITEMS[itemId];
  champ.items.splice(idx, 1);
  champ.gold += Math.round(it.cost * 0.7);
  const hpRatio = champ.hp / champ.maxHp;
  recomputeChampStats(champ);
  champ.hp = Math.min(champ.maxHp, champ.maxHp * hpRatio);
  return true;
}

// ------------------------------------------------------------------
// Main step
// ------------------------------------------------------------------
export function step(state: GameState, dt: number = DT) {
  if (state.phase === "ended") return;
  state.tick++;
  state.time += dt;

  // Cooldowns, buffs, regen, passives.
  for (const id in state.champions) {
    updateChampion(state, state.champions[id], dt);
  }

  // Minion waves.
  if (state.config.minionsEnabled) updateMinionSpawns(state, dt);

  // Minion behavior.
  for (const id in state.minions) updateMinion(state, state.minions[id], dt);

  // Neutral jungle monsters.
  for (const id in state.monsters) updateMonster(state, state.monsters[id], dt);

  // Structures.
  for (const id in state.turrets) updateTurret(state, state.turrets[id], dt);
  for (const id in state.nexuses) updateNexus(state, state.nexuses[id], dt);

  // Projectiles.
  updateProjectiles(state, dt);

  // Zones.
  updateZones(state, dt);

  // Soft collision separation.
  separateUnits(state);

  // Passive gold trickle + team gold tally.
  state.teamGold.blue = 0;
  state.teamGold.red = 0;
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive) c.gold += PASSIVE_GOLD_PER_SEC * dt;
    grantXp(state, c, PASSIVE_XP_PER_SEC * dt);
    state.teamGold[c.team] += c.gold;
  }

  // Trim kill feed.
  if (state.killFeed.length > 40) state.killFeed.splice(0, state.killFeed.length - 40);
}

// ------------------------------------------------------------------
// Champion update
// ------------------------------------------------------------------
function updateChampion(state: GameState, champ: Champion, dt: number) {
  // Cooldowns.
  for (const a of champ.abilities) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
  if (champ.attackCooldown > 0) champ.attackCooldown -= dt;

  // Buffs tick.
  updateBuffs(state, champ, dt);
  decayDamagers(champ, dt);

  // Recompute derived stats each tick so timed stat buffs (jungle camps,
  // Draggón/Nashø) take effect and expire cleanly. Cheap for ~10 champs.
  recomputeChampStats(champ);
  if (champ.hp > champ.maxHp) champ.hp = champ.maxHp;
  if (champ.mana > champ.maxMana) champ.mana = champ.maxMana;

  // Auto-level any unspent points (beginner friendly; manual overrides earlier).
  if (unspentPoints(champ) > 0) autoLevel(champ);

  // Death / respawn.
  if (!champ.alive) {
    champ.inFountain = true; // dead = at base, can shop
    champ.respawnTimer -= dt;
    if (champ.respawnTimer <= 0) respawn(state, champ);
    return;
  }

  // Fountain check.
  const fountain = STRUCTURES[champ.team].fountain;
  champ.inFountain = dist(champ.pos, fountain) < 320;

  // Recall channel.
  if (champ.recallTimer > 0) {
    champ.recallTimer -= dt;
    champ.moveTarget = null;
    champ.attackTargetId = null;
    if (champ.recallTimer <= 0) {
      champ.pos = { x: fountain.x, y: fountain.y };
      state.fx.push({ t: "cast", x: fountain.x, y: fountain.y, team: champ.team, spellId: "recall" });
    }
    return;
  }

  // Regen.
  if (champ.inFountain) {
    healEntity(champ, champ.maxHp * FOUNTAIN_REGEN * dt);
    champ.mana = Math.min(champ.maxMana, champ.mana + champ.maxMana * FOUNTAIN_REGEN * dt);
  } else {
    healEntity(champ, champ.hpRegen * dt);
    champ.mana = Math.min(champ.maxMana, champ.mana + champ.manaRegen * dt);
  }

  // Champion-specific passive tick.
  updatePassive(state, champ, dt);

  // If crowd controlled, cannot move/attack.
  if (isStunnedOrAirborne(champ)) {
    champ.attackWindup = 0;
    return;
  }
  // Rooted: can attack/cast but not move.
  const rooted = champ.buffs.some((b) => b.kind === "root" && b.time > 0);

  // Acquire attack-move target.
  if (champ.passiveData.attackMove && champ.attackTargetId == null) {
    const t = acquireTarget(state, champ);
    if (t) champ.attackTargetId = t.id;
  }

  // Attack logic.
  const target = getEntity(state, champ.attackTargetId);
  if (target && target.alive && target.team !== champ.team) {
    const range = champ.attackRange + champ.radius + target.radius;
    const d = dist(champ.pos, target.pos);
    if (d <= range) {
      // In range: stop and attack.
      champ.moveTarget = null;
      champ.face = angleTo(champ.pos, target.pos);
      handleAutoAttack(state, champ, target, dt);
    } else if (!rooted) {
      // Chase.
      moveToward(state, champ, target.pos, dt);
      champ.attackWindup = 0;
    }
  } else {
    champ.attackTargetId = null;
    // Move toward move target.
    if (champ.moveTarget && !rooted) {
      moveToward(state, champ, champ.moveTarget, dt);
      if (dist(champ.pos, champ.moveTarget) < 6) champ.moveTarget = null;
    }
    champ.attackWindup = 0;
  }
}

function respawn(state: GameState, champ: Champion) {
  champ.alive = true;
  const f = STRUCTURES[champ.team].fountain;
  champ.pos = { x: f.x, y: f.y + (Math.random() * 40 - 20) };
  const hpRatio = 1;
  recomputeChampStats(champ);
  champ.hp = champ.maxHp * hpRatio;
  champ.mana = champ.maxMana;
  champ.buffs = [];
  champ.moveTarget = null;
  champ.attackTargetId = null;
  champ.recallTimer = 0;
  state.fx.push({ t: "cast", x: champ.pos.x, y: champ.pos.y, team: champ.team, spellId: "respawn" });
}

function speedMultiplier(champ: Champion): number {
  let bonus = 0;
  for (const b of champ.buffs) {
    if ((b.kind === "speed" || b.kind === "haste") && b.time > 0) bonus += b.magnitude;
  }
  return Math.min(2.2, 1 + bonus);
}

function moveToward(state: GameState, champ: Champion, dest: { x: number; y: number }, dt: number) {
  const speed = champ.moveSpeed * slowMultiplier(champ) * speedMultiplier(champ);
  const d = dist(champ.pos, dest);
  if (d < 1) return;
  const dir = norm(sub(dest, champ.pos));
  const step = Math.min(d, speed * dt);
  champ.pos = add(champ.pos, scale(dir, step));
  champ.face = Math.atan2(dir.y, dir.x);
  clampToLane(champ);
  // Moving cancels attack windup.
  champ.attackWindup = 0;
}

export function clampToLane(e: Entity) {
  e.pos.x = clamp(e.pos.x, 40, WORLD.width - 40);
  e.pos.y = clamp(e.pos.y, WORLD.laneTop + e.radius, WORLD.laneBottom - e.radius);
}

// ------------------------------------------------------------------
// Auto attacks
// ------------------------------------------------------------------
function handleAutoAttack(state: GameState, champ: Champion, target: Entity, dt: number) {
  const def = CHAMPIONS[champ.championId];
  let attackSpeed = champ.attackSpeed;
  // Attack-speed buffs.
  for (const b of champ.buffs) if (b.kind === "attackspeed" && b.time > 0) attackSpeed *= 1 + b.magnitude;
  attackSpeed = clamp(attackSpeed, 0.2, 2.5);
  const interval = 1 / attackSpeed;

  if (champ.attackWindup > 0) {
    champ.attackWindup -= dt;
    if (champ.attackWindup <= 0) {
      fireAutoAttack(state, champ, target);
      champ.attackCooldown = interval;
    }
    return;
  }
  if (champ.attackCooldown <= 0) {
    // Start a new attack. Windup ~ 25% of interval, min 0.12s.
    champ.attackWindup = Math.max(0.1, interval * 0.22);
    champ.passiveData.pendingTarget = target.id;
  }
}

function fireAutoAttack(state: GameState, champ: Champion, forced?: Entity) {
  const target = forced && forced.alive ? forced : getEntity(state, champ.passiveData.pendingTarget || champ.attackTargetId);
  if (!target || !target.alive || target.team === champ.team) return;
  const def = CHAMPIONS[champ.championId];

  // Blind: attack misses.
  if ((champ.passiveData.blindUntil || 0) > state.time) {
    state.fx.push({ t: "text", x: champ.pos.x, y: champ.pos.y - 30, team: champ.team, text: "MISS", color: "#bbb" });
    return;
  }

  // Crit.
  let critChance = champ.critChance;
  if (champ.championId === "yasou") critChance = Math.min(1, critChance * 2); // passive doubles crit
  const isCrit = Math.random() < critChance;
  let dmg = champ.attackDamage;
  const onHitEffects: (() => void)[] = [];

  // Garon Q empowered auto.
  if ((champ.passiveData.qEmpowerUntil || 0) > state.time && champ.championId === "garon") {
    dmg += champ.passiveData.qEmpower || 0;
    champ.passiveData.qEmpowerUntil = 0;
    if (isChampion(target)) target.passiveData.silenceUntil = state.time + 1.5;
  }
  // Darios W crippling.
  if ((champ.passiveData.wEmpowerUntil || 0) > state.time && champ.championId === "darios") {
    dmg += champ.passiveData.wEmpower || 0;
    champ.passiveData.wEmpowerUntil = 0;
    if (isChampion(target)) addBuff(target, { id: "cripple", kind: "slow", time: 2, magnitude: 0.5, label: "Crippled" });
  }
  // Blitz E power fist knockup.
  const powerFist = champ.championId === "blitzcronk" && (champ.passiveData.powerFistUntil || 0) > state.time;
  if (powerFist) {
    dmg += champ.attackDamage; // double damage
    champ.passiveData.powerFistUntil = 0;
  }

  if (isCrit) dmg *= 1.75;

  const isRanged = def.ranged;
  const damageType = "physical";

  // Face the target so the shot reads as aimed, and flash a muzzle FX.
  champ.face = Math.atan2(target.pos.y - champ.pos.y, target.pos.x - champ.pos.x);
  state.fx.push({
    t: "shot",
    x: champ.pos.x,
    y: champ.pos.y,
    x2: target.pos.x,
    y2: target.pos.y,
    team: champ.team,
    color: def.color,
    radius: isRanged ? 8 : 5,
  });

  const applyLanding = (hitTarget: Entity) => {
    if (!hitTarget || !hitTarget.alive) return;
    const siege = hitTarget.kind === "turret" || hitTarget.kind === "nexus" ? CHAMP_SIEGE_MULT : 1;
    dealDamage(state, champ.id, hitTarget, dmg * siege, damageType, { isAuto: true, isCrit });
    // On-hit: Teemoo toxic.
    if (champ.championId === "teemoo") {
      const er = champ.abilities[2].rank;
      if (er > 0) {
        const bonus = [14, 26, 38, 50, 62][er - 1];
        dealDamage(state, champ.id, hitTarget, bonus * 0.5, "magic");
        if (isChampion(hitTarget)) {
          addBuff(hitTarget, {
            id: "toxic",
            kind: "dot",
            time: 4,
            magnitude: 0,
            tickDamage: bonus / 4,
            tickType: "magic",
            tickAcc: 0,
            sourceId: champ.id,
            label: "Poisoned",
          });
        }
      }
    }
    // Ashee frost.
    if (champ.championId === "ashee" && isChampion(hitTarget)) {
      addBuff(hitTarget, { id: "frost", kind: "slow", time: 2, magnitude: 0.28, label: "Frost" });
    }
    // Luux illumination detonate.
    if (isChampion(hitTarget) && (hitTarget.passiveData.illumUntil || 0) > state.time) {
      dealDamage(state, champ.id, hitTarget, 25 + champ.level * 8 + champ.abilityPower * 0.2, "magic");
      hitTarget.passiveData.illumUntil = 0;
      state.fx.push({ t: "hit", x: hitTarget.pos.x, y: hitTarget.pos.y, team: champ.team, color: "#ffe98a" });
    }
    // Blitz knockup.
    if (powerFist && isChampion(hitTarget)) {
      addBuff(hitTarget, { id: "cc_airborne", kind: "airborne", time: 1, magnitude: 1, label: "Knocked Up" });
    }
    // Jinix rocket splash.
    if (champ.championId === "jinix" && champ.passiveData.rocketMode) {
      for (const e of nearbyEnemies(state, champ.team, hitTarget.pos, 180)) {
        if (e.id !== hitTarget.id) dealDamage(state, champ.id, e, dmg * 0.6, "physical");
      }
    }
    state.fx.push({ t: "hit", x: hitTarget.pos.x, y: hitTarget.pos.y, team: champ.team, value: Math.round(dmg), color: isCrit ? "#ffd23f" : undefined });
  };

  if (isRanged) {
    // Jinix rocket mode = slower bigger projectile.
    const speed = def.projectileSpeed || 1300;
    const proj: Projectile = {
      id: state.nextProjectileId++,
      team: champ.team,
      pos: { x: champ.pos.x, y: champ.pos.y },
      vel: { x: 0, y: 0 },
      speed,
      targetId: target.id,
      sourceId: champ.id,
      damage: dmg,
      damageType,
      radius: 14,
      kind: "auto",
      crit: isCrit,
    };
    (proj as any)._apply = applyLanding;
    state.projectiles.push(proj);
  } else {
    // Melee: a quick slash streak from attacker to target.
    state.fx.push({ t: "beam", x: champ.pos.x, y: champ.pos.y, x2: target.pos.x, y2: target.pos.y, team: champ.team, color: def.color, radius: 6 });
    applyLanding(target);
  }
}

function nearbyEnemies(state: GameState, team: Team, center: { x: number; y: number }, radius: number): Entity[] {
  const out: Entity[] = [];
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team !== team && dist(c.pos, center) <= radius) out.push(c);
  }
  for (const id in state.minions) {
    const m = state.minions[id];
    if (m.alive && m.team !== team && dist(m.pos, center) <= radius) out.push(m);
  }
  for (const id in state.monsters) {
    const mo = state.monsters[id];
    if (mo.alive && mo.team !== team && dist(mo.pos, center) <= radius) out.push(mo);
  }
  return out;
}

// Auto-acquire nearest enemy within range+buffer (for attack-move & idle aggro).
function acquireTarget(state: GameState, champ: Champion): Entity | null {
  let best: Entity | null = null;
  let bestScore = Infinity;
  const searchR = champ.attackRange + 250;
  const consider = (e: Entity, priority: number) => {
    if (!e.alive || e.team === champ.team) return;
    const d = dist(champ.pos, e.pos);
    if (d > searchR) return;
    const score = d + priority;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  };
  for (const id in state.champions) consider(state.champions[id], 0);
  for (const id in state.minions) consider(state.minions[id], 400);
  for (const id in state.monsters) consider(state.monsters[id], 600);
  for (const id in state.turrets) if (structureVulnerable(state, state.turrets[id])) consider(state.turrets[id], 900);
  for (const id in state.nexuses) if (structureVulnerable(state, state.nexuses[id])) consider(state.nexuses[id], 1200);
  return best;
}

// ------------------------------------------------------------------
// Buffs / passives
// ------------------------------------------------------------------
function updateBuffs(state: GameState, champ: Champion, dt: number) {
  for (const b of champ.buffs) {
    b.time -= dt;
    if (b.kind === "dot" && b.tickDamage) {
      b.tickAcc = (b.tickAcc || 0) + dt;
      while ((b.tickAcc || 0) >= 0.5 && b.time > -0.5) {
        b.tickAcc = (b.tickAcc || 0) - 0.5;
        dealDamage(state, b.sourceId ?? null, champ, b.tickDamage * 0.5, b.tickType || "magic");
        if (!champ.alive) break;
      }
    }
  }
  champ.buffs = champ.buffs.filter((b) => b.time > 0 && !(b.kind === "shield" && b.magnitude <= 0));
}

function updatePassive(state: GameState, champ: Champion, dt: number) {
  switch (champ.championId) {
    case "yasou": {
      // Build flow while moving; shield at full.
      const moving = !!champ.moveTarget || champ.attackTargetId != null;
      if (moving) champ.passiveData.flow = Math.min(100, (champ.passiveData.flow || 0) + dt * 28);
      if ((champ.passiveData.flow || 0) >= 100 && !hasBuff(champ, "shield")) {
        // ready — apply a shield buff flag; actual shield granted when hit (simplified: keep small standing shield)
        champ.passiveData.flowReady = 1;
      }
      if (champ.passiveData.flowReady && !champ.buffs.some((b) => b.id === "flowshield")) {
        addBuff(champ, { id: "flowshield", kind: "shield", time: 999, magnitude: 40 + champ.level * 12, label: "Flow" });
        champ.passiveData.flow = 0;
        champ.passiveData.flowReady = 0;
      }
      break;
    }
    case "garon": {
      // Regen when not recently damaged.
      const recent = Object.keys(champ.recentDamagers).some((k) => champ.recentDamagers[Number(k)] < 6);
      if (!recent && champ.hp < champ.maxHp) healEntity(champ, champ.maxHp * 0.012 * dt + 3 * dt);
      break;
    }
    case "blitzcronk": {
      // Mana barrier when low.
      if (champ.hp / champ.maxHp < 0.2 && !champ.passiveData.barrierUsed && champ.mana > 0) {
        const shield = champ.mana * 0.3;
        champ.mana *= 0.7;
        addBuff(champ, { id: "manabarrier", kind: "shield", time: 10, magnitude: shield, label: "Mana Barrier" });
        champ.passiveData.barrierUsed = state.time + 30;
      }
      if (champ.passiveData.barrierUsed && state.time > champ.passiveData.barrierUsed) champ.passiveData.barrierUsed = 0;
      break;
    }
    case "teemoo": {
      // Stealth while idle.
      const idle = !champ.moveTarget && champ.attackTargetId == null && champ.attackWindup <= 0;
      if (idle) {
        champ.passiveData.idleTime = (champ.passiveData.idleTime || 0) + dt;
        if ((champ.passiveData.idleTime || 0) > 1.5 && !champ.buffs.some((b) => b.id === "stealth")) {
          addBuff(champ, { id: "stealth", kind: "invuln", time: 999, magnitude: 0, label: "Camouflage" });
          champ.passiveData.stealth = 1;
        }
      } else {
        if (champ.passiveData.stealth) {
          champ.buffs = champ.buffs.filter((b) => b.id !== "stealth");
          addBuff(champ, { id: "scoutms", kind: "speed", time: 1.2, magnitude: 0.25, label: "Scout" });
          champ.passiveData.stealth = 0;
        }
        champ.passiveData.idleTime = 0;
      }
      break;
    }
    case "darios": {
      // Bleed AD bonus at 5 stacks handled via bleed count -> recompute-ish (soft).
      break;
    }
  }

  // Garon spin aura.
  if (champ.championId === "garon" && (champ.passiveData.spinUntil || 0) > state.time) {
    champ.passiveData.spinAcc = (champ.passiveData.spinAcc || 0) + dt;
    if (champ.passiveData.spinAcc >= 0.5) {
      champ.passiveData.spinAcc -= 0.5;
      const rank = champ.passiveData.spinRank || 1;
      const def = CHAMPIONS.garon.abilities[2];
      const dmg = (def.damage![rank - 1] + def.adRatio! * champ.attackDamage);
      for (const e of nearbyEnemies(state, champ.team, champ.pos, def.radius || 330)) {
        dealDamage(state, champ.id, e, dmg, "physical");
      }
      state.fx.push({ t: "aoe", x: champ.pos.x, y: champ.pos.y, team: champ.team, radius: 330, spellId: "garon_e", ttl: 0.3 });
    }
  }

  // Luux illumination mark: when champ damages enemy with ability we set mark — handled in dealDamage? we set here via a wrapper is complex; instead mark on ability hits within abilities. Simplify: mark nearest recently.
}

// ------------------------------------------------------------------
// Projectiles
// ------------------------------------------------------------------
function updateProjectiles(state: GameState, dt: number) {
  const survivors: Projectile[] = [];
  for (const p of state.projectiles) {
    if (p.kind === "auto") {
      // Homing.
      const target = getEntity(state, p.targetId);
      if (!target || !target.alive) continue; // fizzle
      const dir = norm(sub(target.pos, p.pos));
      const stepLen = p.speed * dt;
      const d = dist(p.pos, target.pos);
      if (d <= stepLen + target.radius) {
        const apply = (p as any)._apply as ((e: Entity) => void) | undefined;
        if (apply) apply(target);
        continue;
      }
      p.pos = add(p.pos, scale(dir, stepLen));
      survivors.push(p);
      continue;
    }

    // Skillshot.
    const stepLen = p.speed * dt;
    // Wind wall block.
    if (blockedByWall(state, p, stepLen)) {
      continue;
    }
    p.pos = add(p.pos, scale(p.vel, dt / 1));
    p.traveled = (p.traveled || 0) + stepLen;

    let consumed = false;
    const enemies = enemyEntitiesArr(state, p.team);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (p.hits && p.hits.includes(e.id)) continue;
      if (dist(p.pos, e.pos) <= p.radius + e.radius) {
        resolveSkillshotHit(state, p, e);
        if (p.hits) p.hits.push(e.id);
        const pierceLimit = (p as any).data?.pierceLimit ?? (p.pierce ? 99 : 1);
        if (!p.pierce || (p.hits && p.hits.length >= pierceLimit)) {
          consumed = true;
          break;
        }
      }
    }
    if (consumed) continue;
    if ((p.traveled || 0) >= (p.maxRange || 1000)) {
      // Rocket explodes at end even without hit.
      if (p.onHit === "rocket") explodeRocket(state, p);
      continue;
    }
    survivors.push(p);
  }
  state.projectiles = survivors;
}

function enemyEntitiesArr(state: GameState, team: Team): Entity[] {
  const out: Entity[] = [];
  for (const id in state.champions) if (state.champions[id].team !== team) out.push(state.champions[id]);
  for (const id in state.minions) if (state.minions[id].team !== team) out.push(state.minions[id]);
  for (const id in state.monsters) if (state.monsters[id].alive && state.monsters[id].team !== team) out.push(state.monsters[id]);
  for (const id in state.turrets) if (state.turrets[id].team !== team) out.push(state.turrets[id]);
  for (const id in state.nexuses) if (state.nexuses[id].team !== team) out.push(state.nexuses[id]);
  return out;
}

function blockedByWall(state: GameState, p: Projectile, stepLen: number): boolean {
  for (const z of state.zones) {
    if (z.kind !== "wall") continue;
    if (z.team === p.team) continue;
    // Wall is a segment centered at z.pos, perpendicular to z.angle, length z.length.
    const perp = (z.angle || 0) + Math.PI / 2;
    const half = (z.length || 260) / 2;
    const a = add(z.pos, fromAngle(perp, half));
    const b = add(z.pos, fromAngle(perp, -half));
    if (segHit(a, b, p.pos, p.radius + 18)) return true;
  }
  return false;
}

function resolveSkillshotHit(state: GameState, p: Projectile, e: Entity) {
  if (p.spellId === "jinix_r") {
    explodeRocket(state, p, e);
    return;
  }
  let dmg = p.damage;
  dealDamage(state, p.sourceId, e, dmg, p.damageType);
  if (isChampion(e)) markIllumination(state, p.sourceId, e);
  applyOnHit(state, p, e);
  state.fx.push({ t: "hit", x: e.pos.x, y: e.pos.y, team: p.team, spellId: p.spellId });
}

function applyOnHit(state: GameState, p: Projectile, e: Entity) {
  if (!p.onHit || !isChampion(e)) return;
  switch (p.onHit) {
    case "slow":
      addBuff(e, { id: "ss_slow", kind: "slow", time: p.onHitDuration || 1.5, magnitude: p.onHitMagnitude || 0.4, label: "Slowed" });
      break;
    case "root":
      addBuff(e, { id: "cc_root", kind: "root", time: p.onHitDuration || 1.2, magnitude: 1, label: "Rooted" });
      break;
    case "stun":
      addBuff(e, { id: "cc_stun", kind: "stun", time: p.onHitDuration || 1.4, magnitude: 1, label: "Stunned" });
      break;
    case "airborne":
      addBuff(e, { id: "cc_airborne", kind: "airborne", time: p.onHitDuration || 0.9, magnitude: 1, label: "Knocked Up" });
      break;
    case "pull": {
      const source = getEntity(state, p.sourceId);
      if (source) {
        const dir = norm(sub(source.pos, e.pos));
        e.pos = add(source.pos, scale(dir, -(source.radius + e.radius + 15)));
        addBuff(e, { id: "cc_stun", kind: "stun", time: 0.6, magnitude: 1, label: "Grabbed" });
        clampToLane(e);
      }
      break;
    }
  }
}

function markIllumination(state: GameState, sourceId: number | null, target: Champion) {
  const src = getEntity(state, sourceId);
  if (isChampion(src) && src.championId === "luux") {
    target.passiveData.illumUntil = state.time + 4;
  }
}

function explodeRocket(state: GameState, p: Projectile, direct?: Entity) {
  const radius = 260;
  const traveled = p.traveled || 0;
  const rampBonus = Math.min(1, traveled / 1600) * p.damage * 0.6;
  for (const e of enemyEntitiesArr(state, p.team)) {
    if (!e.alive) continue;
    if (dist(p.pos, e.pos) <= radius + e.radius) {
      let dmg = p.damage + rampBonus;
      if (isChampion(e)) dmg += e.maxHp * 0.06;
      dealDamage(state, p.sourceId, e, dmg, p.damageType);
    }
  }
  state.fx.push({ t: "aoe", x: p.pos.x, y: p.pos.y, team: p.team, radius, spellId: "jinix_r", color: "#ff8ce0" });
}

// ------------------------------------------------------------------
// Zones (traps, delayed bombs, dots, walls)
// ------------------------------------------------------------------
function updateZones(state: GameState, dt: number) {
  const survivors: Zone[] = [];
  for (const z of state.zones) {
    z.time -= dt;
    if (z.kind === "trap" && z.armed) {
      // Detonate on first enemy in radius.
      const victim = firstEnemyIn(state, z.team, z.pos, z.radius);
      if (victim) {
        for (const e of enemiesInZone(state, z.team, z.pos, z.radius)) {
          dealDamage(state, z.sourceId, e, z.damage || 0, z.damageType || "magic");
          if (isChampion(e)) {
            if (z.slow) addBuff(e, { id: "trap_slow", kind: "slow", time: 2, magnitude: z.slow, label: "Trapped" });
            if (z.rootDuration) addBuff(e, { id: "cc_root", kind: "root", time: z.rootDuration, magnitude: 1, label: "Snared" });
          }
        }
        state.fx.push({ t: "aoe", x: z.pos.x, y: z.pos.y, team: z.team, radius: z.radius, spellId: z.spellId });
        continue; // consumed
      }
    }
    if (z.kind === "delayed") {
      if (z.time <= 0) {
        for (const e of enemiesInZone(state, z.team, z.pos, z.radius)) {
          dealDamage(state, z.sourceId, e, z.damage || 0, z.damageType || "magic");
        }
        state.fx.push({ t: "aoe", x: z.pos.x, y: z.pos.y, team: z.team, radius: z.radius, spellId: z.spellId, color: "#ffe98a" });
        continue;
      } else {
        // Slow field while active.
        if (z.slow) {
          for (const e of enemiesInZone(state, z.team, z.pos, z.radius)) {
            if (isChampion(e)) addBuff(e, { id: "field_slow", kind: "slow", time: 0.3, magnitude: z.slow, label: "Slowed" });
          }
        }
      }
    }
    if (z.time > 0) survivors.push(z);
  }
  state.zones = survivors;
}

function firstEnemyIn(state: GameState, team: Team, center: { x: number; y: number }, radius: number): Entity | null {
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team !== team && dist(c.pos, center) <= radius + c.radius && !c.buffs.some((b) => b.id === "stealth")) return c;
  }
  return null;
}

function enemiesInZone(state: GameState, team: Team, center: { x: number; y: number }, radius: number): Entity[] {
  const out: Entity[] = [];
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team !== team && dist(c.pos, center) <= radius + c.radius) out.push(c);
  }
  for (const id in state.minions) {
    const m = state.minions[id];
    if (m.alive && m.team !== team && dist(m.pos, center) <= radius + m.radius) out.push(m);
  }
  for (const id in state.monsters) {
    const mo = state.monsters[id];
    if (mo.alive && mo.team !== team && dist(mo.pos, center) <= radius + mo.radius) out.push(mo);
  }
  return out;
}

// ------------------------------------------------------------------
// Minions
// ------------------------------------------------------------------
function updateMinionSpawns(state: GameState, dt: number) {
  state.minionSpawnTimer -= dt;
  if (state.time < MINION.firstSpawnDelay) {
    state.minionSpawnTimer = MINION.firstSpawnDelay - state.time;
    return;
  }
  if (state.minionSpawnTimer <= 0) {
    state.minionSpawnTimer = MINION.spawnInterval;
    state.minionWave++;
    spawnWave(state, "blue");
    spawnWave(state, "red");
  }
}

function spawnWave(state: GameState, team: Team) {
  const wave = state.minionWave;
  const order: Minion["minionType"][] = [];
  for (let i = 0; i < MINION.perWave.melee; i++) order.push("melee");
  for (let i = 0; i < MINION.perWave.caster; i++) order.push("caster");
  if (wave % MINION.perWave.cannonEvery === 0) order.push("cannon");
  // One full wave marches down each of the three lanes.
  for (const lane of LANES) {
    const path = lanePathFor(lane, team);
    const spawn = path[0];
    // Step the wave backwards along the lane so they file out in a column.
    const next = path[1] || path[0];
    const dx = next.x - spawn.x, dy = next.y - spawn.y;
    const len = Math.hypot(dx, dy) || 1;
    const back = { x: -dx / len, y: -dy / len };
    const side = { x: -back.y, y: back.x };
    order.forEach((type, i) => {
      const lateral = (i % 2 === 0 ? -1 : 1) * (18 + (i % 3) * 8);
      createMinion(state, team, type, lane, {
        x: spawn.x + back.x * i * 46 + side.x * lateral,
        y: spawn.y + back.y * i * 46 + side.y * lateral,
      });
    });
  }
}

function createMinion(state: GameState, team: Team, type: Minion["minionType"], lane: LaneId, pos: { x: number; y: number }) {
  const base = MINION[type];
  const minutes = state.time / 60;
  const hpScale = 1 + MINION.hpGrowthPerMin * minutes;
  const adScale = 1 + MINION.adGrowthPerMin * minutes;
  const id = state.nextEntityId++;
  const m: Minion = {
    id,
    kind: "minion",
    team,
    pos: { x: pos.x, y: pos.y },
    face: team === "blue" ? 0 : Math.PI,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    radius: MINION_RADIUS,
    alive: true,
    minionType: type,
    lane,
    attackDamage: base.ad * adScale,
    attackRange: base.range,
    attackSpeed: base.attackSpeed,
    attackCooldown: 0,
    moveSpeed: base.moveSpeed,
    goldValue: base.gold,
    xpValue: base.xp,
    targetId: null,
    waypoint: 0,
    aggroLockId: null,
    aggroLockTimer: 0,
  };
  state.minions[id] = m;
}

function updateMinion(state: GameState, m: Minion, dt: number) {
  if (m.attackCooldown > 0) m.attackCooldown -= dt;
  if (m.aggroLockTimer > 0) m.aggroLockTimer -= dt;

  // Target selection.
  let target = getEntity(state, m.targetId);
  if (!target || !target.alive || target.team === m.team || dist(m.pos, target.pos) > 620) {
    target = pickMinionTarget(state, m);
    m.targetId = target ? target.id : null;
  }

  if (target) {
    const range = m.attackRange + m.radius + target.radius;
    const d = dist(m.pos, target.pos);
    if (d <= range) {
      m.face = angleTo(m.pos, target.pos);
      if (m.attackCooldown <= 0) {
        fireMinionAttack(state, m, target);
        m.attackCooldown = 1 / m.attackSpeed;
      }
      return;
    } else {
      moveMinionToward(state, m, target.pos, dt);
      return;
    }
  }

  // March along lane.
  marchLane(state, m, dt);
}

function pickMinionTarget(state: GameState, m: Minion): Entity | null {
  const aggroR = 520;
  let best: Entity | null = null;
  let bestScore = Infinity;
  const consider = (e: Entity, prio: number) => {
    if (!e.alive || e.team === m.team) return;
    const d = dist(m.pos, e.pos);
    if (d > aggroR) return;
    const score = d + prio;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  };
  // Priority: enemy minions > champions > turret > nexus (minions prefer minions).
  for (const id in state.minions) consider(state.minions[id], 0);
  for (const id in state.champions) consider(state.champions[id], 120);
  for (const id in state.turrets) if (structureVulnerable(state, state.turrets[id])) consider(state.turrets[id], 300);
  for (const id in state.nexuses) if (structureVulnerable(state, state.nexuses[id])) consider(state.nexuses[id], 500);
  return best;
}

function marchLane(state: GameState, m: Minion, dt: number) {
  // Each minion follows its own lane, walked in its team's direction.
  const wps = lanePathFor(m.lane, m.team);
  if (m.waypoint >= wps.length) {
    // Head to enemy nexus.
    const nx = m.team === "blue" ? STRUCTURES.red.nexus : STRUCTURES.blue.nexus;
    moveMinionToward(state, m, nx, dt);
    return;
  }
  const wp = wps[m.waypoint];
  moveMinionToward(state, m, wp, dt);
  if (dist(m.pos, wp) < 40) m.waypoint++;
}

function moveMinionToward(state: GameState, m: Minion, dest: { x: number; y: number }, dt: number) {
  const dir = norm(sub(dest, m.pos));
  const step = m.moveSpeed * dt;
  m.pos = add(m.pos, scale(dir, step));
  m.face = Math.atan2(dir.y, dir.x);
  clampToLane(m);
}

function minionDamageVs(m: Minion, target: Entity): number {
  const siege = target.kind === "turret" || target.kind === "nexus" ? MINION_SIEGE_MULT : 1;
  return m.attackDamage * siege;
}

function fireMinionAttack(state: GameState, m: Minion, target: Entity) {
  if (m.attackRange > 150) {
    // Ranged: projectile.
    const dir = norm(sub(target.pos, m.pos));
    const proj: Projectile = {
      id: state.nextProjectileId++,
      team: m.team,
      pos: { x: m.pos.x, y: m.pos.y },
      vel: { x: 0, y: 0 },
      speed: 900,
      targetId: target.id,
      sourceId: m.id,
      damage: m.attackDamage,
      damageType: "physical",
      radius: 10,
      kind: "auto",
    };
    (proj as any)._apply = (e: Entity) => {
      dealDamage(state, m.id, e, minionDamageVs(m, e), "physical", { isAuto: true });
    };
    state.projectiles.push(proj);
  } else {
    dealDamage(state, m.id, target, minionDamageVs(m, target), "physical", { isAuto: true });
  }
}

// ------------------------------------------------------------------
// Neutral jungle monsters
// ------------------------------------------------------------------
function reviveMonster(state: GameState, mo: Monster) {
  const def = MONSTER_KINDS[mo.monsterKind as MonsterKind];
  const minutes = state.time / 60;
  const hpScale = 1 + MONSTER.hpGrowthPerMin * minutes;
  const adScale = 1 + MONSTER.adGrowthPerMin * minutes;
  mo.maxHp = Math.round(def.hp * hpScale);
  mo.hp = mo.maxHp;
  mo.attackDamage = def.ad * adScale;
  mo.pos = { x: mo.home.x, y: mo.home.y };
  mo.alive = true;
  mo.targetId = null;
  mo.attackCooldown = 0;
  mo.respawnTimer = 0;
  state.fx.push({ t: "cast", x: mo.home.x, y: mo.home.y, team: "neutral", spellId: "camp_spawn" });
  if (mo.epic) {
    state.fx.push({ t: "text", x: mo.home.x, y: mo.home.y - 50, team: "neutral", text: `¡${mo.name} ha despertado!`, color: mo.monsterKind === "baron" ? "#c39bff" : "#ff9a5a" });
  }
}

function monsterValidTarget(mo: Monster, e: Entity | null): boolean {
  if (!e || !e.alive || e.team === "neutral") return false;
  if (isChampion(e) && e.buffs.some((b) => b.id === "stealth")) return false;
  return dist(mo.home, e.pos) < MONSTER.leash;
}

function pickMonsterTarget(state: GameState, mo: Monster): Entity | null {
  let best: Entity | null = null;
  let bestScore = Infinity;
  const consider = (e: Entity, prio: number) => {
    if (!monsterValidTarget(mo, e)) return;
    const d = dist(mo.pos, e.pos);
    if (d > MONSTER.aggro) return;
    const score = d + prio;
    if (score < bestScore) { bestScore = score; best = e; }
  };
  for (const id in state.champions) consider(state.champions[id], 0);
  for (const id in state.minions) consider(state.minions[id], 200);
  return best;
}

function moveMonsterToward(state: GameState, mo: Monster, dest: { x: number; y: number }, dt: number) {
  const d = dist(mo.pos, dest);
  if (d < 1) return;
  const dir = norm(sub(dest, mo.pos));
  const step = Math.min(d, mo.moveSpeed * dt);
  mo.pos = add(mo.pos, scale(dir, step));
  mo.face = Math.atan2(dir.y, dir.x);
  clampToLane(mo);
}

function fireMonsterAttack(state: GameState, mo: Monster, target: Entity) {
  state.fx.push({ t: "shot", x: mo.pos.x, y: mo.pos.y, x2: target.pos.x, y2: target.pos.y, team: "neutral", color: mo.epic ? "#c39bff" : "#e0b96a", radius: mo.epic ? 10 : 7 });
  if (mo.attackRange > 150) {
    const proj: Projectile = {
      id: state.nextProjectileId++,
      team: "neutral",
      pos: { x: mo.pos.x, y: mo.pos.y },
      vel: { x: 0, y: 0 },
      speed: 1000,
      targetId: target.id,
      sourceId: mo.id,
      damage: mo.attackDamage,
      damageType: "physical",
      radius: 12,
      kind: "auto",
    };
    (proj as any)._apply = (e: Entity) => dealDamage(state, mo.id, e, mo.attackDamage, "physical", { isAuto: true });
    state.projectiles.push(proj);
  } else {
    dealDamage(state, mo.id, target, mo.attackDamage, "physical", { isAuto: true });
    state.fx.push({ t: "beam", x: mo.pos.x, y: mo.pos.y, x2: target.pos.x, y2: target.pos.y, team: "neutral", color: mo.epic ? "#c39bff" : "#e0b96a", radius: 6 });
  }
}

function updateMonster(state: GameState, mo: Monster, dt: number) {
  if (!mo.alive) {
    mo.respawnTimer -= dt;
    if (mo.respawnTimer <= 0) reviveMonster(state, mo);
    return;
  }
  if (mo.attackCooldown > 0) mo.attackCooldown -= dt;

  // Leashing: dragged too far from its pit → reset & heal on the way home.
  const homeDist = dist(mo.pos, mo.home);
  if (homeDist > MONSTER.leash) {
    mo.targetId = null;
    healEntity(mo, mo.maxHp);
    moveMonsterToward(state, mo, mo.home, dt);
    return;
  }

  // Target acquisition / validation.
  let target = getEntity(state, mo.targetId);
  if (!monsterValidTarget(mo, target)) {
    target = pickMonsterTarget(state, mo);
    mo.targetId = target ? target.id : null;
  }

  if (target) {
    const range = mo.attackRange + mo.radius + target.radius;
    const d = dist(mo.pos, target.pos);
    if (d <= range) {
      mo.face = angleTo(mo.pos, target.pos);
      if (mo.attackCooldown <= 0) {
        fireMonsterAttack(state, mo, target);
        mo.attackCooldown = 1 / mo.attackSpeed;
      }
    } else {
      moveMonsterToward(state, mo, target.pos, dt);
    }
    return;
  }

  // Idle: return to the pit and regenerate.
  if (homeDist > 6) {
    moveMonsterToward(state, mo, mo.home, dt);
  } else if (mo.hp < mo.maxHp) {
    healEntity(mo, mo.maxHp * 0.06 * dt + 25 * dt);
  }
}

// ------------------------------------------------------------------
// Structures
// ------------------------------------------------------------------
function updateTurret(state: GameState, t: Turret, dt: number) {
  if (t.attackCooldown > 0) t.attackCooldown -= dt;

  let target = getEntity(state, t.targetId);
  const inRange = (e: Entity | null) => e && e.alive && e.team !== t.team && dist(t.pos, e.pos) <= t.attackRange + e.radius;

  if (!inRange(target)) {
    target = pickTurretTarget(state, t);
    t.targetId = target ? target.id : null;
    if (target && (!t.focusTargetId || t.focusTargetId !== target.id)) {
      t.focusTargetId = target.id;
      t.focusStacks = 0;
    }
  }
  if (target && t.attackCooldown <= 0) {
    let dmg = t.attackDamage;
    if (isChampion(target)) {
      if (t.focusTargetId === target.id) t.focusStacks = Math.min(3, t.focusStacks + 1);
      dmg += t.focusStacks * 55;
    }
    // Turret bolt as projectile for visuals.
    const proj: Projectile = {
      id: state.nextProjectileId++,
      team: t.team,
      pos: { x: t.pos.x, y: t.pos.y },
      vel: { x: 0, y: 0 },
      speed: 1600,
      targetId: target.id,
      sourceId: t.id,
      damage: dmg,
      damageType: "physical",
      radius: 16,
      kind: "auto",
    };
    (proj as any)._apply = (e: Entity) => dealDamage(state, t.id, e, dmg, "physical", { isAuto: true });
    state.projectiles.push(proj);
    t.attackCooldown = 1 / TURRET.attackSpeed;
  }
}

function pickTurretTarget(state: GameState, t: Turret): Entity | null {
  // Priority: enemy champ attacking allied champ nearby, else nearest minion, else champ.
  // 1) champion aggro
  for (const id in state.champions) {
    const c = state.champions[id];
    if (!c.alive || c.team === t.team) continue;
    if (dist(t.pos, c.pos) > t.attackRange + c.radius) continue;
    // is this champ attacking an allied champ near the turret?
    const tgt = c.attackTargetId != null ? state.champions[c.attackTargetId] : null;
    if (tgt && tgt.team === t.team && dist(t.pos, tgt.pos) < t.attackRange + 120 && c.attackWindup > 0) {
      return c;
    }
  }
  // 2) nearest minion
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const id in state.minions) {
    const m = state.minions[id];
    if (!m.alive || m.team === t.team) continue;
    const d = dist(t.pos, m.pos);
    if (d <= t.attackRange + m.radius && d < bestD) { best = m; bestD = d; }
  }
  if (best) return best;
  // 3) nearest champ
  for (const id in state.champions) {
    const c = state.champions[id];
    if (!c.alive || c.team === t.team) continue;
    if (c.buffs.some((b) => b.id === "stealth")) continue;
    const d = dist(t.pos, c.pos);
    if (d <= t.attackRange + c.radius && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function updateNexus(state: GameState, n: Nexus, dt: number) {
  if (n.attackCooldown > 0) n.attackCooldown -= dt;
  let target = getEntity(state, n.targetId);
  const valid = (e: Entity | null) => e && e.alive && e.team !== n.team && dist(n.pos, e.pos) <= n.attackRange + e.radius;
  if (!valid(target)) {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const id in state.minions) {
      const m = state.minions[id];
      if (m.alive && m.team !== n.team) { const d = dist(n.pos, m.pos); if (d <= n.attackRange && d < bestD) { best = m; bestD = d; } }
    }
    if (!best) for (const id in state.champions) {
      const c = state.champions[id];
      if (c.alive && c.team !== n.team) { const d = dist(n.pos, c.pos); if (d <= n.attackRange && d < bestD) { best = c; bestD = d; } }
    }
    target = best;
    n.targetId = best ? best.id : null;
  }
  if (target && n.attackCooldown <= 0) {
    const tgt = target;
    const proj: Projectile = {
      id: state.nextProjectileId++, team: n.team, pos: { x: n.pos.x, y: n.pos.y }, vel: { x: 0, y: 0 }, speed: 1500,
      targetId: tgt.id, sourceId: n.id, damage: n.attackDamage, damageType: "physical", radius: 18, kind: "auto",
    };
    (proj as any)._apply = (e: Entity) => dealDamage(state, n.id, e, n.attackDamage, "physical", { isAuto: true });
    state.projectiles.push(proj);
    n.attackCooldown = 1 / NEXUS.attackSpeed;
  }
}

// ------------------------------------------------------------------
// Soft separation so units don't perfectly stack.
// ------------------------------------------------------------------
function separateUnits(state: GameState) {
  const units: Entity[] = [];
  for (const id in state.champions) if (state.champions[id].alive) units.push(state.champions[id]);
  for (const id in state.minions) units.push(state.minions[id]);
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      const minD = a.radius + b.radius;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const overlap = (minD - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        // Champions push minions more than the reverse.
        const aW = a.kind === "champion" ? 0.35 : 0.5;
        const bW = b.kind === "champion" ? 0.35 : 0.5;
        a.pos.x -= nx * overlap * aW * 2;
        a.pos.y -= ny * overlap * aW * 2;
        b.pos.x += nx * overlap * bW * 2;
        b.pos.y += ny * overlap * bW * 2;
        clampToLane(a);
        clampToLane(b);
      }
    }
  }
}
