import { CHAMPIONS, AbilityDef } from "./champions";
import {
  Champion,
  GameState,
  Projectile,
  Zone,
  Entity,
  Team,
  DamageType,
  Buff,
} from "./types";
import {
  dist,
  norm,
  sub,
  add,
  scale,
  angleTo,
  fromAngle,
  clamp,
  v,
} from "./math";
import {
  addBuff,
  dealDamage,
  enemyTeam,
  getEntity,
  healEntity,
  isChampion,
} from "./combat";

export interface CastContext {
  state: GameState;
  champ: Champion;
  rank: number; // 1-based
  def: AbilityDef;
  x: number;
  y: number;
  targetId: number | null;
}

export function abilityBase(def: AbilityDef, rank: number): number {
  if (!def.damage) return 0;
  return def.damage[Math.min(rank - 1, def.damage.length - 1)] || 0;
}

export function abilityDamage(def: AbilityDef, rank: number, champ: Champion): number {
  let d = abilityBase(def, rank);
  if (def.adRatio) d += def.adRatio * champ.attackDamage;
  if (def.apRatio) d += def.apRatio * champ.abilityPower;
  return d;
}

function spawnSkillshot(
  state: GameState,
  champ: Champion,
  def: AbilityDef,
  toX: number,
  toY: number,
  opts: Partial<Projectile> = {}
): Projectile {
  const dir = norm(sub({ x: toX, y: toY }, champ.pos));
  if (dir.x === 0 && dir.y === 0) dir.x = champ.team === "blue" ? 1 : -1;
  const speed = def.speed || 1400;
  const proj: Projectile = {
    id: state.nextProjectileId++,
    team: champ.team,
    pos: { x: champ.pos.x, y: champ.pos.y },
    vel: scale(dir, speed),
    speed,
    targetId: null,
    sourceId: champ.id,
    damage: abilityDamage(def, 1, champ),
    damageType: def.damageType || "magic",
    radius: (def.width || 60) / 2,
    kind: "skillshot",
    spellId: def.key,
    maxRange: def.range,
    traveled: 0,
    hits: [],
    pierce: false,
    ...opts,
  };
  state.projectiles.push(proj);
  state.fx.push({ t: "cast", x: champ.pos.x, y: champ.pos.y, team: champ.team, spellId: def.key });
  return proj;
}

function spawnZone(state: GameState, z: Partial<Zone> & { pos: { x: number; y: number } }): Zone {
  const zone: Zone = {
    id: state.nextEntityId++,
    spellId: "",
    team: "blue",
    sourceId: 0,
    radius: 100,
    time: 4,
    kind: "aura",
    ...z,
  } as Zone;
  state.zones.push(zone);
  return zone;
}

function enemiesInRadius(state: GameState, team: Team, center: { x: number; y: number }, radius: number): Entity[] {
  const out: Entity[] = [];
  const push = (e: Entity) => {
    if (e.alive && e.team !== team && dist(e.pos, center) <= radius + e.radius) out.push(e);
  };
  for (const id in state.champions) push(state.champions[id]);
  for (const id in state.minions) push(state.minions[id]);
  for (const id in state.turrets) push(state.turrets[id]);
  for (const id in state.nexuses) push(state.nexuses[id]);
  return out;
}

function alliesInRadius(state: GameState, champ: Champion, radius: number): Champion[] {
  const out: Champion[] = [];
  for (const id in state.champions) {
    const c = state.champions[id];
    if (c.alive && c.team === champ.team && dist(c.pos, champ.pos) <= radius) out.push(c);
  }
  return out;
}

function blinkNear(champ: Champion, target: { x: number; y: number }, standoff: number) {
  const dir = norm(sub(champ.pos, target));
  if (dir.x === 0 && dir.y === 0) dir.x = 1;
  const from = { x: champ.pos.x, y: champ.pos.y };
  champ.pos = { x: target.x + dir.x * standoff, y: target.y + dir.y * standoff };
  champ.face = angleTo(from, champ.pos);
  return from;
}

function dashTo(state: GameState, champ: Champion, toX: number, toY: number, maxDist: number) {
  const dir = norm(sub({ x: toX, y: toY }, champ.pos));
  const d = Math.min(maxDist, dist(champ.pos, { x: toX, y: toY }));
  const from = { x: champ.pos.x, y: champ.pos.y };
  champ.pos = add(champ.pos, scale(dir, d));
  champ.face = angleTo(from, champ.pos);
  state.fx.push({ t: "beam", x: from.x, y: from.y, x2: champ.pos.x, y2: champ.pos.y, team: champ.team, spellId: "dash" });
  return from;
}

