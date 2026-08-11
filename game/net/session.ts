import { HostPeer, ClientPeer } from "./peer";
import { LobbyState, NetMessage, Snapshot, makeSnapshot } from "./protocol";
import {
  GameConfig,
  GameState,
  PlayerInput,
  PlayerSlot,
  Team,
} from "../engine/types";
import { DT, TICK_RATE } from "../engine/constants";
import { createInitialState, spawnAllChampions } from "../engine/setup";
import { applyInput, step } from "../engine/simulation";
import { updateBots } from "../engine/ai";
import { CHAMPION_IDS } from "../engine/champions";

export type SessionRole = "host" | "client" | "solo";

export interface StampedSnapshot {
  snap: Snapshot;
  recv: number;
}

export interface GameSession {
  role: SessionRole;
  localPlayerId: string;
  getLobby(): LobbyState;
  onLobby(cb: (l: LobbyState) => void): void;
  onSnapshot(cb: (s: StampedSnapshot) => void): void;
  onChat(cb: (from: string, text: string) => void): void;
  onNotice(cb: (msg: string, kind?: string) => void): void;
  sendInput(input: PlayerInput): void;
  // Lobby actions
  pickChamp(cid: string): void;
  setReady(r: boolean): void;
  setTeam(t: Team): void;
  setConfig?(patch: Partial<GameConfig>): void;
  start?(): void;
  rematch?(): void;
  sendChat(text: string): void;
  destroy(): void;
}

const DEFAULT_CONFIG: GameConfig = {
  teamSize: 3,
  enemyBots: 3,
  botFill: true,
  difficulty: "normal",
  minionsEnabled: true,
};

// -----------------------------------------------------------------------------
// HOST (also used for solo — a host with no remote peers).
// -----------------------------------------------------------------------------
export class HostSession implements GameSession {
  role: SessionRole;
  localPlayerId = "host";
  private peer: HostPeer | null = null;
  private lobby: LobbyState;
  private state: GameState | null = null;
  private loop: any = null;
  private inputs: Record<string, PlayerInput> = {};
  private connPlayer = new Map<any, string>();
  private countdown = 0;
  private lobbyCbs: ((l: LobbyState) => void)[] = [];
  private snapCbs: ((s: StampedSnapshot) => void)[] = [];
  private chatCbs: ((f: string, t: string) => void)[] = [];
  private noticeCbs: ((m: string, k?: string) => void)[] = [];
  private slotByOwner = new Map<string, PlayerSlot>();

  constructor(hostName: string, solo: boolean, config?: Partial<GameConfig>) {
    this.role = solo ? "solo" : "host";
    this.lobby = {
      hostName,
      roomCode: "LOCAL",
      slots: [
        { playerId: "host", name: hostName, team: "blue", championId: "garon", isBot: false, ready: false, connected: true },
      ],
      config: { ...DEFAULT_CONFIG, ...config },
      phase: "lobby",
    };
  }

  async startNetworking(): Promise<string> {
    if (this.role === "solo") return "LOCAL";
    this.peer = new HostPeer({
      onOpen: () => {},
      onConnect: (conn) => {
        this.emitNotice("A challenger approaches the Bootleg Bazaar…");
      },
      onDisconnect: (conn) => {
        const pid = this.connPlayer.get(conn);
        if (pid) {
          this.lobby.slots = this.lobby.slots.filter((s) => s.playerId !== pid);
          this.connPlayer.delete(conn);
          // If in game, convert to bot.
          if (this.state) {
            const c = Object.values(this.state.champions).find((ch) => ch.ownerId === pid);
            if (c) { c.isBot = true; }
          }
          this.pushLobby();
          this.emitNotice("A player rage-quit (or their wifi did).");
        }
      },
      onMessage: (conn, msg) => this.onHostMessage(conn, msg),
      onError: (err) => this.emitNotice("Network hiccup: " + (err?.type || err?.message || "unknown"), "error"),
    });
    const code = await this.peer.start();
    this.lobby.roomCode = code;
    this.pushLobby();
    return code;
  }

  private onHostMessage(conn: any, msg: NetMessage) {
    switch (msg.t) {
      case "hello": {
        const pid = msg.peerId || "p" + Math.random().toString(36).slice(2, 7);
        this.connPlayer.set(conn, pid);
        // Assign to smaller team.
        const team = this.smallerTeam();
        const slot: PlayerSlot = { playerId: pid, name: msg.name?.slice(0, 16) || "Rando", team, championId: this.freeChamp(), isBot: false, ready: false, connected: true };
        this.lobby.slots.push(slot);
        this.peer!.send(conn, { t: "welcome", yourId: pid, lobby: this.lobby });
        this.pushLobby();
        break;
      }
      case "pickChamp": {
        const pid = this.connPlayer.get(conn);
        const slot = this.lobby.slots.find((s) => s.playerId === pid);
        if (slot && !this.state) slot.championId = msg.championId;
        this.pushLobby();
        break;
      }
      case "ready": {
        const pid = this.connPlayer.get(conn);
        const slot = this.lobby.slots.find((s) => s.playerId === pid);
        if (slot) slot.ready = msg.ready;
        this.pushLobby();
        break;
      }
      case "switchTeam": {
        const pid = this.connPlayer.get(conn);
        const slot = this.lobby.slots.find((s) => s.playerId === pid);
        if (slot && !this.state) slot.team = msg.team;
        this.pushLobby();
        break;
      }
      case "chat": {
        const pid = this.connPlayer.get(conn);
        const slot = this.lobby.slots.find((s) => s.playerId === pid);
        const from = slot?.name || "???";
        this.emitChat(from, msg.text);
        this.peer!.broadcast({ t: "chat", from, text: msg.text });
        break;
      }
      case "input": {
        const pid = this.connPlayer.get(conn);
        if (pid) this.inputs[pid] = msg.input;
        break;
      }
    }
  }

