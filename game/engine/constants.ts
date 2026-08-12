// Tunable constants for the LMAO arena.
import type { Team } from "./types";

export const TICK_RATE = 30; // authoritative simulation ticks per second
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20; // snapshots broadcast per second

// The arena is a huge SQUARE battlefield with three lanes forming a ring,
// exactly like the reference art: blue base in the bottom-left corner, red
// base in the top-right corner, a top lane and a bot lane hugging the map
// edges, a mid lane running the diagonal, and a full jungle between them
// with camps and two epic monster pits.
export const WORLD = {
  width: 9600,
  height: 9600,
  // The playable band (out of these bounds = the void / death).
  laneTop: 140,
  laneBottom: 9460,
};

// Half-width of a lane road (the dirt ribbon minions walk down).
export const ROAD_HALF = 170;

// Legacy convenience: the middle of the map.
export const LANE_Y = WORLD.height / 2;

export type Pt = { x: number; y: number };

// Point-symmetry through the map center: maps a blue-side point to its red
// twin, so the whole map is perfectly mirrored.
const mirror = (p: Pt): Pt => ({ x: WORLD.width - p.x, y: WORLD.height - p.y });
const mirrorPath = (path: Pt[]): Pt[] => path.map(mirror).reverse();

export type LaneId = "top" | "mid" | "bot";
export const LANES: LaneId[] = ["top", "mid", "bot"];

// Base anchors (corners of the square).
const BLUE_NEXUS: Pt = { x: 1000, y: 8600 };
const BLUE_FOUNTAIN: Pt = { x: 640, y: 8960 };

// --------------------------------------------------------------------------
// Lane paths (always written blue -> red). Minions of each team walk these.
// --------------------------------------------------------------------------
// Top lane: up the left edge, then right along the top edge.
const TOP_PATH: Pt[] = [
  { x: 820, y: 7900 },
  { x: 700, y: 6200 },
  { x: 700, y: 3600 },
  { x: 900, y: 2000 },
  { x: 2000, y: 900 },
  { x: 3600, y: 700 },
  { x: 6200, y: 700 },
  { x: 7900, y: 820 },
];
// Bot lane: the exact mirror (down/right along the bottom, then up the right edge).
const BOT_PATH: Pt[] = mirrorPath(TOP_PATH);
// Mid lane: straight down the diagonal through the center of the map.
const MID_PATH: Pt[] = [
  { x: 1500, y: 8100 },
  { x: 2600, y: 7000 },
  { x: 3700, y: 5900 },
  { x: 4800, y: 4800 },
  { x: 5900, y: 3700 },
  { x: 7000, y: 2600 },
  { x: 8100, y: 1500 },
];

export const LANE_PATHS: Record<LaneId, Pt[]> = {
  top: TOP_PATH,
  mid: MID_PATH,
  bot: BOT_PATH,
};

// The path as a given team walks it (red walks it in reverse).
export function lanePathFor(lane: LaneId, team: Team): Pt[] {
  const p = LANE_PATHS[lane];
  return team === "red" ? [...p].reverse() : p;
}

// ---- Polyline helpers (used for turret placement, bots and rendering) ----
function segLengths(path: Pt[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    out.push(Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y));
  }
  return out;
}

/** Point at normalized arc-length t (0 = blue end, 1 = red end). */
export function pointAlong(path: Pt[], t: number): Pt {
  const segs = segLengths(path);
  const total = segs.reduce((a, b) => a + b, 0);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (want <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : Math.min(1, want / segs[i]);
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * f,
        y: path[i].y + (path[i + 1].y - path[i].y) * f,
      };
    }
    want -= segs[i];
  }
  return path[path.length - 1];
}

/** How far along the lane (0..1, blue end -> red end) a position sits. */
export function progressAlong(path: Pt[], p: Pt): number {
  const segs = segLengths(path);
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const ax = path[i].x, ay = path[i].y;
    const bx = path[i + 1].x, by = path[i + 1].y;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const f = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2));
    const px = ax + dx * f, py = ay + dy * f;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestD) {
      bestD = d;
      best = (acc + segs[i] * f) / total;
    }
    acc += segs[i];
  }
  return best;
}

