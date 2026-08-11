// Tunable constants for the LMAO arena.

export const TICK_RATE = 30; // authoritative simulation ticks per second
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20; // snapshots broadcast per second

// World is a wide open battlefield. Blue base left, red base right.
// The map is intentionally roomy: a central lane road for minions, but
// generous open grass above and below so champions can flank and roam.
export const WORLD = {
  width: 4200,
  height: 1500,
  // The playable band (out of these bounds = the void / death).
  laneTop: 150,
  laneBottom: 1350,
};

// The central minion road (a narrower ribbon down the middle of the field).
export const ROAD_HALF = 150;

export const LANE_Y = (WORLD.laneTop + WORLD.laneBottom) / 2;

// Structure positions along the lane.
export const STRUCTURES = {
  blue: {
    nexus: { x: 320, y: LANE_Y },
    fountain: { x: 160, y: LANE_Y },
    turrets: [
      { x: 720, y: LANE_Y, order: 0 },
      { x: 1180, y: LANE_Y, order: 1 },
    ],
    minionSpawn: { x: 470, y: LANE_Y },
  },
  red: {
    nexus: { x: WORLD.width - 320, y: LANE_Y },
    fountain: { x: WORLD.width - 160, y: LANE_Y },
    turrets: [
      { x: WORLD.width - 720, y: LANE_Y, order: 0 },
      { x: WORLD.width - 1180, y: LANE_Y, order: 1 },
    ],
    minionSpawn: { x: WORLD.width - 470, y: LANE_Y },
  },
};

// Lane waypoints (a champion/minion follows these toward enemy base).
// Blue walks left->right, red walks right->left (reversed).
export const LANE_WAYPOINTS = [
  { x: 470, y: LANE_Y },
  { x: 900, y: LANE_Y },
  { x: 1400, y: LANE_Y },
  { x: 2100, y: LANE_Y },
  { x: 2800, y: LANE_Y },
  { x: 3300, y: LANE_Y },
  { x: WORLD.width - 470, y: LANE_Y },
];

export const CHAMPION_RADIUS = 26;
export const MINION_RADIUS = 16;
export const TURRET_RADIUS = 42;
export const NEXUS_RADIUS = 70;

// Minion economy / combat.
export const MINION = {
  spawnInterval: 24, // seconds between waves
  firstSpawnDelay: 8,
  perWave: { melee: 3, caster: 3, cannonEvery: 3 },
  melee: {
    hp: 480,
    ad: 12,
    range: 60,
    attackSpeed: 1.0,
    moveSpeed: 200,
    gold: 21,
    xp: 60,
  },
  caster: {
    hp: 320,
    ad: 24,
    range: 340,
    attackSpeed: 0.8,
    moveSpeed: 200,
    gold: 16,
    xp: 40,
  },
  cannon: {
    hp: 900,
    ad: 40,
    range: 420,
    attackSpeed: 0.7,
    moveSpeed: 190,
    gold: 40,
    xp: 92,
  },
  // Per-minute scaling multipliers.
  hpGrowthPerMin: 0.09,
  adGrowthPerMin: 0.06,
};

export const TURRET = {
  hp: 2500,
  ad: 165,
  range: 480,
  attackSpeed: 0.9,
  gold: 250,
  // Bonus armor/MR so early dives are punished.
  armor: 40,
  mr: 40,
};

export const NEXUS = {
  hp: 4200,
  ad: 120,
  range: 460,
  attackSpeed: 0.7,
  armor: 60,
  mr: 60,
};

// Champion base leveling.
export const XP_PER_LEVEL = (level: number) => 180 + (level - 1) * 100;
export const MAX_LEVEL = 18;

// Gold.
export const STARTING_GOLD = 500;
export const PASSIVE_GOLD_PER_SEC = 4.5; // ARAM-style trickle
export const PASSIVE_XP_PER_SEC = 4.2; // ambient XP so the match keeps pace
export const KILL_GOLD_BASE = 300;
export const ASSIST_GOLD = 150;

// Respawn seconds by level.
export const RESPAWN_TIME = (level: number) => Math.min(6 + level * 2.2, 55);

// Fountain regen multiplier.
export const FOUNTAIN_REGEN = 0.15; // fraction of max hp/mana per second

// Combat helpers.
export const RESIST_MULT = (resist: number) => 100 / (100 + Math.max(resist, -80));

// XP share radius for nearby minion kills.
export const XP_SHARE_RADIUS = 900;

export const RECALL_TIME = 4;

// Camera / render helpers.
export const FOG_ENABLED = false;
