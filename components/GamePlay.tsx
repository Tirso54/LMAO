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
  const isTouchRef = useRef(false);
  const touchRef = useRef<{ moving: boolean; pinchDist: number; pinchZoom: number }>({ moving: false, pinchDist: 0, pinchZoom: 0.62 });

  useEffect(() => {
    isTouchRef.current = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

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

    // ---- Touch controls (tablet) ----
    const canvasWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { sx: clientX - rect.left, sy: clientY - rect.top };
      return screenToWorld(clientX - rect.left, clientY - rect.top);
    };
    const touchOrder = (clientX: number, clientY: number) => {
      const snap = latestSnap();
      const me = findLocalChamp(snap);
      if (!me) return;
      const w = canvasWorld(clientX, clientY);
      const enemy = nearestEnemyToCursor(w.x, w.y, me.team, 55);
      if (enemy != null) {
        pendingRef.current.attackTarget = enemy;
        pendingRef.current.move = null;
      } else {
        pendingRef.current.move = { x: w.x, y: w.y };
        pendingRef.current.attackTarget = null;
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isTouchRef.current = true;
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchRef.current.pinchDist = Math.hypot(dx, dy);
        touchRef.current.pinchZoom = camRef.current.zoom;
        touchRef.current.moving = false;
      } else if (e.touches.length === 1) {
        touchRef.current.moving = true;
        touchOrder(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.hypot(dx, dy);
        if (touchRef.current.pinchDist > 0) {
          const ratio = d / touchRef.current.pinchDist;
          camRef.current.zoom = Math.max(0.32, Math.min(1.1, touchRef.current.pinchZoom * ratio));
        }
      } else if (e.touches.length === 1 && touchRef.current.moving) {
        touchOrder(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) touchRef.current.moving = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("mousedown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
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

      // Screen-space vignette for a cozy arena mood.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const vg = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  const stop = () => { pendingRef.current.stop = true; };

  // One-tap ability cast: auto-aim at the nearest enemy (tablet-friendly).
  const castAuto = (slot: number) => {
    const snap = latestSnap();
    const me = findLocalChamp(snap);
    if (!me || !snap) return;
    const def = CHAMPIONS[me.cid].abilities[slot];
    if (me.ab[slot].r <= 0) return;
    // Nearest enemy champion, else nearest enemy unit.
    let best: { x: number; y: number; id: number } | null = null;
    let bd = Infinity;
    const consider = (id: number, x: number, y: number, alive: boolean, team: Team) => {
      if (!alive || team === me.team) return;
      const d = Math.hypot(x - me.x, y - me.y);
      if (d < bd) { bd = d; best = { x, y, id }; }
    };
    for (const c of snap.champs) consider(c.id, c.x, c.y, c.alive, c.team);
    if (!best) {
      for (const m of snap.minions) consider(m.id, m.x, m.y, true, m.team);
      for (const t of snap.turrets) consider(t.id, t.x, t.y, t.alive, t.team);
    }
    let tx: number, ty: number, targetId: number | null = null;
    const b = best as { x: number; y: number; id: number } | null;
    if (b) {
      tx = b.x; ty = b.y;
      if (def.cast === "target" || def.cast === "dash") targetId = b.id;
    } else {
      tx = me.x + Math.cos(me.f) * (def.range || 400);
      ty = me.y + Math.sin(me.f) * (def.range || 400);
    }
    pendingRef.current.casts = pendingRef.current.casts || [];
    pendingRef.current.casts.push({ slot, x: tx, y: ty, targetId });
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", cursor: "crosshair", background: "#05070d", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />
      <Hud
        snap={hud}
        localId={session.localPlayerId}
        shopOpen={shopOpen}
        setShopOpen={setShopOpen}
        onBuy={buyItem}
        onSell={sellItem}
        onLevelUp={levelUp}
        onRecall={recall}
        onStop={stop}
        onCastAbility={castAuto}
        isTouch={isTouchRef.current}
        onExit={onExit}
        onRematch={session.role !== "client" ? () => session.rematch?.() : undefined}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
      />
    </div>
  );
}