/** Shortest distance from a point to any lane road (used by the renderer). */
export function distToNearestLane(p: Pt): number {
  let best = Infinity;
  for (const lane of LANES) {
    const path = LANE_PATHS[lane];
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i].x, ay = path[i].y;
      const dx = path[i + 1].x - ax, dy = path[i + 1].y - ay;
      const len2 = dx * dx + dy * dy || 1;
      const f = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2));
      const d = Math.hypot(p.x - (ax + dx * f), p.y - (ay + dy * f));
      if (d < best) best = d;
    }
  }
  return best;
}

// Perpendicular offset from a lane, used to seed lane bushes symmetrically.
function laneOffset(path: Pt[], t: number, off: number): Pt {
  const a = pointAlong(path, Math.max(0, t - 0.01));
  const b = pointAlong(path, Math.min(1, t + 0.01));
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const c = pointAlong(path, t);
  return { x: c.x + (-dy / len) * off, y: c.y + (dx / len) * off };
}

// Named bush clearings (yellow-ringed cover circles you can hide in).
// Every lane gets cover on both flanks, and the mirror keeps it fair.
function buildBushSpots(): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  const laneTs = [0.18, 0.34, 0.5, 0.66, 0.82];
  for (const lane of LANES) {
    const path = LANE_PATHS[lane];
    for (const t of laneTs) {
      out.push({ ...laneOffset(path, t, 420), r: 190 });
      out.push({ ...laneOffset(path, t, -420), r: 190 });
    }
  }
  // Deep-jungle cover around the two epic pits and the river crossings.
  const jungle: Pt[] = [
    { x: 2500, y: 3100 }, { x: 3900, y: 2400 }, { x: 2800, y: 4400 },
    { x: 4200, y: 6000 }, { x: 2200, y: 6600 }, { x: 3400, y: 7600 },
  ];
  for (const j of jungle) {
    out.push({ x: j.x, y: j.y, r: 210 });
    const m = mirror(j);
    out.push({ x: m.x, y: m.y, r: 210 });
  }
  // Drop anything that ended up outside the arena or on top of a road.
  return out.filter(
    (b) =>
      b.x > 300 && b.x < WORLD.width - 300 &&
      b.y > 300 && b.y < WORLD.height - 300
  );
}

export const BUSH_SPOTS: { x: number; y: number; r: number }[] = buildBushSpots();

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
// Blue-side camps; every one of them is mirrored onto the red side below.
const BLUE_CAMPS: { x: number; y: number; kind: MonsterKind }[] = [
  // Upper-left jungle quadrant (between top lane and mid lane).
  { x: 1700, y: 5900, kind: "beetle" },
  { x: 2600, y: 5100, kind: "spider" },
  { x: 1900, y: 4300, kind: "crab"   },
  { x: 3200, y: 6100, kind: "beetle" },
  // Lower-right jungle quadrant (between mid lane and bot lane).
  { x: 3100, y: 8000, kind: "beetle" },
  { x: 4400, y: 7500, kind: "spider" },
  { x: 5400, y: 8300, kind: "crab"   },
  { x: 4000, y: 8800, kind: "beetle" },
];

export const JUNGLE_CAMPS: CampDef[] = (() => {
  const out: CampDef[] = [];
  let id = 1;
  for (const c of BLUE_CAMPS) out.push({ id: id++, ...c });
  for (const c of BLUE_CAMPS) {
    const m = mirror(c);
    out.push({ id: id++, x: m.x, y: m.y, kind: c.kind });
  }
  // River scuttlers, on the perpendicular running corner to corner.
  out.push({ id: id++, x: 2900, y: 2900, kind: "crab" });
  out.push({ id: id++, x: 6700, y: 6700, kind: "crab" });
  // Epic pits: Barón in the upper-left river, Draggón in the lower-right river.
  out.push({ id: id++, x: 3700, y: 3700, kind: "baron" });
  out.push({ id: id++, x: 5900, y: 5900, kind: "dragon" });
  return out;
})();

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
  turrets: { x: number; y: number; order: number; lane?: LaneId }[];
  minionSpawn: { x: number; y: number };
  laneSpawns: Record<LaneId, { x: number; y: number }>;
}

