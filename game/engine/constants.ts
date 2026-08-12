// Tunable constants for the LMAO arena.

export const TICK_RATE = 30; // authoritative simulation ticks per second
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20; // snapshots broadcast per second

// World is an ENORMOUS open battlefield. Blue base left, red base right.
// The playable area now fills almost the entire map, so there is no tight
// band with a hard green boundary line — champions can roam a huge field,
// with a central minion road and towers scattered across the whole arena.
export const WORLD = {
  width: 9600,
  height: 6000,
  // The playable band spans nearly the whole world height: the field feels
  // limitless, with only a thin margin of decorative outer grass.
  laneTop: 220,
  laneBottom: 5780,
};

// The central minion road (a wide dirt highway down the middle of the field).
export const ROAD_HALF = 230;

// Named bush clearings (yellow-ringed cover circles you can hide in),
// scattered generously across the enormous field.
export const BUSH_SPOTS: { x: number; y: number; r: number }[] = [
  // Upper field.
  { x: 1600, y: 1200, r: 230 },
  { x: 3000, y: 1500, r: 260 },
  { x: 4800, y: 1000, r: 280 },
  { x: 6600, y: 1500, r: 260 },
  { x: 8000, y: 1200, r: 230 },
  // Lower field.
  { x: 1600, y: 4800, r: 230 },
  { x: 3000, y: 4500, r: 260 },
  { x: 4800, y: 5000, r: 280 },
  { x: 6600, y: 4500, r: 260 },
  { x: 8000, y: 4800, r: 230 },
  // Mid inner bushes flanking the central road.
  { x: 3400, y: 2400, r: 200 },
  { x: 3400, y: 3600, r: 200 },
  { x: 6200, y: 2400, r: 200 },
  { x: 6200, y: 3600, r: 200 },
  { x: 4800, y: 2050, r: 220 },
  { x: 4800, y: 3950, r: 220 },
];

// Neutral jungle camps (visual monsters, decorative for now), spread across
// the four quadrants of the big field.
export const JUNGLE_CAMPS: { x: number; y: number; kind: "beetle" | "crab" | "spider" }[] = [
  { x: 2200, y: 900,  kind: "beetle" },
  { x: 2200, y: 5100, kind: "beetle" },
  { x: 7400, y: 900,  kind: "beetle" },
  { x: 7400, y: 5100, kind: "beetle" },
  { x: 3900, y: 700,  kind: "crab"   },
  { x: 5700, y: 5300, kind: "crab"   },
  { x: 5700, y: 700,  kind: "crab"   },
  { x: 3900, y: 5300, kind: "crab"   },
  { x: 4800, y: 560,  kind: "spider" },
  { x: 4800, y: 5440, kind: "spider" },
];

export const LANE_Y = (WORLD.laneTop + WORLD.laneBottom) / 2;

// Structure positions. Towers are distributed across the ENTIRE field — a
// central lane defence plus flanking towers guarding the top and bottom of
// the huge arena — instead of sitting on a single line down the middle.
export const STRUCTURES = {
  blue: {
    nexus: { x: 520, y: LANE_Y },
    fountain: { x: 280, y: LANE_Y },
    turrets: [
      // Base cluster: guardians of the nexus at multiple angles.
      { x: 780,  y: LANE_Y,        order: 0 },  // front guard on the lane
      { x: 620,  y: LANE_Y - 720,  order: 0 },  // top base guard
      { x: 620,  y: LANE_Y + 720,  order: 0 },  // bottom base guard
      // Central lane towers stepping out toward mid.
      { x: 1500, y: LANE_Y, order: 1 },         // inhibitor
      { x: 2600, y: LANE_Y, order: 2 },         // inner
      { x: 3800, y: LANE_Y, order: 3 },         // outer
      // Top-flank towers spread across the upper field.
      { x: 1700, y: LANE_Y - 1900, order: 1 },  // top inner
      { x: 3100, y: LANE_Y - 2300, order: 2 },  // top outer
      // Bottom-flank towers spread across the lower field.
      { x: 1700, y: LANE_Y + 1900, order: 1 },  // bottom inner
      { x: 3100, y: LANE_Y + 2300, order: 2 },  // bottom outer
    ],
    minionSpawn: { x: 860, y: LANE_Y },
  },
  red: {
    nexus: { x: WORLD.width - 520, y: LANE_Y },
    fountain: { x: WORLD.width - 280, y: LANE_Y },
    turrets: [
      { x: WORLD.width - 780,  y: LANE_Y,        order: 0 },
      { x: WORLD.width - 620,  y: LANE_Y - 720,  order: 0 },
      { x: WORLD.width - 620,  y: LANE_Y + 720,  order: 0 },
      { x: WORLD.width - 1500, y: LANE_Y, order: 1 },
      { x: WORLD.width - 2600, y: LANE_Y, order: 2 },
      { x: WORLD.width - 3800, y: LANE_Y, order: 3 },
      { x: WORLD.width - 1700, y: LANE_Y - 1900, order: 1 },
      { x: WORLD.width - 3100, y: LANE_Y - 2300, order: 2 },
      { x: WORLD.width - 1700, y: LANE_Y + 1900, order: 1 },
      { x: WORLD.width - 3100, y: LANE_Y + 2300, order: 2 },
    ],
    minionSpawn: { x: WORLD.width - 860, y: LANE_Y },
  },
};

// Lane waypoints (a champion/minion follows these toward enemy base).
// Blue walks left->right, red walks right->left (reversed).
export const LANE_WAYPOINTS = [
  { x: 860, y: LANE_Y },
  { x: 1500, y: LANE_Y },
  { x: 2600, y: LANE_Y },
  { x: 3800, y: LANE_Y },
  { x: 4800, y: LANE_Y },
  { x: 5800, y: LANE_Y },
  { x: 7000, y: LANE_Y },
  { x: WORLD.width - 860, y: LANE_Y },
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
