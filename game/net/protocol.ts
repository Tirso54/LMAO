import { GameState, PlayerInput, PlayerSlot, GameConfig, KillFeedItem, FxEvent, Team } from "../engine/types";

// Compact snapshot DTOs sent host -> clients ~20Hz.
export interface ChampSnap {
  id: number;
  cid: string; // championId
  team: Team;
  owner: string;
  name: string;
  x: number;
  y: number;
  f: number; // face
  hp: number;
  mhp: number;
  mp: number;
  mmp: number;
  lvl: number;
  xp: number;
  xpNeed: number;
  alive: boolean;
  rt: number; // respawn timer
  gold: number;
  k: number;
  d: number;
  a: number;
  cs: number;
  items: string[];
  ab: { cd: number; r: number }[];
  bf: { k: string; t: number; m: number; l?: string }[];
  ms: number;
  ar: number; // attack range
  rc: number; // recall timer
  flags: number; // bit flags: 1 stealth, 2 rocketMode
  flow: number;
  ad: number;
  ap: number;
  armor: number;
  mr: number;
  as: number;
  crit: number;
  cdr: number;
  points: number; // unspent level points
}

export interface MinionSnap {
  id: number;
  mt: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  mhp: number;
}
export interface StructSnap {
  id: number;
  team: Team;
  x: number;
  y: number;
  hp: number;
  mhp: number;
  order?: number;
  alive: boolean;
}
export interface ProjSnap {
  id: number;
  team: Team;
  x: number;
  y: number;
  k: string;
  sp?: string;
  r: number;
}
export interface ZoneSnap {
  id: number;
  sp: string;
  team: Team;
  x: number;
  y: number;
  r: number;
  k: string;
  t: number;
  fuse?: number;
  angle?: number;
  length?: number;
}

export interface Snapshot {
  tick: number;
  time: number;
  phase: string;
  winner: Team | null;
  champs: ChampSnap[];
  minions: MinionSnap[];
  turrets: StructSnap[];
  nexuses: StructSnap[];
  projectiles: ProjSnap[];
  zones: ZoneSnap[];
  fx: FxEvent[];
  killFeed: KillFeedItem[];
  teamKills: Record<Team, number>;
  teamGold: Record<Team, number>;
  wave: number;
}

// Network message envelope.
export type NetMessage =
  | { t: "hello"; name: string; peerId: string }
  | { t: "welcome"; yourId: string; lobby: LobbyState }
  | { t: "lobby"; lobby: LobbyState }
  | { t: "chat"; from: string; text: string }
  | { t: "pickChamp"; championId: string }
  | { t: "ready"; ready: boolean }
  | { t: "switchTeam"; team: Team }
  | { t: "start" }
  | { t: "input"; input: PlayerInput }
  | { t: "snapshot"; snap: Snapshot }
  | { t: "rematch" }
  | { t: "kick"; playerId: string };

export interface LobbyState {
  hostName: string;
  roomCode: string;
  slots: PlayerSlot[];
  config: GameConfig;
  phase: string; // lobby | playing | ended
  countdown?: number;
}

import { CHAMPIONS } from "../engine/champions";
import { XP_PER_LEVEL } from "../engine/constants";
import { unspentPoints } from "../engine/simulation";

export function makeSnapshot(state: GameState): Snapshot {
  const champs: ChampSnap[] = [];
  for (const id in state.champions) {
    const c = state.champions[id];
    let flags = 0;
    if (c.buffs.some((b) => b.id === "stealth")) flags |= 1;
    if (c.passiveData.rocketMode) flags |= 2;
    champs.push({
      id: c.id,
      cid: c.championId,
      team: c.team,
      owner: c.ownerId,
      name: c.displayName,
      x: Math.round(c.pos.x),
      y: Math.round(c.pos.y),
      f: +c.face.toFixed(2),
      hp: Math.max(0, Math.round(c.hp)),
      mhp: Math.round(c.maxHp),
      mp: Math.round(c.mana),
      mmp: Math.round(c.maxMana),
      lvl: c.level,
      xp: Math.round(c.xp),
      xpNeed: XP_PER_LEVEL(c.level),
      alive: c.alive,
      rt: +c.respawnTimer.toFixed(1),
      gold: Math.round(c.gold),
      k: c.kills,
      d: c.deaths,
      a: c.assists,
      cs: c.cs,
      items: c.items,
      ab: c.abilities.map((a) => ({ cd: +a.cd.toFixed(1), r: a.rank })),
      bf: c.buffs
        .filter((b) => b.label || b.kind === "shield")
        .map((b) => ({ k: b.kind, t: +b.time.toFixed(1), m: Math.round(b.magnitude), l: b.label })),
      ms: Math.round(c.moveSpeed),
      ar: c.attackRange,
      rc: +c.recallTimer.toFixed(1),
      flags,
      flow: Math.round(c.passiveData.flow || 0),
      ad: c.attackDamage,
      ap: c.abilityPower,
      armor: c.armor,
      mr: c.magicResist,
      as: +c.attackSpeed.toFixed(2),
      crit: +(c.critChance).toFixed(2),
      cdr: +(c.cooldownReduction).toFixed(2),
      points: unspentPoints(c),
    });
  }
  const minions: MinionSnap[] = [];
  for (const id in state.minions) {
    const m = state.minions[id];
    minions.push({ id: m.id, mt: m.minionType, team: m.team, x: Math.round(m.pos.x), y: Math.round(m.pos.y), hp: Math.round(m.hp), mhp: Math.round(m.maxHp) });
  }
  const turrets: StructSnap[] = [];
  for (const id in state.turrets) {
    const t = state.turrets[id];
    turrets.push({ id: t.id, team: t.team, x: t.pos.x, y: t.pos.y, hp: Math.round(t.hp), mhp: t.maxHp, order: t.order, alive: t.alive });
  }
  const nexuses: StructSnap[] = [];
  for (const id in state.nexuses) {
    const n = state.nexuses[id];
    nexuses.push({ id: n.id, team: n.team, x: n.pos.x, y: n.pos.y, hp: Math.round(n.hp), mhp: n.maxHp, alive: n.alive });
  }
  const projectiles: ProjSnap[] = state.projectiles.map((p) => ({ id: p.id, team: p.team, x: Math.round(p.pos.x), y: Math.round(p.pos.y), k: p.kind, sp: p.spellId, r: p.radius }));
  const zones: ZoneSnap[] = state.zones.map((z) => ({ id: z.id, sp: z.spellId, team: z.team, x: Math.round(z.pos.x), y: Math.round(z.pos.y), r: z.radius, k: z.kind, t: +z.time.toFixed(1), fuse: z.fuse, angle: z.angle, length: z.length }));

  const snap: Snapshot = {
    tick: state.tick,
    time: +state.time.toFixed(2),
    phase: state.phase,
    winner: state.winner,
    champs,
    minions,
    turrets,
    nexuses,
    projectiles,
    zones,
    fx: state.fx.slice(),
    killFeed: state.killFeed.slice(-8),
    teamKills: state.teamKills,
    teamGold: { blue: Math.round(state.teamGold.blue), red: Math.round(state.teamGold.red) },
    wave: state.minionWave,
  };
  return snap;
}