  private smallerTeam(): Team {
    let blue = 0, red = 0;
    for (const s of this.lobby.slots) { if (s.team === "blue") blue++; else red++; }
    return blue <= red ? "blue" : "red";
  }
  private freeChamp(): string {
    const taken = new Set(this.lobby.slots.map((s) => s.championId));
    return CHAMPION_IDS.find((c) => !taken.has(c)) || CHAMPION_IDS[0];
  }

  // ---- Lobby actions (host is local player) ----
  pickChamp(cid: string) {
    const slot = this.lobby.slots.find((s) => s.playerId === "host");
    if (slot && !this.state) slot.championId = cid;
    this.pushLobby();
  }
  setReady(r: boolean) {
    const slot = this.lobby.slots.find((s) => s.playerId === "host");
    if (slot) slot.ready = r;
    this.pushLobby();
  }
  setTeam(t: Team) {
    const slot = this.lobby.slots.find((s) => s.playerId === "host");
    if (slot && !this.state) slot.team = t;
    this.pushLobby();
  }
  setConfig(patch: Partial<GameConfig>) {
    this.lobby.config = { ...this.lobby.config, ...patch };
    this.pushLobby();
  }

  start() {
    if (this.state) return;
    const slots = this.buildFullSlots();
    const state = createInitialState(this.lobby.config);
    spawnAllChampions(state, slots);
    this.state = state;
    for (const s of slots) this.slotByOwner.set(s.playerId, s);
    this.lobby.phase = "playing";
    this.countdown = 3.5;
    state.phase = "countdown";
    this.pushLobby();
    this.startLoop();
  }

  rematch() {
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    this.state = null;
    this.inputs = {};
    this.slotByOwner.clear();
    this.lobby.phase = "lobby";
    for (const s of this.lobby.slots) s.ready = false;
    this.pushLobby();
  }

  private buildFullSlots(): PlayerSlot[] {
    const cfg = this.lobby.config;
    // The host's team gets `teamSize`; the opposing team gets `enemyBots`.
    const hostSlot = this.lobby.slots.find((s) => s.playerId === "host");
    const hostTeam: Team = hostSlot?.team || "blue";
    const targetFor = (team: Team) => (team === hostTeam ? cfg.teamSize : cfg.enemyBots);
    const humans = this.lobby.slots.map((s) => ({ ...s }));
    const full: PlayerSlot[] = [];
    let botN = 0;
    const takenChamps = new Set(humans.map((h) => h.championId));
    for (const team of ["blue", "red"] as Team[]) {
      const teamHumans = humans.filter((h) => h.team === team);
      for (const h of teamHumans) full.push(h);
      if (cfg.botFill) {
        const target = Math.max(targetFor(team), teamHumans.length);
        for (let i = teamHumans.length; i < target; i++) {
          // Randomly pick from champions not yet taken; fall back to any.
          const pool = CHAMPION_IDS.filter((c) => !takenChamps.has(c));
          const cid = pool.length
            ? pool[Math.floor(Math.random() * pool.length)]
            : CHAMPION_IDS[Math.floor(Math.random() * CHAMPION_IDS.length)];
          takenChamps.add(cid);
          full.push({ playerId: `bot:${botN}`, name: BOT_NAMES[botN % BOT_NAMES.length], team, championId: cid, isBot: true, ready: true, connected: true });
          botN++;
        }
      }
    }
    return full;
  }

  private startLoop() {
    const stepMs = 1000 / TICK_RATE;
    let last = performance.now();
    this.loop = setInterval(() => {
      const now = performance.now();
      last = now;
      this.tick();
    }, stepMs);
  }

  private tick() {
    const state = this.state;
    if (!state) return;
    if (state.phase === "countdown") {
      this.countdown -= DT;
      if (this.countdown <= 0) state.phase = "playing";
    } else if (state.phase === "playing") {
      // Apply inputs.
      for (const ownerId in this.inputs) {
        applyInput(state, ownerId, this.inputs[ownerId]);
      }
      this.inputs = {};
      updateBots(state, DT);
      step(state, DT);
      if ((state.phase as string) === "ended") {
        this.lobby.phase = "ended";
        this.pushLobby();
      }
    }
    // Broadcast snapshot.
    const snap = makeSnapshot(state);
    const stamped: StampedSnapshot = { snap, recv: performance.now() };
    for (const cb of this.snapCbs) cb(stamped);
    if (this.peer) this.peer.broadcast({ t: "snapshot", snap });
    // Drain fx after broadcasting so both host + clients see them once.
    state.fx = [];
  }

