import {
  Champion,
  DamageType,
  Entity,
  GameState,
  Minion,
  Monster,
  Nexus,
  Team,
  Turret,
  Buff,
} from "./types";
import {
  ASSIST_GOLD,
  KILL_GOLD_BASE,
  RESIST_MULT,
  RESPAWN_TIME,
  TURRET,
  NEXUS,
  XP_PER_LEVEL,
  MAX_LEVEL,
  XP_SHARE_RADIUS,
  MONSTER_KINDS,
  MonsterKind,
} from "./constants";
import { CHAMPIONS } from "./champions";
import { dist } from "./math";
import { recomputeChampStats } from "./stats";

export function enemyTeam(t: Team): Team {
  return t === "blue" ? "red" : "blue";
}

export function allEntities(state: GameState): Entity[] {
  const out: Entity[] = [];
  for (const id in state.champions) out.push(state.champions[id]);
  for (const id in state.minions) out.push(state.minions[id]);
  for (const id in state.turrets) out.push(state.turrets[id]);
  for (const id in state.nexuses) out.push(state.nexuses[id]);
  for (const id in state.monsters) out.push(state.monsters[id]);
  return out;
}

export function getEntity(state: GameState, id: number | null): Entity | null {
  if (id == null) return null;
  return (
    state.champions[id] ||
    state.minions[id] ||
    state.turrets[id] ||
    state.nexuses[id] ||
    state.monsters[id] ||
    null
  );
}

export function isMonster(e: Entity | null): e is Monster {
  return !!e && e.kind === "monster";
}

export function isChampion(e: Entity | null): e is Champion {
  return !!e && e.kind === "champion";
}

export function resistFor(target: Entity, type: DamageType): number {
  if (type === "true") return 0;
  if (target.kind === "champion") {
    const c = target as Champion;
    return type === "physical" ? c.armor : c.magicResist;
  }
  if (target.kind === "turret") {
    return type === "physical" ? TURRET.armor : TURRET.mr;
  }
  if (target.kind === "nexus") {
    return type === "physical" ? NEXUS.armor : NEXUS.mr;
  }
  if (target.kind === "monster") {
    const m = target as Monster;
    return type === "physical" ? m.armor : m.magicResist;
  }
  return 0; // minions have no resists in this bootleg edition
}

export interface DamageOpts {
  ignoreShield?: boolean;
  isAuto?: boolean;
  isCrit?: boolean;
  lifestealFactor?: number; // override lifesteal application
  applyOnHit?: boolean;
}

// Core damage application. Returns actual damage dealt (post mitigation/shields).
export function dealDamage(
  state: GameState,
  sourceId: number | null,
  target: Entity,
  rawAmount: number,
  type: DamageType,
  opts: DamageOpts = {}
): number {
  if (!target.alive || rawAmount <= 0) return 0;
  const source = sourceId != null ? getEntity(state, sourceId) : null;

  // Invulnerable check.
  if (isChampion(target)) {
    if (target.buffs.some((b) => b.kind === "invuln")) return 0;
  }

  let amount = rawAmount * RESIST_MULT(resistFor(target, type));

  // Void staff style magic pen (simplified): handled at source stat level already.

  // Shields absorb.
  if (isChampion(target) && !opts.ignoreShield) {
    let remaining = amount;
    for (const b of target.buffs) {
      if (b.kind === "shield" && b.magnitude > 0) {
        const absorbed = Math.min(b.magnitude, remaining);
        b.magnitude -= absorbed;
        remaining -= absorbed;
        if (remaining <= 0) break;
      }
    }
    amount = remaining;
  }

  if (amount <= 0) {
    // Still register aggro for shield-only hits.
    if (isChampion(target) && sourceId != null) target.recentDamagers[sourceId] = 0;
    return 0;
  }

  target.hp -= amount;

  // Track damagers for kill/assist credit + turret aggro reset.
  if (isChampion(target) && sourceId != null) {
    target.recentDamagers[sourceId] = 0;
  }

  // Thornmail-style reflect: target reflects a bit of physical melee auto damage.
  if (
    opts.isAuto &&
    type === "physical" &&
    isChampion(target) &&
    target.items.includes("thornmail") &&
    isChampion(source)
  ) {
    const reflect = 25 + target.maxHp * 0.0; // flat bootleg reflect
    source.hp -= reflect * RESIST_MULT(source.armor);
    if (source.hp <= 0) killEntity(state, source, target.id);
  }

  // Lifesteal / spell vamp for champion sources.
  if (isChampion(source)) {
    if (opts.isAuto && source.lifesteal > 0) {
      const heal = amount * source.lifesteal;
      source.hp = Math.min(source.maxHp, source.hp + heal);
    }
  }

  // Sterak / mana barrier style triggers handled in champion passive tick.

  if (target.hp <= 0) {
    killEntity(state, target, sourceId);
  }

  return amount;
}

