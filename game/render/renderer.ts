import { Snapshot, ChampSnap, MinionSnap, StructSnap, ProjSnap, ZoneSnap } from "../net/protocol";
import { FxEvent, Team } from "../engine/types";
import { CHAMPIONS } from "../engine/champions";
import { WORLD, STRUCTURES, LANE_Y } from "../engine/constants";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const TEAM_COLOR: Record<Team, string> = { blue: "#3aa0ff", red: "#ff5a52" };
const TEAM_GLOW: Record<Team, string> = { blue: "rgba(58,160,255,0.35)", red: "rgba(255,90,82,0.35)" };

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
  return { ...latest, champs, minions, projectiles };
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
        this.particles.push({ x: e.x, y: e.y - 40, vx: 0, vy: -30, life: 1.0, max: 1.0, color: "#ffd23f", size: 15, kind: "text", text: "LEVEL UP!" });
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
// Deterministic decorative scatter (bushes, candles) computed once.
interface Deco { x: number; y: number; r: number; sway: number; }
let BUSHES: Deco[] | null = null;
let CANDLES: { x: number; y: number }[] | null = null;
function buildDeco() {
  if (BUSHES) return;
  const rng = mulberry(1337);
  BUSHES = [];
  const top = WORLD.laneTop;
  const bot = WORLD.laneBottom;
  // Scatter bushes in the off-lane grass (above and below the road).
  for (let i = 0; i < 260; i++) {
    const x = rng() * (WORLD.width + 400) - 200;
    const below = rng() > 0.5;
    const band = below ? [bot + 40, WORLD.height + 380] : [-380, top - 40];
    const y = band[0] + rng() * (band[1] - band[0]);
    BUSHES.push({ x, y, r: 26 + rng() * 40, sway: rng() * Math.PI * 2 });
  }
  // A few clusters along the road edges too.
  for (let i = 0; i < 40; i++) {
    const x = rng() * WORLD.width;
    const y = (rng() > 0.5 ? bot + 12 : top - 12) + (rng() - 0.5) * 24;
    BUSHES.push({ x, y, r: 22 + rng() * 26, sway: rng() * Math.PI * 2 });
  }
  CANDLES = [];
  for (let i = 0; i < 14; i++) {
    const x = 500 + rng() * (WORLD.width - 1000);
    const y = (rng() > 0.5 ? bot + 120 : top - 120) + (rng() - 0.5) * 200;
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

  // Grass field background (generously oversized so the camera never shows void).
  const M = 2600;
  const gg = ctx.createLinearGradient(0, -M, 0, WORLD.height + M);
  gg.addColorStop(0, "#15361f");
  gg.addColorStop(0.5, "#1c4527");
  gg.addColorStop(1, "#12301b");
  ctx.fillStyle = gg;
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

  // Dirt lane road with soft grassy shoulders.
  ctx.fillStyle = "rgba(20,45,26,0.9)";
  ctx.fillRect(-M, top - 26, WORLD.width + M * 2, bot - top + 52);
  const road = ctx.createLinearGradient(0, top, 0, bot);
  road.addColorStop(0, "#7a5c34");
  road.addColorStop(0.5, "#8a6a3e");
  road.addColorStop(1, "#6e5230");
  ctx.fillStyle = road;
  ctx.fillRect(-M, top, WORLD.width + M * 2, bot - top);
  // Road speckle.
  for (let x = 0; x < WORLD.width; x += 70) {
    for (let y = top + 20; y < bot; y += 60) {
      const r = ((x * 13 + y * 7) % 17) / 17;
      ctx.fillStyle = r > 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,235,200,0.05)";
      ctx.beginPath();
      ctx.arc(x + (y % 120), y, 3 + r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Road grass edges.
  ctx.strokeStyle = "rgba(40,90,50,0.85)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-M, top); ctx.lineTo(WORLD.width + M, top);
  ctx.moveTo(-M, bot); ctx.lineTo(WORLD.width + M, bot);
  ctx.stroke();

  // Base platforms (team-tinted stone).
  drawBasePlatform(ctx, "blue");
  drawBasePlatform(ctx, "red");
  drawFountain(ctx, "blue", time);
  drawFountain(ctx, "red", time);

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

  // Bushes (with shadow + sway).
  for (const b of BUSHES!) {
    const s = Math.sin(time * 1.5 + b.sway) * 3;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(b.x + 4, b.y + b.r * 0.5, b.r * 0.95, b.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#123a1e";
    ctx.beginPath(); ctx.arc(b.x + s, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b5029";
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.3, b.y - b.r * 0.25, b.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + s + b.r * 0.35, b.y - b.r * 0.1, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,200,120,0.18)";
    ctx.beginPath(); ctx.arc(b.x + s - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBasePlatform(ctx: CanvasRenderingContext2D, team: Team) {
  const s = STRUCTURES[team];
  const color = TEAM_COLOR[team];
  const nx = s.nexus.x;
  const fx = s.fountain.x;
  const minX = Math.min(nx, fx) - 220;
  const maxX = Math.max(nx, fx) + 160;
  const top = WORLD.laneTop - 120;
  const bot = WORLD.laneBottom + 120;
  // Raised platform slab.
  ctx.fillStyle = team === "blue" ? "rgba(40,80,140,0.28)" : "rgba(150,45,45,0.28)";
  roundRect(ctx, minX, top, maxX - minX, bot - top, 40);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalAlpha = 1;
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
    ctx.fillText(z.sp?.includes("teemoo") ? "🍄" : "🦷", z.x, z.y + 6);
  }
  ctx.restore();
}

function drawNexus(ctx: CanvasRenderingContext2D, n: StructSnap, time: number) {
  if (!n.alive) return;
  const color = TEAM_COLOR[n.team];
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
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = p.k === "skillshot" ? lightColor(p.sp) : color;
  const r = Math.max(5, Math.min(p.r, 26));
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lightColor(sp?: string): string {
  if (!sp) return "#ffffff";
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
  ctx.fillText(def?.emoji || "❓", c.x, c.y + 1);
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
    ctx.fillText(cc.k === "airborne" ? "💫" : cc.k === "stun" ? "⭐" : "🕸️", c.x, c.y - 40);
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
