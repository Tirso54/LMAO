"use client";

import { useEffect, useRef, useState } from "react";
import { GameSession, StampedSnapshot } from "@/game/net/session";
import { LobbyState, Snapshot, ChampSnap } from "@/game/net/protocol";
import { PlayerInput, CastCommand, Team } from "@/game/engine/types";
import { CHAMPIONS } from "@/game/engine/champions";
import { WORLD, STRUCTURES } from "@/game/engine/constants";
import { Camera, FxSystem, drawScene, drawWorld, interpolate } from "@/game/render/renderer";
import Hud from "@/components/Hud";

const INTERP_DELAY = 90; // ms

export default function GamePlay({
  session,
  lobby,
  onExit,
}: {
  session: GameSession;
  lobby: LobbyState | null;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<StampedSnapshot[]>([]);
  const fxRef = useRef(new FxSystem());
  const camRef = useRef<Camera>({ x: WORLD.width / 2, y: WORLD.height / 2, zoom: 0.62 });
  const mouseRef = useRef({ sx: 0, sy: 0 });
  const pendingRef = useRef<PlayerInput>({ seq: 0, casts: [] });
  const seqRef = useRef(0);
  const localIdRef = useRef(session.localPlayerId);
  const [hud, setHud] = useState<Snapshot | null>(null);
  const lastHudRef = useRef(0);
  const [shopOpen, setShopOpen] = useState(false);
  const shopOpenRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { shopOpenRef.current = shopOpen; }, [shopOpen]);
  useEffect(() => { localIdRef.current = session.localPlayerId; });

  // Subscribe to snapshots.
  useEffect(() => {
    session.onSnapshot((s) => {
      const buf = bufferRef.current;
      buf.push(s);
      if (buf.length > 12) buf.shift();
      // Ingest fx once per snapshot.
      if (s.snap.fx && s.snap.fx.length) fxRef.current.ingest(s.snap.fx);
      // Throttle HUD state updates.
      const now = performance.now();
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        setHud(s.snap);
      }
    });
  }, [session]);

  // Input flush loop.
  useEffect(() => {
    const flush = setInterval(() => {
      const p = pendingRef.current;
      const hasContent =
        p.move || p.attackMove || p.attackTarget != null || p.stop || p.recall || p.levelUp != null || (p.casts && p.casts.length) || (p.buy && p.buy.length) || (p.sell && p.sell.length) || p.ping;
      if (hasContent) {
        p.seq = ++seqRef.current;
        session.sendInput(p);
        pendingRef.current = { seq: p.seq, casts: [] };
      }
    }, 45);
    return () => clearInterval(flush);
  }, [session]);

  // Helpers to convert screen<->world.
  const screenToWorld = (sx: number, sy: number) => {
    const cam = camRef.current;
    const canvas = canvasRef.current!;
    return {
      x: (sx - canvas.width / 2) / cam.zoom + cam.x,
      y: (sy - canvas.height / 2) / cam.zoom + cam.y,
    };
  };

  const latestSnap = () => {
    const buf = bufferRef.current;
    return buf.length ? buf[buf.length - 1].snap : null;
  };

  const findLocalChamp = (snap: Snapshot | null): ChampSnap | null => {
    if (!snap) return null;
    return snap.champs.find((c) => c.owner === localIdRef.current) || null;
  };

  const nearestEnemyToCursor = (worldX: number, worldY: number, myTeam: Team, radius = 900) => {
    const snap = latestSnap();
    if (!snap) return null;
    let best: number | null = null;
    let bd = radius;
    const consider = (id: number, x: number, y: number, alive: boolean, team: Team, r: number) => {
      if (!alive || team === myTeam) return;
      const d = Math.hypot(x - worldX, y - worldY);
      if (d < bd + r) { bd = d; best = id; }
    };
    for (const c of snap.champs) consider(c.id, c.x, c.y, c.alive, c.team, 30);
    for (const m of snap.minions) consider(m.id, m.x, m.y, true, m.team, 18);
    for (const t of snap.turrets) consider(t.id, t.x, t.y, t.alive, t.team, 40);
    for (const n of snap.nexuses) consider(n.id, n.x, n.y, n.alive, n.team, 60);
    return best;
  };

  // Input listeners.
  useEffect(() => {
    const canvas = canvasRef.current!;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
    };

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const snap = latestSnap();
      const me = findLocalChamp(snap);
      if (!me) return;
      const w = screenToWorld(mouseRef.current.sx, mouseRef.current.sy);
      const enemy = nearestEnemyToCursor(w.x, w.y, me.team, 60);
      if (enemy != null) {
        pendingRef.current.attackTarget = enemy;
      } else {
        pendingRef.current.move = { x: w.x, y: w.y };
        pendingRef.current.attackTarget = null;
      }
    };

    const onDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // left-click: ping (Alt) — otherwise no-op (quickcast handles casting)
        if (e.altKey) {
          const w = screenToWorld(mouseRef.current.sx, mouseRef.current.sy);
          pendingRef.current.ping = { x: w.x, y: w.y, kind: "here" };
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      cam.zoom = Math.max(0.35, Math.min(1.1, cam.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    };

    const castSlot = (slot: number, levelMod: boolean) => {
      const snap = latestSnap();
      const me = findLocalChamp(snap);
      if (!me) return;
      if (levelMod) {
        pendingRef.current.levelUp = slot;
        return;
      }
      const def = CHAMPIONS[me.cid].abilities[slot];
      const w = screenToWorld(mouseRef.current.sx, mouseRef.current.sy);
      let targetId: number | null = null;
      if (def.cast === "target" || def.cast === "dash") {
        targetId = nearestEnemyToCursor(w.x, w.y, me.team, def.range || 600);
        if (targetId == null) return; // need a target
      }
      const cmd: CastCommand = { slot, x: w.x, y: w.y, targetId };
      pendingRef.current.casts = pendingRef.current.casts || [];
      pendingRef.current.casts.push(cmd);
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["q", "w", "e", "r"].includes(k)) {
        const slot = { q: 0, w: 1, e: 2, r: 3 }[k]!;
        castSlot(slot, e.ctrlKey || e.shiftKey);
        e.preventDefault();
      } else if (k === "a") {
        const w = screenToWorld(mouseRef.current.sx, mouseRef.current.sy);
        pendingRef.current.attackMove = { x: w.x, y: w.y };
      } else if (k === "s") {
        pendingRef.current.stop = true;
      } else if (k === "b") {
        pendingRef.current.recall = true;
      } else if (k === "p") {
        setShopOpen((v) => !v);
      } else if (k === "d" && e.ctrlKey) {
        /* reserved */
      } else if (["1", "2", "3", "4"].includes(k) && e.ctrlKey) {
        pendingRef.current.levelUp = Number(k) - 1;
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("mousedown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Render loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const renderTime = now - INTERP_DELAY;
      const snap = interpolate(bufferRef.current, renderTime);

      // Camera follow.
      const cam = camRef.current;
      if (snap) {
        const me = snap.champs.find((c) => c.owner === localIdRef.current);
        let target = me && me.alive ? { x: me.x, y: me.y } : null;
        if (!target && me) target = { x: me.x, y: me.y };
        if (!target) {
          const f = STRUCTURES.blue.fountain;
          target = { x: f.x, y: f.y };
        }
        cam.x += (target.x - cam.x) * Math.min(1, dt * 8);
        cam.y += (target.y - cam.y) * Math.min(1, dt * 8);
      }

      // Clear.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // World transform.
      ctx.setTransform(cam.zoom, 0, 0, cam.zoom, canvas.width / 2 - cam.x * cam.zoom, canvas.height / 2 - cam.y * cam.zoom);

      drawWorld(ctx, now / 1000);
      if (snap) drawScene(ctx, snap, localIdRef.current, now / 1000);

      // Move-order marker.
      const p = pendingRef.current;
      // FX.
      fxRef.current.update(dt);
      fxRef.current.draw(ctx);

      // Cursor target hint (screen space overlay handled by CSS cursor).
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doInput = (patch: Partial<PlayerInput>) => {
    Object.assign(pendingRef.current, patch);
  };
  const buyItem = (id: string) => {
    const p = pendingRef.current;
    p.buy = [...(p.buy || []), id];
  };
  const sellItem = (id: string) => {
    const p = pendingRef.current;
    p.sell = [...(p.sell || []), id];
  };
  const levelUp = (slot: number) => {
    pendingRef.current.levelUp = slot;
  };
  const recall = () => { pendingRef.current.recall = true; };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", cursor: "crosshair", background: "#05070d" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <Hud
        snap={hud}
        localId={session.localPlayerId}
        shopOpen={shopOpen}
        setShopOpen={setShopOpen}
        onBuy={buyItem}
        onSell={sellItem}
        onLevelUp={levelUp}
        onRecall={recall}
        onExit={onExit}
        onRematch={session.role !== "client" ? () => session.rematch?.() : undefined}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
      />
    </div>
  );
}
