// Tunable constants for the LMAO arena.

export const TICK_RATE = 30; // authoritative simulation ticks per second
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20; // snapshots broadcast per second

// World is a wide open battlefield. Blue base left, red base right.
// The map is intentionally roomy: a central lane road for minions, but
// generous open grass above and below so champions can flank and roam.
export const WORLD = {
  width: 6400,
  height: 2400,
  // The playable band (out of these bounds = the void / death).
  laneTop: 160,
  laneBottom: 2240,
};

// The central minion road (a narrower ribbon down the middle of the field).
export const ROAD_HALF = 170;

// Named bush clearings (yellow-ringed cover circles you can hide in).
export const BUSH_SPOTS: { x: number; y: number; r: number }[] = [
  // Top-side bushes.
  { x: 1200, y: 620,  r: 180 },
  { x: 2000, y: 520,  r: 210 },
  { x: 3200, y: 560,  r: 220 },
  { x: 4400, y: 520,  r: 210 },
  { x: 5200, y: 620,  r: 180 },
  // Bottom-side bushes.
  { x: 1200, y: 1780, r: 180 },
  { x: 2000, y: 1880, r: 210 },
  { x: 3200, y: 1840, r: 220 },
  { x: 4400, y: 1880, r: 210 },
  { x: 5200, y: 1780, r: 180 },
  // Mid inner bushes near lane.
  { x: 2600, y: 900,  r: 150 },
  { x: 2600, y: 1500, r: 150 },
  { x: 3800, y: 900,  r: 150 },
  { x: 3800, y: 1500, r: 150 },
];

// Neutral jungle camps (visual monsters, decorative for now).
export const JUNGLE_CAMPS: { x: number; y: number; kind: "beetle" | "crab" | "spider" }[] = [
  { x: 1600, y: 340,  kind: "beetle" },
  { x: 1600, y: 2060, kind: "beetle" },
  { x: 4800, y: 340,  kind: "beetle" },
  { x: 4800, y: 2060, kind: "beetle" },
  { x: 2700, y: 340,  kind: "crab"   },
  { x: 3700, y: 2060, kind: "crab"   },
  { x: 3200, y: 260,  kind: "spider" },
  { x: 3200, y: 2140, kind: "spider" },
];

export const LANE_Y = (WORLD.laneTop + WORLD.laneBottom) / 2;

// Structure positions along the lane.
export const STRUCTURES = {
  blue: {
    nexus: { x: 380, y: LANE_Y },
    fountain: { x: 200, y: LANE_Y },
    turrets: [
      // Base cluster: guardians of the nexus at multiple angles.
      { x: 560,  y: LANE_Y,      order: 0 },   // front guard on the lane
      { x: 420,  y: LANE_Y - 220, order: 0 },  // top-flank guard
      { x: 420,  y: LANE_Y + 220, order: 0 },  // bottom-flank guard
      // Lane turrets stepping out to the map.
      { x: 900,  y: LANE_Y, order: 1 },        // inhibitor
      { x: 1500, y: LANE_Y, order: 2 },        // inner
      { x: 2200, y: LANE_Y, order: 3 },        // outer
    ],
    minionSpawn: { x: 620, y: LANE_Y },
  },
  red: {
    nexus: { x: WORLD.width - 380, y: LANE_Y },
    fountain: { x: WORLD.width - 200, y: LANE_Y },
    turrets: [
      { x: WORLD.width - 560,  y: LANE_Y,      order: 0 },
      { x: WORLD.width - 420,  y: LANE_Y - 220, order: 0 },
      { x: WORLD.width - 420,  y: LANE_Y + 220, order: 0 },
      { x: WORLD.width - 900,  y: LANE_Y, order: 1 },
      { x: WORLD.width - 1500, y: LANE_Y, order: 2 },
      { x: WORLD.width - 2200, y: LANE_Y, order: 3 },
    ],
    minionSpawn: { x: WORLD.width - 620, y: LANE_Y },
  },
};

// Lane waypoints (a champion/minion follows these toward enemy base).
// Blue walks left->right, red walks right->left (reversed).
export const LANE_WAYPOINTS = [
  { x: 620, y: LANE_Y },
  { x: 1500, y: LANE_Y },
  { x: 2200, y: LANE_Y },
  { x: 2900, y: LANE_Y },
  { x: 3500, y: LANE_Y },
  { x: 4200, y: LANE_Y },
  { x: 4900, y: LANE_Y },
  { x: WORLD.width - 620, y: LANE_Y },
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
