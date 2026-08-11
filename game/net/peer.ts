// Thin wrapper around PeerJS (WebRTC). Browser-only; imported dynamically.
// The host is a Peer with a memorable room id; clients connect to it by id.

import type { DataConnection, Peer } from "peerjs";
import { NetMessage } from "./protocol";

const ROOM_PREFIX = "lmao-moobas-";

export function roomIdToPeerId(code: string): string {
  return ROOM_PREFIX + code.toLowerCase();
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function loadPeer(): Promise<typeof import("peerjs")> {
  return await import("peerjs");
}

export interface HostPeerHandlers {
  onConnect: (conn: DataConnection) => void;
  onDisconnect: (conn: DataConnection) => void;
  onMessage: (conn: DataConnection, msg: NetMessage) => void;
  onError: (err: any) => void;
  onOpen: (id: string) => void;
}

export class HostPeer {
  peer: Peer | null = null;
  conns: DataConnection[] = [];
  roomCode: string;
  constructor(private handlers: HostPeerHandlers) {
    this.roomCode = makeRoomCode();
  }

  async start(): Promise<string> {
    const { Peer } = await loadPeer();
    const peerId = roomIdToPeerId(this.roomCode);
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId, { debug: 1 });
      this.peer = peer;
      let settled = false;
      peer.on("open", (id) => {
        this.handlers.onOpen(id);
        if (!settled) {
          settled = true;
          resolve(this.roomCode);
        }
      });
      peer.on("connection", (conn) => {
        this.conns.push(conn);
        conn.on("open", () => this.handlers.onConnect(conn));
        conn.on("data", (data) => {
          try {
            this.handlers.onMessage(conn, data as NetMessage);
          } catch (e) {
            /* ignore malformed */
          }
        });
        conn.on("close", () => {
          this.conns = this.conns.filter((c) => c !== conn);
          this.handlers.onDisconnect(conn);
        });
        conn.on("error", (e) => this.handlers.onError(e));
      });
      peer.on("error", (err: any) => {
        // If the id is taken, retry with a fresh code once.
        if (err?.type === "unavailable-id" && !settled) {
          this.roomCode = makeRoomCode();
          const newId = roomIdToPeerId(this.roomCode);
          peer.destroy();
          const p2 = new Peer(newId, { debug: 1 });
          this.peer = p2;
          p2.on("open", (id2) => {
            this.handlers.onOpen(id2);
            if (!settled) { settled = true; resolve(this.roomCode); }
          });
          p2.on("connection", (conn) => {
            this.conns.push(conn);
            conn.on("open", () => this.handlers.onConnect(conn));
            conn.on("data", (data) => { try { this.handlers.onMessage(conn, data as NetMessage); } catch {} });
            conn.on("close", () => { this.conns = this.conns.filter((c) => c !== conn); this.handlers.onDisconnect(conn); });
          });
          p2.on("error", (e) => { this.handlers.onError(e); if (!settled) reject(e); });
          return;
        }
        this.handlers.onError(err);
        if (!settled) { settled = true; reject(err); }
      });
    });
  }

  send(conn: DataConnection, msg: NetMessage) {
    if (conn.open) conn.send(msg);
  }
  broadcast(msg: NetMessage) {
    for (const c of this.conns) if (c.open) c.send(msg);
  }
  destroy() {
    this.peer?.destroy();
    this.peer = null;
    this.conns = [];
  }
}

export interface ClientPeerHandlers {
  onOpen: () => void;
  onMessage: (msg: NetMessage) => void;
  onClose: () => void;
  onError: (err: any) => void;
}

export class ClientPeer {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  constructor(private handlers: ClientPeerHandlers) {}

  async connect(roomCode: string): Promise<void> {
    const { Peer } = await loadPeer();
    const targetId = roomIdToPeerId(roomCode);
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 1 });
      this.peer = peer;
      let settled = false;
      peer.on("open", () => {
        const conn = peer.connect(targetId, { reliable: true, serialization: "json" });
        this.conn = conn;
        const failTimer = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error("Could not reach host. Check the room code.")); }
        }, 12000);
        conn.on("open", () => {
          clearTimeout(failTimer);
          this.handlers.onOpen();
          if (!settled) { settled = true; resolve(); }
        });
        conn.on("data", (data) => {
          try { this.handlers.onMessage(data as NetMessage); } catch {}
        });
        conn.on("close", () => this.handlers.onClose());
        conn.on("error", (e) => { this.handlers.onError(e); if (!settled) { settled = true; clearTimeout(failTimer); reject(e); } });
      });
      peer.on("error", (err: any) => {
        this.handlers.onError(err);
        if (!settled) { settled = true; reject(err); }
      });
    });
  }

  send(msg: NetMessage) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }
  destroy() {
    this.conn?.close();
    this.peer?.destroy();
    this.peer = null;
    this.conn = null;
  }
}
