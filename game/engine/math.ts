import { Vec2 } from "./types";

export const v = (x: number, y: number): Vec2 => ({ x, y });

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function len(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function norm(a: Vec2): Vec2 {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function angleTo(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function fromAngle(a: number, l = 1): Vec2 {
  return { x: Math.cos(a) * l, y: Math.sin(a) * l };
}

// Distance from point p to segment ab.
export function pointSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLen2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / abLen2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

// A tiny deterministic PRNG (mulberry32) so host & replays stay consistent.
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
