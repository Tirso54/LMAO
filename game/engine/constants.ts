// Tunable constants for the LMAO arena.
import type { Team } from "./types";

export const TICK_RATE = 30; // authoritative simulation ticks per second
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20; // snapshots broadcast per second

// World is a wide open battlefield. Blue base left, red base right.
// The map is intentionally HUGE: a central lane road for minions, but
// generous open grass above and below so champions can flank and roam,
// plus a full neutral jungle with camps and two epic monster pits.
export const WORLD = {
  width: 8800,
  height: 3200,
  // The playable band (out of these bounds = the void / death).
  laneTop: 240,
  laneBottom: 2960,
};

// The central minion road (a ribbon down the middle of the field).
export const ROAD_HALF = 200;

export const LANE_Y = (WORLD.laneTop + WORLD.laneBottom) / 2;

// Named bush clearings (yellow-ringed cover circles you can hide in).
export const BUSH_SPOTS: { x: number; y: number; r: number }[] = [
  // Top-side bushes (blue -> red).
  { x: 1500, y: 760,  r: 200 },
  { x: 2700, y: 640,  r: 220 },
  { x: 3900, y: 700,  r: 210 },
  { x: WORLD.width - 3900, y: 700,  r: 210 },
  { x: WORLD.width - 2700, y: 640,  r: 220 },
  { x: WORLD.width - 1500, y: 760,  r: 200 },
  // Bottom-side bushes.
  { x: 1500, y: WORLD.height - 760,  r: 200 },
  { x: 2700, y: WORLD.height - 640,  r: 220 },
  { x: 3900, y: WORLD.height - 700,  r: 210 },
  { x: WORLD.width - 3900, y: WORLD.height - 700, r: 210 },
  { x: WORLD.width - 2700, y: WORLD.height - 640, r: 220 },
  { x: WORLD.width - 1500, y: WORLD.height - 760, r: 200 },
  // Mid inner bushes flanking the middle of the lane.
  { x: 3550, y: LANE_Y - 520, r: 170 },
  { x: 3550, y: LANE_Y + 520, r: 170 },
  { x: WORLD.width - 3550, y: LANE_Y - 520, r: 170 },
  { x: WORLD.width - 3550, y: LANE_Y + 520, r: 170 },
];

// --------------------------------------------------------------------------
// Neutral jungle: real, killable monsters (not just decoration anymore).
// Small camps grant gold + XP + a personal buff. The two epic pits (Dragón
// & Barón) grant a powerful team-wide buff to whoever slays them.
// --------------------------------------------------------------------------
export type MonsterKind = "beetle" | "crab" | "spider" | "dragon" | "baron";

export interface MonsterKindDef {
  hp: number;
  ad: number;
  range: number;
  attackSpeed: number;
  moveSpeed: number;
  armor: number;
  mr: number;
  radius: number;
  level: number;
  gold: number; // gold to the slayer (epics: gold to every ally)
  xp: number;
  respawn: number; // seconds until the camp respawns
  firstSpawn: number; // seconds into the match before it first appears
  buff: MonsterKind; // which reward buff it grants
  epic: boolean;
  name: string;
}

export const MONSTER_KINDS: Record<MonsterKind, MonsterKindDef> = {
  beetle: {
    hp: 1250, ad: 42, range: 130, attackSpeed: 0.8, moveSpeed: 150, armor: 24, mr: 24,
    radius: 36, level: 3, gold: 95, xp: 170, respawn: 60, firstSpawn: 75, buff: "beetle", epic: false,
    name: "Escarabajo de Acero",
  },
  crab: {
    hp: 980, ad: 30, range: 130, attackSpeed: 0.9, moveSpeed: 175, armor: 14, mr: 14,
    radius: 34, level: 2, gold: 70, xp: 125, respawn: 55, firstSpawn: 25, buff: "crab", epic: false,
    name: "Cangrejo Rúnico",
  },
  spider: {
    hp: 1120, ad: 48, range: 320, attackSpeed: 0.8, moveSpeed: 150, armor: 18, mr: 28,
    radius: 36, level: 3, gold: 90, xp: 160, respawn: 60, firstSpawn: 90, buff: "spider", epic: false,
    name: "Araña de Botín",
  },
  dragon: {
    hp: 3800, ad: 95, range: 280, attackSpeed: 0.7, moveSpeed: 140, armor: 38, mr: 38,
    radius: 60, level: 8, gold: 130, xp: 340, respawn: 150, firstSpawn: 240, buff: "dragon", epic: true,
    name: "Draggón Anciano",
  },
  baron: {
    hp: 6400, ad: 135, range: 320, attackSpeed: 0.8, moveSpeed: 150, armor: 52, mr: 52,
    radius: 66, level: 11, gold: 150, xp: 500, respawn: 210, firstSpawn: 360, buff: "baron", epic: true,
    name: "Nashø el Vil",
  },
};

