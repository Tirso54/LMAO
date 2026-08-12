import {
  Champion,
  GameConfig,
  GameState,
  Monster,
  Nexus,
  PlayerSlot,
  Team,
  Turret,
} from "./types";
import {
  CHAMPION_RADIUS,
  JUNGLE_CAMPS,
  LaneId,
  MONSTER_KINDS,
  MonsterKind,
  NEXUS,
  NEXUS_RADIUS,
  STARTING_GOLD,
  STRUCTURES,
  TURRET,
  TURRET_RADIUS,
} from "./constants";
import { CHAMPIONS } from "./champions";
import { recomputeChampStats } from "./stats";

let entitySeq = 1;

export function createChampion(
  state: GameState,
  slot: PlayerSlot
): Champion {
  const def = CHAMPIONS[slot.championId] || CHAMPIONS.garon;
  const id = state.nextEntityId++;
  const fountain = STRUCTURES[slot.team].fountain;
  const champ: Champion = {
    id,
    kind: "champion",
    team: slot.team,
    pos: { x: fountain.x, y: fountain.y + (Math.random() * 60 - 30) },
    face: slot.team === "blue" ? 0 : Math.PI,
    hp: 1,
    maxHp: 1,
    radius: CHAMPION_RADIUS,
    alive: true,
    championId: def.id,
    ownerId: slot.playerId,
    displayName: slot.name,
    isBot: slot.isBot,
    mana: 1,
    maxMana: 1,
    level: 1,
    xp: 0,
    gold: STARTING_GOLD,
    attackDamage: def.stats.ad,
    abilityPower: 0,
    armor: def.stats.armor,
    magicResist: def.stats.mr,
    attackRange: def.stats.attackRange,
    attackSpeed: def.stats.attackSpeed,
    moveSpeed: def.stats.moveSpeed,
    hpRegen: def.stats.hpRegen,
    manaRegen: def.stats.manaRegen,
    critChance: 0,
    lifesteal: 0,
    cooldownReduction: 0,
    attackWindup: 0,
    attackCooldown: 0,
    attackTargetId: null,
    moveTarget: null,
    holdPosition: false,
    abilities: [
      { cd: 0, rank: 0, data: {} },
      { cd: 0, rank: 0, data: {} },
      { cd: 0, rank: 0, data: {} },
      { cd: 0, rank: 0, data: {} },
    ],
    passiveData: {},
    buffs: [],
    items: [],
    respawnTimer: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    recentDamagers: {},
    inFountain: true,
    lastInputSeq: 0,
    recallTimer: 0,
  };
  recomputeChampStats(champ);
  champ.hp = champ.maxHp;
  champ.mana = champ.maxMana;
  slot.championEntityId = id;
  state.champions[id] = champ;
  return champ;
}

function makeTurret(state: GameState, team: Team, x: number, y: number, order: number, lane: LaneId | null): Turret {
  const id = state.nextEntityId++;
  const t: Turret = {
    id,
    kind: "turret",
    team,
    pos: { x, y },
    face: 0,
    hp: TURRET.hp,
    maxHp: TURRET.hp,
    radius: TURRET_RADIUS,
    alive: true,
    lane,
    attackDamage: TURRET.ad,
    attackRange: TURRET.range,
    attackCooldown: 0,
    targetId: null,
    order,
    focusTargetId: null,
    focusStacks: 0,
    goldValue: TURRET.gold,
  };
  state.turrets[id] = t;
  return t;
}

function makeNexus(state: GameState, team: Team, x: number, y: number): Nexus {
  const id = state.nextEntityId++;
  const n: Nexus = {
    id,
    kind: "nexus",
    team,
    pos: { x, y },
    face: 0,
    hp: NEXUS.hp,
    maxHp: NEXUS.hp,
    radius: NEXUS_RADIUS,
    alive: true,
    attackDamage: NEXUS.ad,
    attackRange: NEXUS.range,
    attackCooldown: 0,
    targetId: null,
  };
  state.nexuses[id] = n;
  return n;
}

function makeMonster(state: GameState, camp: { id: number; x: number; y: number; kind: MonsterKind }): Monster {
  const def = MONSTER_KINDS[camp.kind];
  const id = state.nextEntityId++;
  const m: Monster = {
    id,
    kind: "monster",
    team: "neutral",
    pos: { x: camp.x, y: camp.y },
    face: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    alive: false, // dormant until firstSpawn elapses
    monsterKind: camp.kind,
    epic: def.epic,
    campId: camp.id,
    home: { x: camp.x, y: camp.y },
    level: def.level,
    attackDamage: def.ad,
    attackRange: def.range,
    attackSpeed: def.attackSpeed,
    attackCooldown: 0,
    moveSpeed: def.moveSpeed,
    armor: def.armor,
    magicResist: def.mr,
    targetId: null,
    goldValue: def.gold,
    xpValue: def.xp,
    respawnTimer: def.firstSpawn,
    buff: def.buff,
    name: def.name,
  };
  state.monsters[id] = m;
  return m;
}

export function createInitialState(config: GameConfig): GameState {
  const state: GameState = {
    tick: 0,
    time: 0,
    phase: "countdown",
    winner: null,
    nextEntityId: 1,
    nextProjectileId: 1,
    nextFxId: 1,
    champions: {},
    minions: {},
    turrets: {},
    nexuses: {},
    monsters: {},
    projectiles: [],
    zones: [],
    fx: [],
    killFeed: [],
    minionSpawnTimer: 0,
    minionWave: 0,
    config,
    teamKills: { blue: 0, red: 0, neutral: 0 },
    teamGold: { blue: 0, red: 0, neutral: 0 },
  };

  // Structures.
  for (const team of ["blue", "red"] as Team[]) {
    const s = STRUCTURES[team];
    for (const t of s.turrets) makeTurret(state, team, t.x, t.y, t.order, t.lane ?? null);
    makeNexus(state, team, s.nexus.x, s.nexus.y);
  }

  // Neutral jungle camps + epic monsters.
  for (const camp of JUNGLE_CAMPS) makeMonster(state, camp);

  return state;
}

export function spawnAllChampions(state: GameState, slots: PlayerSlot[]) {
  for (const slot of slots) {
    createChampion(state, slot);
  }
}