  sendInput(input: PlayerInput) {
    this.inputs["host"] = input;
  }
  sendChat(text: string) {
    this.emitChat(this.lobby.hostName, text);
    if (this.peer) this.peer.broadcast({ t: "chat", from: this.lobby.hostName, text });
  }

  getLobby() { return this.lobby; }
  onLobby(cb: (l: LobbyState) => void) { this.lobbyCbs.push(cb); }
  onSnapshot(cb: (s: StampedSnapshot) => void) { this.snapCbs.push(cb); }
  onChat(cb: (f: string, t: string) => void) { this.chatCbs.push(cb); }
  onNotice(cb: (m: string, k?: string) => void) { this.noticeCbs.push(cb); }
  private pushLobby() {
    for (const cb of this.lobbyCbs) cb(this.lobby);
    if (this.peer) this.peer.broadcast({ t: "lobby", lobby: this.lobby });
  }
  private emitChat(f: string, t: string) { for (const cb of this.chatCbs) cb(f, t); }
  private emitNotice(m: string, k?: string) { for (const cb of this.noticeCbs) cb(m, k); }

  destroy() {
    if (this.loop) clearInterval(this.loop);
    this.peer?.destroy();
  }
}

// -----------------------------------------------------------------------------
// CLIENT
// -----------------------------------------------------------------------------
export class ClientSession implements GameSession {
  role: SessionRole = "client";
  localPlayerId = "";
  private peer: ClientPeer;
  private lobby: LobbyState | null = null;
  private lobbyCbs: ((l: LobbyState) => void)[] = [];
  private snapCbs: ((s: StampedSnapshot) => void)[] = [];
  private chatCbs: ((f: string, t: string) => void)[] = [];
  private noticeCbs: ((m: string, k?: string) => void)[] = [];
  private name: string;
  private myPeerId: string;

  constructor(name: string) {
    this.name = name;
    this.myPeerId = "p" + Math.random().toString(36).slice(2, 8);
    this.peer = new ClientPeer({
      onOpen: () => {
        this.peer.send({ t: "hello", name: this.name, peerId: this.myPeerId });
      },
      onMessage: (msg) => this.onMessage(msg),
      onClose: () => this.emitNotice("Disconnected from host.", "error"),
      onError: (e) => this.emitNotice("Connection error: " + (e?.type || e?.message || "unknown"), "error"),
    });
  }

  async connect(roomCode: string): Promise<void> {
    await this.peer.connect(roomCode);
  }

  private onMessage(msg: NetMessage) {
    switch (msg.t) {
      case "welcome":
        this.localPlayerId = msg.yourId;
        this.lobby = msg.lobby;
        this.pushLobby();
        break;
      case "lobby":
        this.lobby = msg.lobby;
        this.pushLobby();
        break;
      case "snapshot":
        for (const cb of this.snapCbs) cb({ snap: msg.snap, recv: performance.now() });
        break;
      case "chat":
        this.emitChat(msg.from, msg.text);
        break;
    }
  }

  pickChamp(cid: string) { this.peer.send({ t: "pickChamp", championId: cid }); }
  setReady(r: boolean) { this.peer.send({ t: "ready", ready: r }); }
  setTeam(t: Team) { this.peer.send({ t: "switchTeam", team: t }); }
  sendInput(input: PlayerInput) { this.peer.send({ t: "input", input }); }
  sendChat(text: string) { this.peer.send({ t: "chat", from: this.name, text }); }

  getLobby() { return this.lobby || { hostName: "?", roomCode: "?", slots: [], config: DEFAULT_CONFIG, phase: "lobby" }; }
  onLobby(cb: (l: LobbyState) => void) { this.lobbyCbs.push(cb); if (this.lobby) cb(this.lobby); }
  onSnapshot(cb: (s: StampedSnapshot) => void) { this.snapCbs.push(cb); }
  onChat(cb: (f: string, t: string) => void) { this.chatCbs.push(cb); }
  onNotice(cb: (m: string, k?: string) => void) { this.noticeCbs.push(cb); }
  private pushLobby() { if (this.lobby) for (const cb of this.lobbyCbs) cb(this.lobby); }
  private emitChat(f: string, t: string) { for (const cb of this.chatCbs) cb(f, t); }
  private emitNotice(m: string, k?: string) { for (const cb of this.noticeCbs) cb(m, k); }

  destroy() { this.peer.destroy(); }
}

export const BOT_NAMES = [
  "xX_BargainBot_Xx", "DropShipDan", "LagSwitchLarry", "AFK_Andy", "SmurfSusan",
  "TiltProofTom", "FeederFrank", "GankGranny", "NoWardNancy", "1HP_Harold",
  "CtrlAltDefeat", "PentaPending", "MissClickMike", "SprayNPray", "ClickbaitClive",
];