// Three turrets guard every lane: outer, inner and inhibitor, spaced along
// the lane path. Blue's sit at these fractions; red's at the mirrored ones.
const TURRET_TS: { t: number; order: number }[] = [
  { t: 0.30, order: 3 }, // outer
  { t: 0.19, order: 2 }, // inner
  { t: 0.10, order: 1 }, // inhibitor
];

function laneTurrets(team: Team): { x: number; y: number; order: number; lane: LaneId }[] {
  const out: { x: number; y: number; order: number; lane: LaneId }[] = [];
  for (const lane of LANES) {
    const path = LANE_PATHS[lane];
    for (const { t, order } of TURRET_TS) {
      const p = pointAlong(path, team === "blue" ? t : 1 - t);
      out.push({ x: p.x, y: p.y, order, lane });
    }
  }
  return out;
}

// Base cluster: the nexus guardians, offsets relative to the blue nexus.
const BASE_TURRET_OFFSETS: Pt[] = [
  { x: 420, y: -60 },   // guarding the mid/bot approach
  { x: 60, y: -420 },   // guarding the top approach
  { x: 340, y: -340 },  // diagonal keep guard
];

function baseTurrets(team: Team): { x: number; y: number; order: number }[] {
  const nexus = team === "blue" ? BLUE_NEXUS : mirror(BLUE_NEXUS);
  const sign = team === "blue" ? 1 : -1;
  return BASE_TURRET_OFFSETS.map((o) => ({
    x: nexus.x + o.x * sign,
    y: nexus.y + o.y * sign,
    order: 0,
  }));
}

function laneSpawnsFor(team: Team): Record<LaneId, { x: number; y: number }> {
  const pick = (lane: LaneId) => {
    const path = lanePathFor(lane, team);
    return { x: path[0].x, y: path[0].y };
  };
  return { top: pick("top"), mid: pick("mid"), bot: pick("bot") };
}

function sideFor(team: Team): StructSide {
  const nexus = team === "blue" ? BLUE_NEXUS : mirror(BLUE_NEXUS);
  const fountain = team === "blue" ? BLUE_FOUNTAIN : mirror(BLUE_FOUNTAIN);
  return {
    nexus,
    fountain,
    turrets: [...baseTurrets(team), ...laneTurrets(team)],
    // Legacy single spawn point (kept for anything not lane-aware).
    minionSpawn: { x: nexus.x + (team === "blue" ? 260 : -260), y: nexus.y - (team === "blue" ? 260 : -260) },
    laneSpawns: laneSpawnsFor(team),
  };
}

export const STRUCTURES = {
  blue: sideFor("blue"),
  red: sideFor("red"),
} as Record<Team, StructSide>;

// Legacy export: the mid lane read as a plain waypoint list (blue -> red).
export const LANE_WAYPOINTS = MID_PATH;

export const CHAMPION_RADIUS = 28;
export const MINION_RADIUS = 17;
export const TURRET_RADIUS = 46;
export const NEXUS_RADIUS = 78;

// Global champion tuning levers (the request: bigger, tankier, roomier).
// hpScale fattens every champion's base+level health; msBonus adds flat
// move speed so the huge map is traversable.
export const CHAMP = {
  hpScale: 1.3,
  // The arena is enormous now (a full three-lane square), so champions get a
  // healthy flat move-speed bonus to make roaming between lanes viable.
  msBonus: 90,
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
    moveSpeed: 260,
    gold: 22,
    xp: 62,
  },
  caster: {
    hp: 420,
    ad: 26,
    range: 340,
    attackSpeed: 0.8,
    moveSpeed: 260,
    gold: 17,
    xp: 42,
  },
  cannon: {
    hp: 1250,
    ad: 44,
    range: 420,
    attackSpeed: 0.7,
    moveSpeed: 250,
    gold: 42,
    xp: 95,
  },
  // Per-minute scaling multipliers.
  hpGrowthPerMin: 0.10,
  adGrowthPerMin: 0.06,
};

export const TURRET = {
  // Three lanes means three times the siege pressure, so structures are much
  // beefier than they were on the old single-lane map.
  hp: 5600,
  ad: 185,
  range: 500,
  attackSpeed: 0.9,
  gold: 250,
  // Bonus armor/MR so early dives are punished.
  armor: 42,
  mr: 42,
};

export const NEXUS = {
  hp: 14000,
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