function applyCC(target: Champion, kind: Buff["kind"], time: number, magnitude = 1, label?: string) {
  addBuff(target, { id: `cc_${kind}`, kind, time, magnitude, label });
}

// Each handler returns true if the cast was consumed (mana/cd applied by caller).
export const ABILITY_HANDLERS: Record<string, (ctx: CastContext) => boolean> = {
  // ---- YASØU ----
  yasou_q: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const now = state.time;
    const stacks = champ.passiveData.qStacks || 0;
    const lastStack = champ.passiveData.qStackTime || -999;
    const active = now - lastStack < 6 ? stacks : 0;
    if (active >= 2) {
      // Whirlwind: knockup skillshot.
      const p = spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
        damage: abilityDamage(def, rank, champ),
        maxRange: 900,
        width: 90,
        radius: 45,
        pierce: true,
        onHit: "airborne",
        onHitDuration: 0.9,
        speed: 1000,
      });
      p.spellId = "yasou_q3";
      champ.passiveData.qStacks = 0;
    } else {
      const p = spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
        damage: abilityDamage(def, rank, champ),
        maxRange: def.range,
      });
      champ.passiveData.qStacks = active + 1;
      champ.passiveData.qStackTime = now;
    }
    return true;
  },
  yasou_w: (ctx) => {
    const { state, champ, def } = ctx;
    const ang = angleTo(champ.pos, { x: ctx.x, y: ctx.y });
    const center = add(champ.pos, fromAngle(ang, 130));
    spawnZone(state, {
      pos: center,
      spellId: "yasou_w",
      team: champ.team,
      sourceId: champ.id,
      radius: (def.width || 260) / 2,
      time: 3.5,
      kind: "wall",
      angle: ang,
      length: def.width || 260,
    });
    state.fx.push({ t: "cast", x: center.x, y: center.y, team: champ.team, spellId: "yasou_w" });
    return true;
  },
  yasou_e: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!target || target.team === champ.team || !target.alive) return false;
    if (dist(champ.pos, target.pos) > def.range) return false;
    const key = `dashed_${target.id}`;
    if ((champ.passiveData[key] || 0) > state.time) return false; // can't re-dash same target
    blinkNear(champ, target.pos, target.radius + 20);
    champ.passiveData[key] = state.time + 8;
    dealDamage(state, champ.id, target, abilityDamage(def, rank, champ), def.damageType || "magic");
    state.fx.push({ t: "beam", x: champ.pos.x, y: champ.pos.y, x2: target.pos.x, y2: target.pos.y, team: champ.team, spellId: "yasou_e" });
    return true;
  },
  yasou_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!isChampion(target) || target.team === champ.team || !target.alive) return false;
    // Only valid on airborne targets in this bootleg version, but we allow any for fun.
    blinkNear(champ, target.pos, target.radius + 30);
    dealDamage(state, champ.id, target, abilityDamage(def, rank, champ), def.damageType || "physical");
    state.fx.push({ t: "aoe", x: target.pos.x, y: target.pos.y, team: champ.team, radius: 120, spellId: "yasou_r" });
    return true;
  },

  // ---- TEEMOO ----
  teemoo_q: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!target || target.team === champ.team || !target.alive) return false;
    if (dist(champ.pos, target.pos) > def.range) return false;
    dealDamage(state, champ.id, target, abilityDamage(def, rank, champ), def.damageType || "magic");
    if (isChampion(target)) {
      const dur = [1.5, 1.75, 2, 2.25, 2.5][rank - 1];
      target.passiveData.blindUntil = state.time + dur;
      addBuff(target, { id: "blind", kind: "slow", time: dur, magnitude: 0.2, label: "Blinded" });
    }
    state.fx.push({ t: "cast", x: target.pos.x, y: target.pos.y, team: champ.team, spellId: "teemoo_q" });
    return true;
  },
  teemoo_w: (ctx) => {
    const { champ } = ctx;
    addBuff(champ, { id: "movequick", kind: "speed", time: 3, magnitude: 0.35, label: "Move Quick" });
    return true;
  },
  teemoo_e: () => false, // passive on-hit poison, resolved in auto-attack code
  teemoo_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    spawnZone(state, {
      pos: { x: ctx.x, y: ctx.y },
      spellId: "teemoo_r",
      team: champ.team,
      sourceId: champ.id,
      radius: def.radius || 140,
      time: 300,
      kind: "trap",
      damage: abilityDamage(def, rank, champ),
      damageType: "magic",
      slow: 0.5,
      armed: true,
    });
    return true;
  },

  // ---- ASHEE ----
  ashee_q: (ctx) => {
    const { champ } = ctx;
    addBuff(champ, { id: "rapidfire", kind: "attackspeed", time: 4, magnitude: 1.0, label: "Rapid Firesale" });
    champ.passiveData.rapidShots = 5;
    return true;
  },
  ashee_w: (ctx) => {
    const { state, champ, def, rank } = ctx;
    // Cone of 5 arrows.
    const baseAng = angleTo(champ.pos, { x: ctx.x, y: ctx.y });
    for (let i = -2; i <= 2; i++) {
      const a = baseAng + i * 0.14;
      const dst = add(champ.pos, fromAngle(a, def.range));
      spawnSkillshot(state, champ, def, dst.x, dst.y, {
        damage: abilityDamage(def, rank, champ),
        onHit: "slow",
        onHitMagnitude: 0.3,
        onHitDuration: 2,
        speed: 1500,
        width: def.width ? def.width / 4 : 60,
        radius: 30,
      });
    }
    return true;
  },
  ashee_e: (ctx) => {
    const { state, champ } = ctx;
    addBuff(champ, { id: "hawkshot", kind: "speed", time: 2, magnitude: 0.3, label: "Hawkshot" });
    state.fx.push({ t: "ping", x: ctx.x, y: ctx.y, team: champ.team });
    return true;
  },
  ashee_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
      damage: abilityDamage(def, rank, champ),
      onHit: "stun",
      onHitDuration: 1.6 + rank * 0.2,
      speed: def.speed || 1600,
      pierce: false,
      radius: (def.width || 130) / 2,
      maxRange: def.range,
    });
    return true;
  },

  // ---- GARÓN ----
  garon_q: (ctx) => {
    const { champ, def, rank } = ctx;
    // Cleanse slows, empower next auto.
    champ.buffs = champ.buffs.filter((b) => b.kind !== "slow");
    champ.passiveData.qEmpower = abilityDamage(def, rank, champ);
    champ.passiveData.qEmpowerUntil = ctx.state.time + 5;
    addBuff(champ, { id: "garonq_ms", kind: "speed", time: 3, magnitude: 0.3, label: "Decisive" });
    return true;
  },
  garon_w: (ctx) => {
    const { champ, rank } = ctx;
    const shield = 60 + rank * 40 + champ.maxHp * 0.05;
    addBuff(champ, { id: "garonw_shield", kind: "shield", time: 4, magnitude: shield, label: "Courage" });
    addBuff(champ, { id: "garonw_dr", kind: "invuln", time: 0.001, magnitude: 0 }); // brief no-op; DR handled below
    champ.passiveData.damageReductionUntil = ctx.state.time + 2.5;
    champ.passiveData.damageReduction = 0.3;
    return true;
  },
  garon_e: (ctx) => {
    const { champ } = ctx;
    // Spin: create a persistent aura on self for its duration.
    champ.passiveData.spinUntil = ctx.state.time + 3;
    champ.passiveData.spinRank = ctx.rank;
    addBuff(champ, { id: "garon_spin", kind: "haste", time: 3, magnitude: 0, label: "Spin2Win" });
    return true;
  },
  garon_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!isChampion(target) || target.team === champ.team || !target.alive) return false;
    if (dist(champ.pos, target.pos) > def.range) return false;
    const missing = 1 - target.hp / target.maxHp;
    const dmg = abilityBase(def, rank) + missing * (200 + rank * 120);
    dealDamage(state, champ.id, target, dmg, "true");
    state.fx.push({ t: "aoe", x: target.pos.x, y: target.pos.y, team: champ.team, radius: 110, spellId: "garon_r", color: "#ffe08a" });
    return true;
  },

  // ---- JINIX ----
  jinix_q: (ctx) => {
    const { champ } = ctx;
    champ.passiveData.rocketMode = champ.passiveData.rocketMode ? 0 : 1;
    return true;
  },
  jinix_w: (ctx) => {
    const { state, champ, def, rank } = ctx;
    spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
      damage: abilityDamage(def, rank, champ),
      onHit: "slow",
      onHitMagnitude: 0.5,
      onHitDuration: 1.5,
      speed: def.speed || 3200,
      radius: 30,
    });
    return true;
  },
  jinix_e: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const ang = angleTo(champ.pos, { x: ctx.x, y: ctx.y });
    for (let i = -1; i <= 1; i++) {
      const c = add({ x: ctx.x, y: ctx.y }, fromAngle(ang + Math.PI / 2, i * 90));
      spawnZone(state, {
        pos: c,
        spellId: "jinix_e",
        team: champ.team,
        sourceId: champ.id,
        radius: 70,
        time: 5,
        kind: "trap",
        damage: abilityDamage(def, rank, champ),
        damageType: "magic",
        rootDuration: 1.5,
        armed: true,
      });
    }
    return true;
  },
  jinix_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const p = spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
      damage: abilityDamage(def, rank, champ),
      speed: def.speed || 1700,
      radius: (def.width || 140) / 2,
      maxRange: def.range,
      onHit: "rocket",
    });
    p.spellId = "jinix_r";
    return true;
  },

  // ---- LUUX ----
  luux_q: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const p = spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
      damage: abilityDamage(def, rank, champ),
      onHit: "root",
      onHitDuration: 1 + rank * 0.2,
      speed: def.speed || 1200,
      pierce: true,
      radius: (def.width || 55) / 2,
    });
    p.data = { pierceLimit: 2 } as any;
    return true;
  },
  luux_w: (ctx) => {
    const { state, champ } = ctx;
    const shield = 60 + champ.abilityPower * 0.5;
    for (const ally of alliesInRadius(state, champ, 700)) {
      addBuff(ally, { id: "luux_shield", kind: "shield", time: 3, magnitude: shield, label: "Barrier" });
      state.fx.push({ t: "shield", x: ally.pos.x, y: ally.pos.y, team: champ.team });
    }
    return true;
  },
  luux_e: (ctx) => {
    const { state, champ, def, rank } = ctx;
    spawnZone(state, {
      pos: { x: ctx.x, y: ctx.y },
      spellId: "luux_e",
      team: champ.team,
      sourceId: champ.id,
      radius: def.radius || 300,
      time: 5,
      kind: "delayed",
      fuse: 5,
      damage: abilityDamage(def, rank, champ),
      damageType: "magic",
      slow: 0.35,
    });
    return true;
  },
  luux_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    // Instant beam: damage all enemies in a long rectangle.
    const ang = angleTo(champ.pos, { x: ctx.x, y: ctx.y });
    const end = add(champ.pos, fromAngle(ang, def.range));
    const dmg = abilityDamage(def, rank, champ);
    const halfW = (def.width || 220) / 2;
    for (const e of allEnemyEntities(state, champ.team)) {
      if (segHit(champ.pos, end, e.pos, halfW + e.radius)) {
        // Detonate Illumination mark bonus if present.
        let d = dmg;
        if (isChampion(e) && (e.passiveData.illumUntil || 0) > state.time) {
          d += 40 + champ.abilityPower * 0.3;
          e.passiveData.illumUntil = 0;
        }
        dealDamage(state, champ.id, e, d, "magic");
      }
    }
    state.fx.push({ t: "beam", x: champ.pos.x, y: champ.pos.y, x2: end.x, y2: end.y, team: champ.team, spellId: "luux_r", radius: halfW });
    champ.face = ang;
    return true;
  },

  // ---- BLÏTZCRONK ----
  blitz_q: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const p = spawnSkillshot(state, champ, def, ctx.x, ctx.y, {
      damage: abilityDamage(def, rank, champ),
      onHit: "pull",
      speed: def.speed || 1900,
      radius: (def.width || 70) / 2,
      maxRange: def.range,
    });
    p.spellId = "blitz_q";
    return true;
  },
  blitz_w: (ctx) => {
    const { champ } = ctx;
    addBuff(champ, { id: "overdrive_ms", kind: "speed", time: 5, magnitude: 0.7, label: "Overdrive" });
    addBuff(champ, { id: "overdrive_as", kind: "attackspeed", time: 5, magnitude: 0.6 });
    return true;
  },
  blitz_e: (ctx) => {
    const { champ, state } = ctx;
    champ.passiveData.powerFistUntil = state.time + 6;
    return true;
  },
  blitz_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const dmg = abilityDamage(def, rank, champ);
    for (const e of enemiesInRadius(state, champ.team, champ.pos, def.radius || 600)) {
      dealDamage(state, champ.id, e, dmg, "magic");
      if (isChampion(e)) applyCC(e, "root", 0.5, 1, "Silenced"); // brief silence approximated as root-lite
    }
    state.fx.push({ t: "aoe", x: champ.pos.x, y: champ.pos.y, team: champ.team, radius: def.radius || 600, spellId: "blitz_r", color: "#7fe3ff" });
    return true;
  },

  // ---- DARIÔS ----
  darios_q: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const inner = enemiesInRadius(state, champ.team, champ.pos, def.radius || 425);
    const dmg = abilityDamage(def, rank, champ);
    let champsHit = 0;
    for (const e of inner) {
      const dd = dist(champ.pos, e.pos);
      const outer = dd > (def.radius || 425) * 0.45;
      dealDamage(state, champ.id, e, outer ? dmg : dmg * 0.6, "physical");
      if (isChampion(e)) {
        applyBleed(champ, e, state);
        champsHit++;
      }
    }
    if (champsHit > 0) healEntity(champ, 15 + champsHit * (10 + champ.maxHp * 0.02));
    state.fx.push({ t: "aoe", x: champ.pos.x, y: champ.pos.y, team: champ.team, radius: def.radius || 425, spellId: "darios_q", color: "#ff6b5e" });
    return true;
  },
  darios_w: (ctx) => {
    const { champ, def, rank, state } = ctx;
    champ.passiveData.wEmpower = abilityDamage(def, rank, champ);
    champ.passiveData.wEmpowerUntil = state.time + 5;
    return true;
  },
  darios_e: (ctx) => {
    const { state, champ, def } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!isChampion(target) || target.team === champ.team || !target.alive) return false;
    if (dist(champ.pos, target.pos) > def.range) return false;
    // Pull target toward champ.
    const dir = norm(sub(champ.pos, target.pos));
    target.pos = add(champ.pos, scale(dir, -(champ.radius + target.radius + 10)));
    applyCC(target, "slow", 1.2, 0.4, "Apprehended");
    applyBleed(champ, target, state);
    state.fx.push({ t: "beam", x: champ.pos.x, y: champ.pos.y, x2: target.pos.x, y2: target.pos.y, team: champ.team, spellId: "darios_e" });
    return true;
  },
  darios_r: (ctx) => {
    const { state, champ, def, rank } = ctx;
    const target = getEntity(state, ctx.targetId);
    if (!isChampion(target) || target.team === champ.team || !target.alive) return false;
    if (dist(champ.pos, target.pos) > def.range) return false;
    blinkNear(champ, target.pos, target.radius + 20);
    const bleed = target.buffs.filter((b) => b.id.startsWith("bleed")).length;
    const missing = 1 - target.hp / target.maxHp;
    const dmg = abilityBase(def, rank) * (1 + bleed * 0.2) + missing * (150 + rank * 100);
    dealDamage(state, champ.id, target, dmg, "true");
    state.fx.push({ t: "aoe", x: target.pos.x, y: target.pos.y, team: champ.team, radius: 100, spellId: "darios_r", color: "#ff3b30" });
    return true;
  },
};

function applyBleed(source: Champion, target: Champion, state: GameState) {
  const stacks = target.buffs.filter((b) => b.id.startsWith("bleed_")).length;
  const id = `bleed_${stacks + 1}_${state.tick % 1000}`;
  if (stacks >= 5) return;
  addBuff(target, {
    id,
    kind: "dot",
    time: 5,
    magnitude: 0,
    tickDamage: 6 + source.attackDamage * 0.12,
    tickType: "physical",
    tickAcc: 0,
    sourceId: source.id,
    label: "Bleed",
  });
}

export function allEnemyEntities(state: GameState, team: Team): Entity[] {
  const out: Entity[] = [];
  const add2 = (e: Entity) => {
    if (e.alive && e.team !== team) out.push(e);
  };
  for (const id in state.champions) add2(state.champions[id]);
  for (const id in state.minions) add2(state.minions[id]);
  for (const id in state.turrets) add2(state.turrets[id]);
  for (const id in state.nexuses) add2(state.nexuses[id]);
  return out;
}

// Segment vs circle helper for instant beams.
export function segHit(a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }, r: number): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / ab2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy <= r * r;
}
