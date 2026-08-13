import { Snapshot, ChampSnap, MinionSnap, MonsterSnap, StructSnap, ProjSnap, ZoneSnap } from "../net/protocol";
import { FxEvent, Team } from "../engine/types";
import { CHAMPIONS } from "../engine/champions";
import {
  WORLD, STRUCTURES, ROAD_HALF, BUSH_SPOTS, JUNGLE_CAMPS, MONSTER_KINDS,
  LANES, LANE_PATHS, distToNearestLane,
} from "../engine/constants";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const TEAM_COLOR: Record<Team, string> = { blue: "#3aa0ff", red: "#ff5a52", neutral: "#e0b96a" };
const TEAM_GLOW: Record<Team, string> = { blue: "rgba(58,160,255,0.35)", red: "rgba(255,90,82,0.35)", neutral: "rgba(224,185,106,0.35)" };

// ---------------------------------------------------------------------------
// Snapshot interpolation
// ---------------------------------------------------------------------------
export function interpolate(buffer: { snap: Snapshot; recv: number }[], renderTime: number): Snapshot | null {
  if (buffer.length === 0) return null;
  if (buffer.length === 1) return buffer[0].snap;
  // Find the two snapshots surrounding renderTime.
  let a = buffer[0];
  let b = buffer[buffer.length - 1];
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i].recv <= renderTime && buffer[i + 1].recv >= renderTime) {
      a = buffer[i];
      b = buffer[i + 1];
      break;
    }
  }
  const span = b.recv - a.recv || 1;
  const t = Math.max(0, Math.min(1, (renderTime - a.recv) / span));
  // Interpolate champs & minions by id; take latest for everything else.
  const latest = b.snap;
  const champMap = new Map(a.snap.champs.map((c) => [c.id, c]));
  const champs = latest.champs.map((cb) => {
    const ca = champMap.get(cb.id);
    if (!ca) return cb;
    return { ...cb, x: lerp(ca.x, cb.x, t), y: lerp(ca.y, cb.y, t), f: lerpAngle(ca.f, cb.f, t) };
  });
  const minMap = new Map(a.snap.minions.map((m) => [m.id, m]));
  const minions = latest.minions.map((mb) => {
    const ma = minMap.get(mb.id);
    if (!ma) return mb;
    return { ...mb, x: lerp(ma.x, mb.x, t), y: lerp(ma.y, mb.y, t) };
  });
  const projMap = new Map(a.snap.projectiles.map((p) => [p.id, p]));
  const projectiles = latest.projectiles.map((pb) => {
    const pa = projMap.get(pb.id);
    if (!pa) return pb;
    return { ...pb, x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t) };
  });
  const monMap = new Map(a.snap.monsters.map((m) => [m.id, m]));
  const monsters = latest.monsters.map((mb) => {
    const ma = monMap.get(mb.id);
    if (!ma) return mb;
    return { ...mb, x: lerp(ma.x, mb.x, t), y: lerp(ma.y, mb.y, t) };
  });
  return { ...latest, champs, minions, monsters, projectiles };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------------------------------------------------------------------------
// FX particle system (client cosmetic)
// ---------------------------------------------------------------------------
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  color: string; size: number; kind: string; text?: string; x2?: number; y2?: number;
}

export class FxSystem {
  particles: Particle[] = [];
  seen = new Set<number>();

  ingest(fx: FxEvent[]) {
    for (const e of fx) {
      this.spawn(e);
    }
  }

