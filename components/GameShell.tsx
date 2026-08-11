"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HostSession, ClientSession, GameSession } from "@/game/net/session";
import { LobbyState } from "@/game/net/protocol";
import { GameConfig, Team } from "@/game/engine/types";
import { CHAMPION_LIST, CHAMPIONS } from "@/game/engine/champions";
import Lobby from "@/components/Lobby";
import GamePlay from "@/components/GamePlay";

type Screen = "menu" | "connecting" | "lobby" | "game";

function getName(): string {
  if (typeof window === "undefined") return "Player";
  return localStorage.getItem("lmao_name") || "";
}

export default function GameShell() {
  const router = useRouter();
  const params = useSearchParams();
  const [screen, setScreen] = useState<Screen>("menu");
  const [session, setSession] = useState<GameSession | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [name, setName] = useState(getName());
  const [error, setError] = useState("");
  const [connectingMsg, setConnectingMsg] = useState("");
  const [notice, setNotice] = useState("");
  const sessionRef = useRef<GameSession | null>(null);

  const mode = params.get("mode") || "menu";

  const wire = useCallback((s: GameSession) => {
    s.onLobby((l) => {
      setLobby({ ...l, slots: [...l.slots] });
      if (l.phase === "playing" || l.phase === "ended") setScreen("game");
      else setScreen("lobby");
    });
    s.onNotice((m) => {
      setNotice(m);
      setTimeout(() => setNotice(""), 4000);
    });
  }, []);

  const startHost = useCallback(
    async (solo: boolean, nm: string) => {
      setScreen("connecting");
      setConnectingMsg(solo ? "Booting the bootleg arena…" : "Opening your room to the internet…");
      const s = new HostSession(nm, solo);
      wire(s);
      try {
        await s.startNetworking();
        sessionRef.current = s;
        setSession(s);
        setLobby({ ...s.getLobby() });
        setScreen("lobby");
      } catch (e: any) {
        setError("Couldn't open a room (WebRTC broker unreachable). You can still play vs bots offline.");
        setScreen("menu");
      }
    },
    [wire]
  );

  const startJoin = useCallback(
    async (code: string, nm: string) => {
      setScreen("connecting");
      setConnectingMsg(`Knocking on room ${code.toUpperCase()}…`);
      const s = new ClientSession(nm);
      wire(s);
      try {
        await s.connect(code.trim());
        sessionRef.current = s;
        setSession(s);
        setScreen("lobby");
      } catch (e: any) {
        setError(e?.message || "Could not reach that room. Double-check the code.");
        setScreen("menu");
      }
    },
    [wire]
  );

  // Auto-trigger based on ?mode=
  useEffect(() => {
    if (screen !== "menu") return;
    if (!name) return; // wait for name entry
    if (mode === "solo") startHost(true, name);
    else if (mode === "host") startHost(false, name);
    // join is manual (needs code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, name]);

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
    };
  }, []);

  if (screen === "menu") {
    return (
      <Menu
        mode={mode}
        name={name}
        error={error}
        onName={(n) => {
          setName(n);
          localStorage.setItem("lmao_name", n);
        }}
        onSolo={(n) => startHost(true, n)}
        onHost={(n) => startHost(false, n)}
        onJoin={(code, n) => startJoin(code, n)}
        onBack={() => router.push("/")}
      />
    );
  }

  if (screen === "connecting") {
    return (
      <div className="center">
        <div className="spinner" />
        <div style={{ fontWeight: 700, fontSize: 18 }}>{connectingMsg}</div>
        <div style={{ color: "var(--ink-dim)", fontSize: 13 }}>
          (peer-to-peer handshake — this can take a few seconds)
        </div>
      </div>
    );
  }

  if (screen === "lobby" && session && lobby) {
    return <Lobby session={session} lobby={lobby} notice={notice} onLeave={() => { session.destroy(); router.push("/"); }} />;
  }

  if (screen === "game" && session) {
    return <GamePlay session={session} lobby={lobby} onExit={() => { session.destroy(); router.push("/"); }} />;
  }

  return (
    <div className="center">
      <div className="spinner" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function Menu({
  mode,
  name,
  error,
  onName,
  onSolo,
  onHost,
  onJoin,
  onBack,
}: {
  mode: string;
  name: string;
  error: string;
  onName: (n: string) => void;
  onSolo: (n: string) => void;
  onHost: (n: string) => void;
  onJoin: (code: string, n: string) => void;
  onBack: () => void;
}) {
  const [nm, setNm] = useState(name || "");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"solo" | "host" | "join">(
    mode === "host" ? "host" : mode === "join" ? "join" : "solo"
  );
  const valid = nm.trim().length >= 2;

  return (
    <div className="overlay" style={{ position: "static", minHeight: "100vh" }}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>🛒 LMAO — Møøbas</h2>
          <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={onBack}>
            ✕ Store
          </button>
        </div>
        <div className="sub">Enter a summoner name, then pick how you want to play.</div>

        <div className="field">
          <label>Your Name</label>
          <input
            value={nm}
            maxLength={16}
            placeholder="e.g. FeederSupreme"
            onChange={(e) => setNm(e.target.value)}
            onBlur={() => valid && onName(nm.trim())}
          />
        </div>

        <div className="row" style={{ marginBottom: 16 }}>
          <button className={"btn " + (tab === "solo" ? "primary" : "ghost")} onClick={() => setTab("solo")}>
            🤖 Vs Bots
          </button>
          <button className={"btn " + (tab === "host" ? "green" : "ghost")} onClick={() => setTab("host")}>
            🏠 Host
          </button>
          <button className={"btn " + (tab === "join" ? "blue" : "ghost")} onClick={() => setTab("join")}>
            🔑 Join
          </button>
        </div>

        {tab === "solo" && (
          <>
            <p style={{ color: "var(--ink-dim)", fontSize: 14 }}>
              Jump straight into a match against AI bots. No internet friends required (we understand).
            </p>
            <button className="btn primary" style={{ width: "100%" }} disabled={!valid} onClick={() => onSolo(nm.trim())}>
              ▶ Start Bot Match
            </button>
          </>
        )}
        {tab === "host" && (
          <>
            <p style={{ color: "var(--ink-dim)", fontSize: 14 }}>
              Create a room and get a 5-letter code. Share it with friends — they join, empty seats fill with bots.
            </p>
            <button className="btn green" style={{ width: "100%" }} disabled={!valid} onClick={() => onHost(nm.trim())}>
              🏠 Create Room
            </button>
          </>
        )}
        {tab === "join" && (
          <>
            <div className="field">
              <label>Room Code</label>
              <input
                className="code-input"
                value={code}
                maxLength={5}
                placeholder="XXXXX"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
            </div>
            <button
              className="btn blue"
              style={{ width: "100%" }}
              disabled={!valid || code.length < 4}
              onClick={() => onJoin(code, nm.trim())}
            >
              🔑 Join Room
            </button>
          </>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