export function healEntity(target: Entity, amount: number) {
  if (!target.alive) return;
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

export function addBuff(champ: Champion, buff: Buff) {
  // Replace same-id buff (refresh), otherwise push.
  const existing = champ.buffs.findIndex((b) => b.id === buff.id);
  if (existing >= 0) {
    champ.buffs[existing] = buff;
  } else {
    champ.buffs.push(buff);
  }
}

export function hasBuff(champ: Champion, kind: Buff["kind"]): boolean {
  return champ.buffs.some((b) => b.kind === kind && b.time > 0);
}

export function isCC(champ: Champion): boolean {
  return champ.buffs.some(
    (b) => (b.kind === "stun" || b.kind === "root" || b.kind === "airborne") && b.time > 0
  );
}

export function isStunnedOrAirborne(champ: Champion): boolean {
  return champ.buffs.some(
    (b) => (b.kind === "stun" || b.kind === "airborne") && b.time > 0
  );
}

export function slowMultiplier(champ: Champion): number {
  let mult = 1;
  for (const b of champ.buffs) {
    if (b.kind === "slow" && b.time > 0) {
      mult *= 1 - b.magnitude;
    }
  }
  return Math.max(0.2, mult);
}

// Handle a killed entity: rewards, kill feed, respawn scheduling, structure win.
export function killEntity(state: GameState, target: Entity, killerId: number | null) {
  if (!target.alive) return;
  target.alive = false;
  target.hp = 0;

  const killer = killerId != null ? getEntity(state, killerId) : null;

  if (target.kind === "minion") {
    const m = target as Minion;
    grantMinionRewards(state, m, killer);
    delete state.minions[m.id];
    return;
  }

  if (target.kind === "turret") {
    const t = target as Turret;
    // Team gold bounty split-ish: give killer + nearby.
    state.killFeed.push({
      id: state.nextFxId++,
      killer: killer && isChampion(killer) ? killer.displayName : "Los minions",
      victim: `Torreta ${t.team === "blue" ? "Azul" : "Roja"}`,
      killerTeam: enemyTeam(t.team),
      victimTeam: t.team,
      time: state.time,
      isTurret: true,
    });
    // Global gold to the destroying team's champions.
    for (const id in state.champions) {
      const c = state.champions[id];
      if (c.team === enemyTeam(t.team)) c.gold += 150;
    }
    if (isChampion(killer)) killer.gold += 100;
    state.fx.push({ t: "death", x: t.pos.x, y: t.pos.y, team: t.team, radius: 90 });
    delete state.turrets[t.id];
    return;
  }

  if (target.kind === "nexus") {
    const n = target as Nexus;
    state.fx.push({ t: "death", x: n.pos.x, y: n.pos.y, team: n.team, radius: 160 });
    state.killFeed.push({
      id: state.nextFxId++,
      killer: "El equipo enemigo",
      victim: `Nexo ${n.team === "blue" ? "Azul" : "Rojo"}`,
      killerTeam: enemyTeam(n.team),
      victimTeam: n.team,
      time: state.time,
      isNexus: true,
    });
    state.phase = "ended";
    state.winner = enemyTeam(n.team);
    return;
  }

  if (target.kind === "monster") {
    const mo = target as Monster;
    grantMonsterRewards(state, mo, killer);
    // Don't delete — mark cleared and let the camp regrow.
    mo.respawnTimer = MONSTER_KINDS[mo.monsterKind as MonsterKind].respawn;
    mo.targetId = null;
    state.fx.push({ t: "death", x: mo.pos.x, y: mo.pos.y, team: "neutral", radius: mo.epic ? 160 : 80 });
    return;
  }

  if (target.kind === "champion") {
    const victim = target as Champion;
    handleChampionDeath(state, victim, killer);
  }
}

// Reward the slayer of a jungle monster: gold + XP + a buff. Epic monsters
// (Draggón / Nashø) hand a powerful buff and gold to the whole team.
function grantMonsterRewards(state: GameState, mo: Monster, killer: Entity | null) {
  let slayer: Champion | null = isChampion(killer) ? killer : null;
  if (!slayer) {
    // Credit the nearest enemy champion if a pet/minion got the last hit.
    let best: Champion | null = null;
    let bd = Infinity;
    for (const id in state.champions) {
      const c = state.champions[id];
      if (!c.alive) continue;
      const d = dist(c.pos, mo.pos);
      if (d < bd) { bd = d; best = c; }
    }
    slayer = best;
  }
  if (!slayer) return;
  const team = slayer.team;

  if (mo.epic) {
    // Epic bounty: gold + XP + team-wide buff to every living ally.
    for (const id in state.champions) {
      const c = state.champions[id];
      if (c.team !== team) continue;
      c.gold += mo.goldValue;
      if (c.alive) {
        grantXp(state, c, mo.xpValue / 2);
        applyMonsterBuff(state, c, mo.buff);
      }
    }
    state.killFeed.push({
      id: state.nextFxId++,
      killer: slayer.displayName,
      victim: mo.name,
      killerTeam: team,
      victimTeam: "neutral",
      time: state.time,
    });
    state.fx.push({ t: "text", x: mo.pos.x, y: mo.pos.y - 40, team, text: `¡${mo.name} abatido!`, color: mo.monsterKind === "baron" ? "#c39bff" : "#ff9a5a" });
  } else {
    // Small camp: gold + shared XP to the slayer (and nearby allies) + buff.
    slayer.gold += mo.goldValue;
    slayer.cs += 1;
    const near: Champion[] = [];
    for (const id in state.champions) {
      const c = state.champions[id];
      if (c.alive && c.team === team && dist(c.pos, mo.pos) <= XP_SHARE_RADIUS) near.push(c);
    }
    if (near.length === 0) near.push(slayer);
    const share = mo.xpValue / Math.sqrt(near.length);
    for (const c of near) grantXp(state, c, share);
    applyMonsterBuff(state, slayer, mo.buff);
  }
}

function applyMonsterBuff(state: GameState, champ: Champion, kind: string) {
  switch (kind) {
    case "beetle":
      addBuff(champ, { id: "jbuff_beetle", kind: "attackspeed", time: 90, magnitude: 0.35, label: "Escarabajo" });
      state.fx.push({ t: "text", x: champ.pos.x, y: champ.pos.y - 30, team: champ.team, text: "+Vel. Ataque", color: "#f6d060" });
      break;
    case "crab":
      addBuff(champ, { id: "jbuff_crab", kind: "speed", time: 120, magnitude: 0.18, label: "Cangrejo" });
      state.fx.push({ t: "text", x: champ.pos.x, y: champ.pos.y - 30, team: champ.team, text: "+Velocidad", color: "#7fe3ff" });
      break;
    case "spider":
      healEntity(champ, champ.maxHp * 0.22);
      addBuff(champ, { id: "jbuff_spider", kind: "shield", time: 10, magnitude: champ.maxHp * 0.08, label: "Araña" });
      champ.gold += 150;
      state.fx.push({ t: "text", x: champ.pos.x, y: champ.pos.y - 30, team: champ.team, text: "+Botín", color: "#c73b3b" });
      break;
    case "dragon":
      addBuff(champ, { id: "jbuff_dragon", kind: "empower", time: 120, magnitude: 0, ad: 14, ap: 18, label: "Draggón" });
      break;
    case "baron":
      addBuff(champ, { id: "jbuff_baron", kind: "empower", time: 150, magnitude: 0, ad: 26, ap: 32, armor: 18, mr: 18, label: "Nashø" });
      addBuff(champ, { id: "jbuff_baron_ms", kind: "speed", time: 150, magnitude: 0.12, label: "Nashø" });
      break;
  }
}

function grantMinionRewards(state: GameState, m: Minion, killer: Entity | null) {
  // Gold goes to the last hitter if it's a champion.
  if (isChampion(killer)) {
    killer.gold += m.goldValue;
    killer.cs += 1;
  }
  // XP shared among nearby champions of the killing team (and last hitter).
  const beneficiaries: Champion[] = [];
  const centralTeam = killer && isChampion(killer) ? killer.team : null;
  for (const id in state.champions) {
    const c = state.champions[id];
    if (!c.alive) continue;
    if (centralTeam && c.team !== centralTeam) continue;
    if (dist(c.pos, m.pos) <= XP_SHARE_RADIUS) beneficiaries.push(c);
  }
  if (beneficiaries.length === 0 && isChampion(killer)) beneficiaries.push(killer);
  const share = beneficiaries.length > 0 ? m.xpValue / Math.sqrt(beneficiaries.length) : 0;
  for (const c of beneficiaries) grantXp(state, c, share);
}

export function grantXp(state: GameState, champ: Champion, amount: number) {
  if (champ.level >= MAX_LEVEL) return;
  champ.xp += amount;
  while (champ.level < MAX_LEVEL && champ.xp >= XP_PER_LEVEL(champ.level)) {
    champ.xp -= XP_PER_LEVEL(champ.level);
    champ.level += 1;
    onLevelUp(state, champ);
  }
  if (champ.level >= MAX_LEVEL) champ.xp = 0;
}

function onLevelUp(state: GameState, champ: Champion) {
  const prevMax = champ.maxHp;
  const prevMaxMana = champ.maxMana;
  recomputeChampStats(champ);
  // Heal by the max hp/mana gained so leveling feels good.
  champ.hp = Math.min(champ.maxHp, champ.hp + (champ.maxHp - prevMax));
  champ.mana = Math.min(champ.maxMana, champ.mana + (champ.maxMana - prevMaxMana));
  state.fx.push({ t: "level", x: champ.pos.x, y: champ.pos.y, team: champ.team });
  // Auto-grant an ability point suggestion is handled by input; but bots get auto-level.
}

function handleChampionDeath(state: GameState, victim: Champion, killer: Entity | null) {
  victim.deaths += 1;
  victim.respawnTimer = RESPAWN_TIME(victim.level);
  victim.moveTarget = null;
  victim.attackTargetId = null;
  victim.buffs = victim.buffs.filter((b) => false); // clear buffs on death
  victim.recallTimer = 0;

  // Compute shutdown bounty from victim streak.
  const streak = victim.passiveData.killStreak || 0;
  const shutdownBonus = Math.min(streak, 5) * 40;

  // Kill / assist gold.
  const bounty = KILL_GOLD_BASE + shutdownBonus;
  let killerChamp: Champion | null = isChampion(killer) ? killer : null;

  // If a non-champion (turret/minion) got the last hit, credit the most recent champ damager.
  if (!killerChamp) {
    let best: Champion | null = null;
    let bestTime = Infinity;
    for (const idStr in victim.recentDamagers) {
      const id = Number(idStr);
      const t = victim.recentDamagers[id];
      const c = state.champions[id];
      if (c && c.team !== victim.team && t < bestTime) {
        best = c;
        bestTime = t;
      }
    }
    killerChamp = best;
  }

  const assisters: Champion[] = [];
  for (const idStr in victim.recentDamagers) {
    const id = Number(idStr);
    const c = state.champions[id];
    if (c && c.team !== victim.team && c !== killerChamp) assisters.push(c);
  }

  let multi = 0;
  if (killerChamp) {
    killerChamp.gold += bounty;
    killerChamp.kills += 1;
    killerChamp.passiveData.killStreak = (killerChamp.passiveData.killStreak || 0) + 1;
    state.teamKills[killerChamp.team] += 1;
    // multikill tracking
    const last = killerChamp.passiveData.lastKillTime || -999;
    if (state.time - last < 10) {
      killerChamp.passiveData.multiKill = (killerChamp.passiveData.multiKill || 1) + 1;
    } else {
      killerChamp.passiveData.multiKill = 1;
    }
    killerChamp.passiveData.lastKillTime = state.time;
    multi = killerChamp.passiveData.multiKill;
    // Jinix passive: get excited on takedown.
    triggerTakedownPassive(killerChamp);
  }
  for (const a of assisters) {
    a.gold += ASSIST_GOLD;
    a.assists += 1;
    triggerTakedownPassive(a);
  }

  // Reset victim streak.
  victim.passiveData.killStreak = 0;

  state.killFeed.push({
    id: state.nextFxId++,
    killer: killerChamp ? killerChamp.displayName : "The Bootleg Bazaar",
    victim: victim.displayName,
    killerTeam: killerChamp ? killerChamp.team : enemyTeam(victim.team),
    victimTeam: victim.team,
    time: state.time,
    multi: multi > 1 ? multi : undefined,
    shutdown: shutdownBonus > 0,
  });
  state.fx.push({ t: "death", x: victim.pos.x, y: victim.pos.y, team: victim.team, radius: 70 });
}

function triggerTakedownPassive(champ: Champion) {
  const def = CHAMPIONS[champ.championId];
  if (!def) return;
  if (champ.championId === "jinix") {
    addBuff(champ, {
      id: "getexcited_ms",
      kind: "speed",
      time: 4,
      magnitude: 0.5,
      label: "Get Excited!",
    });
    addBuff(champ, {
      id: "getexcited_as",
      kind: "attackspeed",
      time: 4,
      magnitude: 0.75,
    });
  }
}

// Trim recentDamagers older than 5s (called each tick).
export function decayDamagers(champ: Champion, dt: number) {
  for (const idStr in champ.recentDamagers) {
    champ.recentDamagers[Number(idStr)] += dt;
    if (champ.recentDamagers[Number(idStr)] > 5) {
      delete champ.recentDamagers[Number(idStr)];
    }
  }
}