  private spawn(e: FxEvent) {
    const color = e.color || (e.team ? TEAM_COLOR[e.team] : "#ffffff");
    switch (e.t) {
      case "hit": {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 40 + Math.random() * 120;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, max: 0.35, color, size: 3 + Math.random() * 2, kind: "spark" });
        }
        if (e.value) this.particles.push({ x: e.x + (Math.random() * 20 - 10), y: e.y - 20, vx: 0, vy: -40, life: 0.8, max: 0.8, color: e.color || "#ffe08a", size: 14, kind: "text", text: "-" + e.value });
        break;
      }
      case "text":
        this.particles.push({ x: e.x, y: e.y - 24, vx: 0, vy: -30, life: 1.1, max: 1.1, color: e.color || "#fff", size: 13, kind: "text", text: e.text });
        break;
      case "level":
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30, life: 0.7, max: 0.7, color: "#ffd23f", size: 4, kind: "spark" });
        }
        this.particles.push({ x: e.x, y: e.y - 40, vx: 0, vy: -30, life: 1.0, max: 1.0, color: "#ffd23f", size: 15, kind: "text", text: "¡SUBE NIVEL!" });
        break;
      case "death":
        for (let i = 0; i < 20; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 60 + Math.random() * 160;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, color, size: 3 + Math.random() * 3, kind: "spark" });
        }
        break;
      case "aoe":
        this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: e.ttl || 0.45, max: e.ttl || 0.45, color, size: e.radius || 100, kind: "ring" });
        break;
      case "beam":
        this.particles.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, vx: 0, vy: 0, life: 0.3, max: 0.3, color: e.color || (e.team ? TEAM_COLOR[e.team] : "#fff"), size: e.radius || 8, kind: "beam" });
        break;
      case "cast":
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 0.4, max: 0.4, color, size: 3, kind: "spark" });
        }
        break;
      case "shield":
        this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.5, max: 0.5, color: "#9fe8ff", size: 40, kind: "ring" });
        break;
      case "ping":
        this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 1.0, max: 1.0, color: e.color || "#ffd23f", size: 34, kind: "ping" });
        break;
      case "shot": {
        // Big visible shot: bright beam + muzzle flash + sparks + recoil ring.
        const tx = e.x2 ?? e.x;
        const ty = e.y2 ?? e.y;
        const ang = Math.atan2(ty - e.y, tx - e.x);
        const mx = e.x + Math.cos(ang) * 24;
        const my = e.y + Math.sin(ang) * 24;
        const col = e.color || "#fff";
        // Trail beam along the shot path (persists a little).
        this.particles.push({ x: mx, y: my, x2: tx, y2: ty, vx: 0, vy: 0, life: 0.35, max: 0.35, color: col, size: (e.radius || 7) + 4, kind: "beam" });
        // Big muzzle flash at the source.
        this.particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.35, max: 0.35, color: col, size: (e.radius || 7) + 10, kind: "flash" });
        // Impact flash at the target.
        this.particles.push({ x: tx, y: ty, vx: 0, vy: 0, life: 0.3, max: 0.3, color: col, size: (e.radius || 7) + 6, kind: "flash" });
        // Recoil ring at the muzzle.
        this.particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.3, max: 0.3, color: col, size: 22, kind: "ring" });
        // Sparks kicking back from the muzzle.
        for (let i = 0; i < 6; i++) {
          const a = ang + Math.PI + (Math.random() - 0.5) * 1.1;
          const s = 260 + Math.random() * 220;
          this.particles.push({ x: mx, y: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.28, max: 0.28, color: col, size: 3, kind: "spark" });
        }
        break;
      }
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + (p.kind === "spark" ? 120 * dt : 0);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.max);
      ctx.globalAlpha = alpha;
      if (p.kind === "spark") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "flash") {
        // Bright muzzle flash: a glowing core that shrinks as it fades.
        const r = p.size * (0.6 + alpha * 0.8);
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === "text") {
        ctx.font = `bold ${p.size}px 'Trebuchet MS', sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(p.text || "", p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text || "", p.x, p.y);
      } else if (p.kind === "ring") {
        const r = p.size * (1 - alpha * 0.3);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "beam") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2 || p.x, p.y2 || p.y);
        ctx.stroke();
      } else if (p.kind === "ping") {
        const r = p.size * (1.4 - alpha);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// World / scene drawing
// ---------------------------------------------------------------------------
// Deterministic decorative scatter (bushes, candles, clearings) computed once.
interface Deco { x: number; y: number; r: number; sway: number; }
let BUSHES: Deco[] | null = null;
let CANDLES: { x: number; y: number }[] | null = null;
let CLEARINGS: { x: number; y: number; r: number }[] | null = null;

// Keep decor clear of the lane roads and the two base areas.
function inBaseZone(x: number, y: number): boolean {
  for (const team of ["blue", "red"] as Team[]) {
    const n = STRUCTURES[team].nexus;
    if ((x - n.x) ** 2 + (y - n.y) ** 2 < 1500 ** 2) return true;
  }
  return false;
}
function onRoad(x: number, y: number): boolean {
  return distToNearestLane({ x, y }) < ROAD_HALF + 60;
}

function inNamedBush(x: number, y: number): boolean {
  for (const b of BUSH_SPOTS) {
    if ((x - b.x) ** 2 + (y - b.y) ** 2 < (b.r + 30) ** 2) return true;
  }
  return false;
}

function nearCamp(x: number, y: number): boolean {
  for (const c of JUNGLE_CAMPS) {
    if ((x - c.x) ** 2 + (y - c.y) ** 2 < 130 ** 2) return true;
  }
  return false;
}

function buildDeco() {
  if (BUSHES) return;
  const rng = mulberry(1337);
  BUSHES = [];
  const top = WORLD.laneTop;
  const bot = WORLD.laneBottom;

  // Dense blobs INSIDE each named bush clearing (the yellow-ringed ones).
  for (const spot of BUSH_SPOTS) {
    const blobs = 14 + Math.floor(rng() * 6);
    for (let b = 0; b < blobs; b++) {
      const a = rng() * Math.PI * 2;
      const rad = rng() * spot.r * 0.9;
      BUSHES.push({
        x: spot.x + Math.cos(a) * rad,
        y: spot.y + Math.sin(a) * rad,
        r: 30 + rng() * 40,
        sway: rng() * Math.PI * 2,
      });
    }
  }

  // Small ambient bush clusters across the rest of the field (avoiding
  // the road, base zones, named bushes and jungle camps).
  const clusterCount = 320;
  for (let c = 0; c < clusterCount; c++) {
    let cx = 0, cy = 0, ok = false;
    for (let tries = 0; tries < 20; tries++) {
      cx = 200 + rng() * (WORLD.width - 400);
      cy = top + 60 + rng() * (bot - top - 120);
      if (!inBaseZone(cx, cy) && !onRoad(cx, cy) && !inNamedBush(cx, cy) && !nearCamp(cx, cy)) { ok = true; break; }
    }
    if (!ok) continue;
    const blobs = 3 + Math.floor(rng() * 4);
    for (let b = 0; b < blobs; b++) {
      const a = rng() * Math.PI * 2;
      const rad = rng() * 60;
      BUSHES.push({
        x: cx + Math.cos(a) * rad,
        y: cy + Math.sin(a) * rad,
        r: 26 + rng() * 36,
        sway: rng() * Math.PI * 2,
      });
    }
  }
  // Loose scatter in the far grass margins (beyond the playable band).
  for (let i = 0; i < 260; i++) {
    const x = rng() * (WORLD.width + 400) - 200;
    const below = rng() > 0.5;
    const band = below ? [bot + 40, WORLD.height + 380] : [-380, top - 40];
    const y = band[0] + rng() * (band[1] - band[0]);
    BUSHES.push({ x, y, r: 26 + rng() * 44, sway: rng() * Math.PI * 2 });
  }

  // Faint mossy "clearings" (open circles) to break up the field.
  CLEARINGS = [];
  for (let i = 0; i < 48; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 10; tries++) {
      x = 700 + rng() * (WORLD.width - 1400);
      y = top + 120 + rng() * (bot - top - 240);
      if (!onRoad(x, y)) break;
    }
    CLEARINGS.push({ x, y, r: 120 + rng() * 130 });
  }

  CANDLES = [];
  for (let i = 0; i < 54; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 10; tries++) {
      x = 500 + rng() * (WORLD.width - 1000);
      y = top + 80 + rng() * (bot - top - 160);
      if (!onRoad(x, y) && !inBaseZone(x, y)) break;
    }
    CANDLES.push({ x, y });
  }
}
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawWorld(ctx: CanvasRenderingContext2D, time: number) {
  buildDeco();
  const top = WORLD.laneTop;
  const bot = WORLD.laneBottom;

  // Deep-forest field background (a moody dark green + subtle radial vignette
  // like the reference art). Oversized so the camera never shows void.
  const M = 2600;
  // Void (out of bounds) tone.
  ctx.fillStyle = "#050809";
  ctx.fillRect(-M, -M, WORLD.width + M * 2, WORLD.height + M * 2);
  const gg = ctx.createLinearGradient(0, top - 200, 0, bot + 200);
  gg.addColorStop(0, "#0f2818");
  gg.addColorStop(0.5, "#173a24");
  gg.addColorStop(1, "#0d2416");
  ctx.fillStyle = gg;
  ctx.fillRect(-M, top - 220, WORLD.width + M * 2, (bot - top) + 440);
  // Vignette: the playfield fades into the void near its edges.
  const vg = ctx.createRadialGradient(
    WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.35,
    WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.72
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(-M, -M, WORLD.width + M * 2, WORLD.height + M * 2);

  // Soft grass mottling (large translucent blobs).
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const rng = ((i * 9301 + 49297) % 233280) / 233280;
    const x = (i * 337) % (WORLD.width + 400) - 200;
    const y = ((i * 911) % (WORLD.height + 700)) - 350;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.04)";
    ctx.beginPath();
    ctx.ellipse(x, y, 120 + rng * 120, 70 + rng * 60, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Playable-band boundary (subtle brighter grass inside the arena).
  const bandGrad = ctx.createLinearGradient(0, top, 0, bot);
  bandGrad.addColorStop(0, "rgba(60,140,72,0.10)");
  bandGrad.addColorStop(0.5, "rgba(74,160,90,0.16)");
  bandGrad.addColorStop(1, "rgba(60,140,72,0.10)");
  ctx.fillStyle = bandGrad;
  ctx.fillRect(-M, top, WORLD.width + M * 2, bot - top);

  // Mossy clearings (open circular patches that break up the field).
  for (const cl of CLEARINGS!) {
    const g = ctx.createRadialGradient(cl.x, cl.y, cl.r * 0.2, cl.x, cl.y, cl.r);
    g.addColorStop(0, "rgba(120,190,120,0.10)");
    g.addColorStop(1, "rgba(120,190,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2); ctx.fill();
  }

  // Three minion roads: top, mid and bot, drawn as thick dirt ribbons that
  // follow the actual lane paths the minions walk.
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const tracePath = (lane: (typeof LANES)[number]) => {
    const path = LANE_PATHS[lane];
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  };
  // Grassy shoulder underneath each road.
  ctx.strokeStyle = "rgba(20,50,28,0.9)";
  ctx.lineWidth = ROAD_HALF * 2 + 40;
  for (const lane of LANES) { tracePath(lane); ctx.stroke(); }
  // The dirt itself.
  ctx.strokeStyle = "#7d6038";
  ctx.lineWidth = ROAD_HALF * 2;
  for (const lane of LANES) { tracePath(lane); ctx.stroke(); }
  // Lighter core so the road reads as lit down the middle.
  ctx.strokeStyle = "rgba(158, 122, 72, 0.75)";
  ctx.lineWidth = ROAD_HALF;
  for (const lane of LANES) { tracePath(lane); ctx.stroke(); }
  // Grass edging.
  ctx.strokeStyle = "rgba(40,90,50,0.75)";
  ctx.lineWidth = 10;
  for (const lane of LANES) {
    const path = LANE_PATHS[lane];
    for (const side of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i + 1].x - path[i].x, dy = path[i + 1].y - path[i].y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * ROAD_HALF * side, oy = (dx / len) * ROAD_HALF * side;
        if (i === 0) ctx.moveTo(path[i].x + ox, path[i].y + oy);
        ctx.lineTo(path[i + 1].x + ox, path[i + 1].y + oy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // Base platforms (team-tinted stone).
  drawBasePlatform(ctx, "blue");
  drawBasePlatform(ctx, "red");
  drawFountain(ctx, "blue", time);
  drawFountain(ctx, "red", time);

  // Yellow ring indicators around the named bush clearings (matches the
  // reference art — each cover circle is clearly outlined so you can see
  // where you'd be hidden). Draw the ring UNDER the bush blobs.
  for (const spot of BUSH_SPOTS) {
    ctx.save();
    // Soft inner glow.
    const g = ctx.createRadialGradient(spot.x, spot.y, spot.r * 0.4, spot.x, spot.y, spot.r);
    g.addColorStop(0, "rgba(180, 210, 90, 0.10)");
    g.addColorStop(1, "rgba(180, 210, 90, 0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2); ctx.fill();
    // Yellow outline (like a ward or bush indicator).
    ctx.strokeStyle = "rgba(210, 190, 90, 0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Jungle camps: draw the mossy pit on the ground (the live monster, if any,
  // is drawn later from the snapshot so it can chase/leash around).
  for (const camp of JUNGLE_CAMPS) {
    drawCampPit(ctx, camp.x, camp.y, MONSTER_KINDS[camp.kind].epic);
  }

  // Candles / braziers (ambient warm glow).
  for (const c of CANDLES!) {
    const flick = 0.6 + 0.4 * Math.sin(time * 6 + c.x);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 70);
    g.addColorStop(0, `rgba(255,190,90,${0.28 * flick})`);
    g.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffcf6b";
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 9 * flick, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Bushes: chunky broccoli-style clusters (dark base + brighter highlights on
  // top-left, matching the reference art).
  for (const b of BUSHES!) {
    const s = Math.sin(time * 1.5 + b.sway) * 3;
    // Ground shadow.
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(b.x + 6, b.y + b.r * 0.55, b.r * 1.05, b.r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark base blob.
    ctx.fillStyle = "#0e2a17";
    ctx.beginPath(); ctx.arc(b.x + s, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    // Mid-tone bulbs around the base (broccoli lumps).
    ctx.fillStyle = "#1a4a26";
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.35, b.y - b.r * 0.2, b.r * 0.68, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + s + b.r * 0.4, b.y - b.r * 0.05, b.r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.05, b.y - b.r * 0.5, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
    // Bright top-left highlight (the sunlit crown).
    ctx.fillStyle = "#2b6e3a";
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.32, b.y - b.r * 0.42, b.r * 0.36, 0, Math.PI * 2); ctx.fill();
    // Little rim highlight.
    ctx.fillStyle = "rgba(140, 210, 130, 0.28)";
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.42, b.y - b.r * 0.5, b.r * 0.16, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBasePlatform(ctx: CanvasRenderingContext2D, team: Team) {
  const s = STRUCTURES[team];
  const color = TEAM_COLOR[team];
  const n = s.nexus;
  // Each base is a corner keep: a big chamfered square tucked into its corner
  // of the map, wide enough to hold the nexus, fountain and base turrets.
  const R = 1050;              // reach from the nexus into the map
  const cut = 440;             // chamfer facing the battlefield
  const sign = team === "blue" ? 1 : -1;   // blue opens up-right, red down-left
  const cx = n.x, cy = n.y;
  const nearX = cx - sign * 520, nearY = cy + sign * 520;  // corner side
  const farX = cx + sign * R, farY = cy - sign * R;        // map side

  const drawKeep = (inset: number, fillA: string, strokeA: number) => {
    const nx = nearX - sign * inset, ny = nearY + sign * inset;
    const fx = farX + sign * inset, fy = farY - sign * inset;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(fx, ny);
    ctx.lineTo(fx, fy + sign * cut);
    ctx.lineTo(fx - sign * cut, fy);
    ctx.lineTo(nx, fy);
    ctx.closePath();
    ctx.fillStyle = fillA;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = strokeA;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  ctx.save();
  // Layered plates (outer -> inner) for depth, like the reference art.
  drawKeep(0, team === "blue" ? "rgba(30,60,110,0.28)" : "rgba(120,35,35,0.28)", 0.25);
  drawKeep(160, team === "blue" ? "rgba(40,80,140,0.35)" : "rgba(150,45,45,0.35)", 0.35);
  drawKeep(320, team === "blue" ? "rgba(50,100,170,0.42)" : "rgba(180,55,55,0.42)", 0.45);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFountain(ctx: CanvasRenderingContext2D, team: Team, time: number) {
  const f = STRUCTURES[team].fountain;
  const color = TEAM_COLOR[team];
  // Glow.
  const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, 150);
  g.addColorStop(0, team === "blue" ? "rgba(90,180,255,0.5)" : "rgba(255,110,100,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(f.x, f.y, 150, 0, Math.PI * 2); ctx.fill();
  // Stone rim.
  ctx.fillStyle = "#2a2f3a";
  ctx.beginPath(); ctx.ellipse(f.x, f.y, 96, 78, 0, 0, Math.PI * 2); ctx.fill();
  // Water.
  ctx.fillStyle = team === "blue" ? "#2b6fd0" : "#c23b36";
  ctx.beginPath(); ctx.ellipse(f.x, f.y, 82, 64, 0, 0, Math.PI * 2); ctx.fill();
  // Ripples.
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rr = ((time * 40 + i * 30) % 80);
    ctx.globalAlpha = 1 - rr / 80;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.78, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Center pillar glow.
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCampPit(ctx: CanvasRenderingContext2D, x: number, y: number, epic: boolean) {
  const R = epic ? 150 : 90;
  const ringR = epic ? 120 : 70;
  // Mossy pit.
  const g = ctx.createRadialGradient(x, y, 20, x, y, R);
  g.addColorStop(0, epic ? "rgba(70, 30, 60, 0.55)" : "rgba(60, 40, 20, 0.55)");
  g.addColorStop(1, epic ? "rgba(70, 30, 60, 0)" : "rgba(60, 40, 20, 0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  // Camp ring.
  ctx.strokeStyle = epic ? "rgba(200, 140, 240, 0.45)" : "rgba(160, 120, 60, 0.35)";
  ctx.lineWidth = epic ? 3 : 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, time: number) {
  // Body shadow.
  const epic = kind === "dragon" || kind === "baron";
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(x, y + (epic ? 30 : 14), epic ? 54 : 28, epic ? 18 : 10, 0, 0, Math.PI * 2); ctx.fill();

  const wobble = Math.sin(time * 2 + x) * (epic ? 3 : 2);
  ctx.save();
  ctx.translate(x, y + wobble);
  if (kind === "dragon") {
    // Winged crimson drake.
    ctx.fillStyle = "#7a2438";
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 28, 0, 0, Math.PI * 2); ctx.fill();
    // Wings.
    ctx.fillStyle = "#a5344f";
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-64, -30); ctx.lineTo(-30, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(64, -30); ctx.lineTo(30, 6); ctx.closePath(); ctx.fill();
    // Head + horns.
    ctx.fillStyle = "#5c1a2a";
    ctx.beginPath(); ctx.arc(0, -26, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a1119"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-7, -34); ctx.lineTo(-14, -46); ctx.moveTo(7, -34); ctx.lineTo(14, -46); ctx.stroke();
    // Glowing eyes.
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.arc(-5, -26, 3, 0, Math.PI * 2); ctx.arc(5, -26, 3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "baron") {
    // Great violet serpent-worm.
    ctx.fillStyle = "#4a2a6a";
    ctx.beginPath(); ctx.ellipse(0, 4, 44, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2f1a45";
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 14, 2, 5, 22, 0, 0, Math.PI * 2); ctx.fill(); }
    // Head.
    ctx.fillStyle = "#5c3a86";
    ctx.beginPath(); ctx.arc(0, -30, 18, 0, Math.PI * 2); ctx.fill();
    // Mandibles.
    ctx.strokeStyle = "#2f1a45"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-12, -38); ctx.lineTo(-24, -52); ctx.moveTo(12, -38); ctx.lineTo(24, -52); ctx.stroke();
    ctx.fillStyle = "#c39bff";
    ctx.beginPath(); ctx.arc(-6, -32, 3.4, 0, Math.PI * 2); ctx.arc(6, -32, 3.4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "beetle") {
    // Reddish-brown beetle with segmented back.
    ctx.fillStyle = "#8a4a2a";
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5c2f1a";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.ellipse(i * 10, -2, 3, 16, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Head + pincers.
    ctx.fillStyle = "#3a1e12";
    ctx.beginPath(); ctx.arc(0, -20, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a1e12";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -26); ctx.lineTo(-14, -34);
    ctx.moveTo(6, -26); ctx.lineTo(14, -34);
    ctx.stroke();
    // Yellow glow spot (like the reference monster).
    ctx.fillStyle = "#f6d060";
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "crab") {
    ctx.fillStyle = "#b74a3a";
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5a1e14";
    // Claws.
    ctx.beginPath(); ctx.arc(-24, 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(24, 4, 10, 0, Math.PI * 2); ctx.fill();
    // Eyes.
    ctx.fillStyle = "#ffde6a";
    ctx.beginPath(); ctx.arc(-6, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -6, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    // Spider.
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-20 - i * 2, -14 + i * 4);
      ctx.moveTo(8, 0);
      ctx.lineTo(20 + i * 2, -14 + i * 4);
      ctx.stroke();
    }
    ctx.fillStyle = "#151515";
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c73b3b";
    ctx.beginPath(); ctx.arc(-4, -3, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -3, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawMonster(ctx: CanvasRenderingContext2D, mo: MonsterSnap, time: number) {
  drawCreature(ctx, mo.x, mo.y, mo.k, time);
  const epic = mo.epic;
  const top = mo.y - (epic ? 78 : 44);
  // HP bar (neutral gold, epics get a wider bar + name).
  const w = epic ? 120 : 46;
  const pct = Math.max(0, mo.hp / mo.mhp);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(mo.x - w / 2 - 1, top - 1, w + 2, epic ? 10 : 7);
  ctx.fillStyle = epic ? (mo.k === "baron" ? "#b07bff" : "#ff7a45") : "#e0b96a";
  ctx.fillRect(mo.x - w / 2, top, w * pct, epic ? 8 : 5);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mo.x - w / 2, top, w, epic ? 8 : 5);
  // Level badge.
  ctx.fillStyle = "#0d1220";
  ctx.beginPath(); ctx.arc(mo.x - w / 2 - 9, top + (epic ? 4 : 2), 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e0b96a"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#e0b96a";
  ctx.font = "bold 10px 'Trebuchet MS'"; ctx.textAlign = "center";
  ctx.fillText(String(mo.lvl), mo.x - w / 2 - 9, top + (epic ? 8 : 6));
  if (epic) {
    ctx.font = "bold 14px 'Trebuchet MS'"; ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(mo.name, mo.x, top - 8);
    ctx.fillStyle = mo.k === "baron" ? "#d9c2ff" : "#ffcba0";
    ctx.fillText(mo.name, mo.x, top - 8);
  }
}

// Small overlay minimap of the whole battlefield.
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  localOwnerId: string,
  screenW: number,
  screenH: number
) {
  const W = 220;
  const H = Math.round(W * (WORLD.height / WORLD.width));
  const pad = 14;
  // Bottom-right corner (classic MOBA position), safely above joystick area.
  const x0 = screenW - W - pad;
  const y0 = screenH - H - pad - 200;
  const sx = W / WORLD.width;
  const sy = H / WORLD.height;

  ctx.save();
  ctx.fillStyle = "rgba(10, 20, 14, 0.85)";
  ctx.strokeStyle = "rgba(210, 190, 90, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x0, y0, W, H);
  ctx.fill();
  ctx.stroke();

  // Faint field tint.
  ctx.fillStyle = "rgba(28, 68, 38, 0.55)";
  ctx.fillRect(x0, y0, W, H);

  // The three lane roads.
  ctx.save();
  ctx.strokeStyle = "rgba(138, 106, 62, 0.9)";
  ctx.lineWidth = Math.max(2, ROAD_HALF * 2 * sx);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const lane of LANES) {
    const path = LANE_PATHS[lane];
    ctx.beginPath();
    ctx.moveTo(x0 + path[0].x * sx, y0 + path[0].y * sy);
    for (let i = 1; i < path.length; i++) ctx.lineTo(x0 + path[i].x * sx, y0 + path[i].y * sy);
    ctx.stroke();
  }
  ctx.restore();

  // Bushes.
  ctx.fillStyle = "rgba(50, 100, 55, 0.6)";
  for (const s of BUSH_SPOTS) {
    ctx.beginPath();
    ctx.arc(x0 + s.x * sx, y0 + s.y * sy, Math.max(1.5, s.r * sx * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }

  // Turrets and nexuses.
  for (const t of snap.turrets) {
    if (!t.alive) continue;
    ctx.fillStyle = t.team === "blue" ? "#4a7fb5" : "#a04947";
    ctx.fillRect(x0 + t.x * sx - 2, y0 + t.y * sy - 2, 4, 4);
  }
  for (const n of snap.nexuses) {
    if (!n.alive) continue;
    ctx.fillStyle = n.team === "blue" ? "#7fc0ff" : "#ff8b82";
    ctx.beginPath();
    ctx.arc(x0 + n.x * sx, y0 + n.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Minions.
  for (const m of snap.minions) {
    ctx.fillStyle = m.team === "blue" ? "rgba(120,180,220,0.9)" : "rgba(240,140,130,0.9)";
    ctx.beginPath();
    ctx.arc(x0 + m.x * sx, y0 + m.y * sy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Neutral monsters (epics stand out).
  for (const mo of snap.monsters) {
    ctx.fillStyle = mo.epic ? (mo.k === "baron" ? "#c39bff" : "#ff9a5a") : "rgba(224,185,106,0.9)";
    ctx.beginPath();
    ctx.arc(x0 + mo.x * sx, y0 + mo.y * sy, mo.epic ? 3.2 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Champions.
  for (const c of snap.champs) {
    if (!c.alive) continue;
    ctx.fillStyle = c.owner === localOwnerId ? "#ffd23f" : c.team === "blue" ? "#3aa0ff" : "#ff5a52";
    ctx.beginPath();
    ctx.arc(x0 + c.x * sx, y0 + c.y * sy, c.owner === localOwnerId ? 3.5 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  localOwnerId: string,
  time: number
) {
  const localChamp = snap.champs.find((c) => c.owner === localOwnerId);
  const localTeam = localChamp?.team || "blue";

  // Zones (under units).
  for (const z of snap.zones) drawZone(ctx, z, time);

  // Nexuses & turrets.
  for (const n of snap.nexuses) drawNexus(ctx, n, time);
  for (const t of snap.turrets) drawTurret(ctx, t);

  // Neutral jungle monsters.
  for (const mo of snap.monsters) drawMonster(ctx, mo, time);

  // Minions.
  for (const m of snap.minions) drawMinion(ctx, m);

  // Champions.
  for (const c of snap.champs) drawChampion(ctx, c, c.owner === localOwnerId, localTeam, time);

  // Projectiles (over units).
  for (const p of snap.projectiles) drawProjectile(ctx, p);
}

function drawZone(ctx: CanvasRenderingContext2D, z: ZoneSnap, time: number) {
  const color = TEAM_COLOR[z.team];
  if (z.k === "wall") {
    const perp = (z.angle || 0) + Math.PI / 2;
    const half = (z.length || 260) / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 8);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(z.x + Math.cos(perp) * half, z.y + Math.sin(perp) * half);
    ctx.lineTo(z.x - Math.cos(perp) * half, z.y - Math.sin(perp) * half);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  const pulse = z.k === "delayed" ? 0.5 + 0.4 * Math.sin(time * 10) : 0.35;
  ctx.globalAlpha = pulse * 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (z.k === "trap") {
    ctx.globalAlpha = 1;
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.fillText(z.sp?.includes("teemoo") ? "M" : "T", z.x, z.y + 6);
  }
  ctx.restore();
}

function drawNexus(ctx: CanvasRenderingContext2D, n: StructSnap, time: number) {
  if (!n.alive) return;
  const color = TEAM_COLOR[n.team];
  if (n.prot) drawProtectionShield(ctx, n.x, n.y, 130, color);
  const bob = Math.sin(time * 1.5) * 8;
  // Ground shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(n.x, n.y + 30, 60, 26, 0, 0, Math.PI * 2); ctx.fill();
  // Base dais.
  ctx.fillStyle = "#232833";
  ctx.beginPath(); ctx.ellipse(n.x, n.y + 24, 56, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = team3(color, 0.25);
  ctx.beginPath(); ctx.ellipse(n.x, n.y + 20, 44, 18, 0, 0, Math.PI * 2); ctx.fill();
  // Floating rotating crystal.
  ctx.save();
  ctx.translate(n.x, n.y - 20 + bob);
  ctx.shadowColor = color; ctx.shadowBlur = 34;
  const r = 44;
  ctx.rotate(time * 0.5);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, team3(color, 0.6));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, -r * 0.1); ctx.lineTo(r * 0.45, r); ctx.lineTo(-r * 0.45, r); ctx.lineTo(-r * 0.7, -r * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  drawStructBar(ctx, n, 78, "NEXUS");
}

// Structures still shielded by the towers in front of them get a dashed
// barrier ring so it's obvious why they can't be damaged yet.
function drawProtectionShield(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath(); ctx.arc(x, y - 10, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y - 10, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function team3(hex: string, amt: number): string {
  // Darken a hex color by amt (0..1).
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `rgb(${r},${g},${b})`;
}

function drawTurret(ctx: CanvasRenderingContext2D, t: StructSnap) {
  if (!t.alive) return;
  const color = TEAM_COLOR[t.team];
  if (t.prot) drawProtectionShield(ctx, t.x, t.y, 78, color);
  const h = 66; // tower height
  // Ground shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(t.x, t.y + 14, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
  // Tapered cone body (trapezoid).
  const topW = 20, botW = 38;
  const topY = t.y - h, botY = t.y + 8;
  const body = ctx.createLinearGradient(t.x - botW, 0, t.x + botW, 0);
  body.addColorStop(0, "#171b26");
  body.addColorStop(0.5, "#2a3040");
  body.addColorStop(1, "#12151d");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(t.x - topW, topY); ctx.lineTo(t.x + topW, topY);
  ctx.lineTo(t.x + botW, botY); ctx.lineTo(t.x - botW, botY);
  ctx.closePath(); ctx.fill();
  // Stone rings.
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const yy = topY + ((botY - topY) * i) / 4;
    const ww = topW + ((botW - topW) * i) / 4;
    ctx.beginPath(); ctx.moveTo(t.x - ww, yy); ctx.lineTo(t.x + ww, yy); ctx.stroke();
  }
  // Glowing crystal at top.
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(t.x, topY - 20); ctx.lineTo(t.x + 12, topY - 4); ctx.lineTo(t.x, topY + 10); ctx.lineTo(t.x - 12, topY - 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  drawStructBar(ctx, t, h + 14, "");
}

function drawStructBar(ctx: CanvasRenderingContext2D, s: StructSnap, r: number, label: string) {
  const w = 84;
  const pct = Math.max(0, s.hp / s.mhp);
  const y = s.y - r - 16;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(s.x - w / 2, y, w, 8);
  ctx.fillStyle = s.team === "blue" ? "#3aa0ff" : "#ff5a52";
  ctx.fillRect(s.x - w / 2, y, w * pct, 8);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x - w / 2, y, w, 8);
}

function drawMinion(ctx: CanvasRenderingContext2D, m: MinionSnap) {
  const color = TEAM_COLOR[m.team];
  const size = m.mt === "cannon" ? 15 : m.mt === "caster" ? 10 : 12;
  // Ground shadow.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(m.x, m.y + size * 0.7, size * 0.9, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (m.mt === "caster") {
    ctx.arc(0, 0, size, 0, Math.PI * 2);
  } else if (m.mt === "cannon") {
    ctx.rect(-size, -size, size * 2, size * 2);
  } else {
    ctx.moveTo(0, -size); ctx.lineTo(size, size); ctx.lineTo(-size, size); ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // HP bar.
  const w = 26;
  const pct = Math.max(0, m.hp / m.mhp);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(m.x - w / 2, m.y - size - 10, w, 4);
  ctx.fillStyle = m.team === "blue" ? "#5bd6a0" : "#ff8b6b";
  ctx.fillRect(m.x - w / 2, m.y - size - 10, w * pct, 4);
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: ProjSnap) {
  const color = TEAM_COLOR[p.team];
  const fill = p.k === "skillshot" ? lightColor(p.sp) : color;
  const r = Math.max(6, Math.min(p.r, 26));
  ctx.save();
  // Outer glow halo.
  const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 3);
  g.addColorStop(0, fill);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
  // Bright core.
  ctx.globalAlpha = 1;
  ctx.shadowColor = fill;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function lightColor(sp?: string): string {
  if (!sp) return "#ffffff";
  if (sp === "energy_ball") return "#ffe08a"; // free-aim basic-attack ball
  if (sp.startsWith("luux")) return "#ffe98a";
  if (sp.startsWith("ashee")) return "#a9e8ff";
  if (sp.startsWith("blitz")) return "#f6c453";
  if (sp.startsWith("jinix")) return "#ff8ce0";
  if (sp.startsWith("teemoo")) return "#8be36b";
  if (sp.startsWith("yasou")) return "#7fd6ff";
  return "#ffffff";
}

function drawChampion(ctx: CanvasRenderingContext2D, c: ChampSnap, isLocal: boolean, localTeam: Team, time: number) {
  const def = CHAMPIONS[c.cid];
  const color = TEAM_COLOR[c.team];
  const stealth = (c.flags & 1) !== 0;

  if (!c.alive) {
    // Ghost marker at fountain area is skipped; just draw nothing on the map.
    return;
  }

  ctx.save();
  ctx.globalAlpha = stealth ? (c.team === localTeam ? 0.5 : 0.12) : 1;

  // Ground shadow for depth.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 20, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Range indicator for local champ.
  if (isLocal) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.ar + 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Selection ring.
  ctx.beginPath();
  ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.lineWidth = isLocal ? 4 : 3;
  ctx.strokeStyle = isLocal ? "#ffd23f" : color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Champion disc.
  ctx.beginPath();
  ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
  ctx.fillStyle = shade(def?.color || "#888", c.team);
  ctx.fill();

  // Facing indicator.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x + Math.cos(c.f) * 26, c.y + Math.sin(c.f) * 26);
  ctx.stroke();

  // Emoji.
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def?.glyph || "?", c.x, c.y + 1);
  ctx.textBaseline = "alphabetic";
  ctx.restore();

  // Shields ring.
  const shield = c.bf.filter((b) => b.k === "shield").reduce((a, b) => a + b.m, 0);
  if (shield > 0) {
    ctx.strokeStyle = "rgba(230,240,120,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 33, 0, Math.PI * 2);
    ctx.stroke();
  }

  // CC indicator.
  const cc = c.bf.find((b) => b.k === "stun" || b.k === "root" || b.k === "airborne");
  if (cc) {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.fillText(cc.k === "airborne" ? "AIRE" : cc.k === "stun" ? "ATURDIDO" : "ANCLADO", c.x, c.y - 40);
  }

  // Bars: HP + mana.
  const w = 56;
  const bx = c.x - w / 2;
  const by = c.y - 44;
  const hpPct = Math.max(0, c.hp / c.mhp);
  const mpPct = c.mmp > 0 ? Math.max(0, c.mp / c.mmp) : 0;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(bx - 1, by - 1, w + 2, 12);
  ctx.fillStyle = c.team === localTeam ? "#54e08a" : "#ff5a52";
  ctx.fillRect(bx, by, w * hpPct, 6);
  // shield overlay
  if (shield > 0) {
    ctx.fillStyle = "rgba(240,240,150,0.9)";
    const sPct = Math.min(1, shield / c.mhp);
    ctx.fillRect(bx + w * hpPct, by, w * sPct, 6);
  }
  ctx.fillStyle = "#3a78ff";
  ctx.fillRect(bx, by + 7, w * mpPct, 3);

  // Level badge.
  ctx.fillStyle = "#0d1220";
  ctx.beginPath();
  ctx.arc(bx - 8, by + 5, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 11px 'Trebuchet MS'";
  ctx.textAlign = "center";
  ctx.fillText(String(c.lvl), bx - 8, by + 9);

  // Name.
  ctx.font = "bold 12px 'Trebuchet MS'";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(c.name, c.x, by - 6);
  ctx.fillStyle = c.team === localTeam ? "#cfe8ff" : "#ffd0cc";
  ctx.fillText(c.name, c.x, by - 6);

  // Recall bar.
  if (c.rc > 0) {
    const p = 1 - c.rc / 4;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(c.x - 26, c.y + 34, 52, 6);
    ctx.fillStyle = "#7fd6ff";
    ctx.fillRect(c.x - 26, c.y + 34, 52 * p, 6);
  }
}

function shade(hex: string, team: Team): string {
  return hex;
}