// Camp placements around the big map (symmetric blue/red, plus two mid epics).
export interface CampDef { id: number; x: number; y: number; kind: MonsterKind; }
export const JUNGLE_CAMPS: CampDef[] = [
  // Blue-side jungle.
  { id: 1, x: 1800, y: 640,  kind: "beetle" },
  { id: 2, x: 2500, y: 980,  kind: "spider" },
  { id: 3, x: 1800, y: WORLD.height - 640,  kind: "crab"   },
  { id: 4, x: 2500, y: WORLD.height - 980,  kind: "beetle" },
  // Red-side jungle.
  { id: 5, x: WORLD.width - 1800, y: 640,  kind: "beetle" },
  { id: 6, x: WORLD.width - 2500, y: 980,  kind: "spider" },
  { id: 7, x: WORLD.width - 1800, y: WORLD.height - 640,  kind: "crab"   },
  { id: 8, x: WORLD.width - 2500, y: WORLD.height - 980,  kind: "beetle" },
  // Mid neutral crabs.
  { id: 9,  x: WORLD.width / 2, y: LANE_Y - 720, kind: "crab" },
  { id: 10, x: WORLD.width / 2, y: LANE_Y + 720, kind: "crab" },
  // Epic pits (top = Barón, bottom = Draggón).
  { id: 11, x: WORLD.width / 2, y: 560, kind: "baron"  },
  { id: 12, x: WORLD.width / 2, y: WORLD.height - 560, kind: "dragon" },
];

// Neutral camps grow tougher as the match goes on.
export const MONSTER = {
  aggro: 470, // how close an enemy must be to wake the camp
  leash: 1000, // how far it will chase before resetting to its pit
  hpGrowthPerMin: 0.06,
  adGrowthPerMin: 0.04,
};

// Structure positions along the lane (spread out for the bigger map).
// Typed as Record<Team, …> so entity.team (which now includes "neutral" for
// jungle monsters) can index it; only blue/red exist — neutral is never looked up.
interface StructSide {
  nexus: { x: number; y: number };
  fountain: { x: number; y: number };
  turrets: { x: number; y: number; order: number }[];
  minionSpawn: { x: number; y: number };
}
export const STRUCTURES = {
  blue: {
    nexus: { x: 460, y: LANE_Y },
    fountain: { x: 240, y: LANE_Y },
    turrets: [
      // Base cluster: guardians of the nexus at multiple angles.
      { x: 640,  y: LANE_Y,       order: 0 },  // front guard on the lane
      { x: 500,  y: LANE_Y - 300, order: 0 },  // top-flank guard
      { x: 500,  y: LANE_Y + 300, order: 0 },  // bottom-flank guard
      // Lane turrets stepping out across the map.
      { x: 1250, y: LANE_Y, order: 1 },        // inhibitor
      { x: 2450, y: LANE_Y, order: 2 },        // inner
      { x: 3800, y: LANE_Y, order: 3 },        // outer
    ],
    minionSpawn: { x: 740, y: LANE_Y },
  },
  red: {
    nexus: { x: WORLD.width - 460, y: LANE_Y },
    fountain: { x: WORLD.width - 240, y: LANE_Y },
    turrets: [
      { x: WORLD.width - 640,  y: LANE_Y,       order: 0 },
      { x: WORLD.width - 500,  y: LANE_Y - 300, order: 0 },
      { x: WORLD.width - 500,  y: LANE_Y + 300, order: 0 },
      { x: WORLD.width - 1250, y: LANE_Y, order: 1 },
      { x: WORLD.width - 2450, y: LANE_Y, order: 2 },
      { x: WORLD.width - 3800, y: LANE_Y, order: 3 },
    ],
    minionSpawn: { x: WORLD.width - 740, y: LANE_Y },
  },
} as Record<Team, StructSide>;

