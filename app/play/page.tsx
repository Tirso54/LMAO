"use client";

import dynamic from "next/dynamic";

// The whole game is client-only (canvas, WebRTC, window). Disable SSR.
const GameShell = dynamic(() => import("@/components/GameShell"), {
  ssr: false,
  loading: () => (
    <div className="center">
      <div className="load-mark wordmark">LMAO</div>
      <div className="spinner" />
      <div style={{ color: "var(--ink-dim)" }}>Desempaquetando el bootleg…</div>
    </div>
  ),
});

export default function PlayPage() {
  return <GameShell />;
}