// Lane waypoints (a champion/minion follows these toward enemy base).
// Blue walks left->right, red walks right->left (reversed).
export const LANE_WAYPOINTS = [
  { x: 740, y: LANE_Y },
  { x: 1600, y: LANE_Y },
  { x: 2600, y: LANE_Y },
  { x: 3600, y: LANE_Y },
  { x: WORLD.width / 2, y: LANE_Y },
  { x: WORLD.width - 3600, y: LANE_Y },
  { x: WORLD.width - 2600, y: LANE_Y },
  { x: WORLD.width - 1600, y: LANE_Y },
  { x: WORLD.width - 740, y: LANE_Y },
];

export const CHAMPION_RADIUS = 28;
export const MINION_RADIUS = 17;
export const TURRET_RADIUS = 46;
export const NEXUS_RADIUS = 78;

// Global champion tuning levers (the request: bigger, tankier, roomier).
// hpScale fattens every champion's base+level health; msBonus adds flat
// move speed so the huge map is traversable.
export const CHAMP = {
  hpScale: 1.3,
  msBonus: 30,
};

// Minion economy / combat.
export const MINION = {
  spawnInterval: 24, // seconds between waves
  firstSpawnDelay: 8,
  perWave: { melee: 3, caster: 3, cannonEvery: 3 },
  melee: {
    hp: 620,
    ad: 13,
    range: 60,
    attackSpeed: 1.0,
    moveSpeed: 210,
    gold: 22,
    xp: 62,
  },
  caster: {
    hp: 420,
    ad: 26,
    range: 340,
    attackSpeed: 0.8,
    moveSpeed: 210,
    gold: 17,
    xp: 42,
  },
  cannon: {
    hp: 1250,
    ad: 44,
    range: 420,
    attackSpeed: 0.7,
    moveSpeed: 200,
    gold: 42,
    xp: 95,
  },
  // Per-minute scaling multipliers.
  hpGrowthPerMin: 0.10,
  adGrowthPerMin: 0.06,
};

export const TURRET = {
  hp: 2600,
  ad: 185,
  range: 500,
  attackSpeed: 0.9,
  gold: 250,
  // Bonus armor/MR so early dives are punished.
  armor: 42,
  mr: 42,
};

export const NEXUS = {
  hp: 4600,
  ad: 125,
  range: 480,
  attackSpeed: 0.7,
  armor: 60,
  mr: 60,
};

// Siege multipliers vs structures (turrets/nexus). Minions are the main siege
// engines, but champions also hit structures harder so a team that wins a fight
// can actually crack a turret in its window instead of stalemating forever.
export const MINION_SIEGE_MULT = 3.2;
export const CHAMP_SIEGE_MULT = 1.6;

// Champion base leveling.
export const XP_PER_LEVEL = (level: number) => 180 + (level - 1) * 100;
export const MAX_LEVEL = 18;

// Gold.
export const STARTING_GOLD = 500;
export const PASSIVE_GOLD_PER_SEC = 4.5; // ARAM-style trickle
export const PASSIVE_XP_PER_SEC = 4.2; // ambient XP so the match keeps pace
export const KILL_GOLD_BASE = 300;
export const ASSIST_GOLD = 150;

// Respawn time: a snappy fixed 5 seconds regardless of level.
export const RESPAWN_TIME = (_level: number) => 5;

// Fountain regen multiplier.
export const FOUNTAIN_REGEN = 0.15; // fraction of max hp/mana per second

// Combat helpers.
export const RESIST_MULT = (resist: number) => 100 / (100 + Math.max(resist, -80));

// XP share radius for nearby minion kills.
export const XP_SHARE_RADIUS = 900;

export const RECALL_TIME = 4;

// Camera / render helpers.
export const FOG_ENABLED = false;
