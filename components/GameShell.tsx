"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HostSession, ClientSession, GameSession } from "@/game/net/session";
import { LobbyState } from "@/game/net/protocol";
import { GameConfig, Team } from "@/game/engine/types";
import { CHAMPION_LIST, CHAMPIONS, CHAMPION_IDS } from "@/game/engine/champions";
import Lobby from "@/components/Lobby";
import GamePlay from "@/components/GamePlay";

type Screen = "menu" | "connecting" | "lobby" | "game";

function getName(): string {
  if (typeof window === "undefined") return "Player";
  return localStorage.getItem("lmao_name") || "";
}

function defaultName(): string {
  const pool = ["Jugador", "Botín", "Lanero", "Ganker", "Topo", "Feeder", "SoloQ"];
  return pool[Math.floor(Math.random() * pool.length)] + Math.floor(100 + Math.random() * 900);
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
  const attemptedQuickRef = useRef(false);

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
    async (solo: boolean, nm: string, autoStart = false, config?: Partial<GameConfig>) => {
      setScreen("connecting");
      setConnectingMsg(solo ? "Preparando la arena…" : "Abriendo tu sala al mundo…");
      const s = new HostSession(nm, solo, config);
      wire(s);
      try {
        await s.startNetworking();
        sessionRef.current = s;
        setSession(s);
        if (autoStart) {
          const cid = CHAMPION_IDS[Math.floor(Math.random() * CHAMPION_IDS.length)];
          s.pickChamp(cid);
          s.setReady(true);
          s.start();
        } else {
          setLobby({ ...s.getLobby() });
          setScreen("lobby");
        }
      } catch (e: any) {
        setError("No se pudo abrir la sala (broker WebRTC inaccesible). Igual puedes jugar contra bots sin conexión.");
        setScreen("menu");
      }
    },
    [wire]
  );

  const startJoin = useCallback(
    async (code: string, nm: string) => {
      setScreen("connecting");
      setConnectingMsg(`Entrando en la sala ${code.toUpperCase()}…`);
      const s = new ClientSession(nm);
      wire(s);
      try {
        await s.connect(code.trim());
        sessionRef.current = s;
        setSession(s);
        setScreen("lobby");
      } catch (e: any) {
        setError(e?.message || "No se pudo llegar a esa sala. Revisa el código.");
        setScreen("menu");
      }
    },
    [wire]
  );

  // Auto-trigger based on ?mode=
  useEffect(() => {
    if (screen !== "menu") return;
    if (mode === "solo" && !attemptedQuickRef.current) {
      attemptedQuickRef.current = true;
      const nm = name || defaultName();
      if (!name) {
        setName(nm);
        localStorage.setItem("lmao_name", nm);
      }
      startHost(true, nm, true);
    }
    // host/join are manual (need name/code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, name, screen]);

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
        onSolo={(n, cfg) => startHost(true, n, false, cfg)}
        onHost={(n, cfg) => startHost(false, n, false, cfg)}
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
  onSolo: (n: string, cfg: Partial<GameConfig>) => void;
  onHost: (n: string, cfg: Partial<GameConfig>) => void;
  onJoin: (code: string, n: string) => void;
  onBack: () => void;
}) {
  const [nm, setNm] = useState(name || "");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"solo" | "host" | "join">(
    mode === "host" ? "host" : mode === "join" ? "join" : "solo"
  );
  // Room setup: how many bots on your team, how many enemy bots.
  const [allyBots, setAllyBots] = useState(2);
  const [enemyBots, setEnemyBots] = useState(3);
  const [minions, setMinions] = useState(true);
  const [difficulty, setDifficulty] = useState<GameConfig["difficulty"]>("normal");
  const valid = nm.trim().length >= 2;
  const cfg = (): Partial<GameConfig> => ({
    teamSize: allyBots + 1,
    enemyBots,
    minionsEnabled: minions,
    difficulty,
    botFill: true,
  });

  return (
    <div className="overlay" style={{ position: "static", minHeight: "100vh" }}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>LMAO — League of Mobass</h2>
          <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={onBack}>
            Volver
          </button>
        </div>
        <div className="sub">Introduce un nombre y elige cómo quieres jugar.</div>

        <div className="field">
          <label>Tu nombre</label>
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
            Vs Bots
          </button>
          <button className={"btn " + (tab === "host" ? "green" : "ghost")} onClick={() => setTab("host")}>
            Crear sala
          </button>
          <button className={"btn " + (tab === "join" ? "blue" : "ghost")} onClick={() => setTab("join")}>
            Unirse
          </button>
        </div>

        {(tab === "solo" || tab === "host") && (
          <RoomSetup
            allyBots={allyBots}
            enemyBots={enemyBots}
            minions={minions}
            difficulty={difficulty}
            onAllyBots={setAllyBots}
            onEnemyBots={setEnemyBots}
            onMinions={setMinions}
            onDifficulty={setDifficulty}
          />
        )}

        {tab === "solo" && (
          <>
            <p style={{ color: "var(--ink-dim)", fontSize: 14 }}>
              Entra directo a una partida contra bots con un campeón asignado. Sin esperas ni salas.
            </p>
            <button className="btn primary" style={{ width: "100%" }} disabled={!valid} onClick={() => onSolo(nm.trim(), cfg())}>
              Jugar contra bots
            </button>
          </>
        )}
        {tab === "host" && (
          <>
            <p style={{ color: "var(--ink-dim)", fontSize: 14 }}>
              Crea una sala y consigue un código de 5 letras. Compártelo con tus amigos: los huecos vacíos se
              rellenan con bots según lo que elijas arriba.
            </p>
            <button className="btn green" style={{ width: "100%" }} disabled={!valid} onClick={() => onHost(nm.trim(), cfg())}>
              Crear sala
            </button>
          </>
        )}
        {tab === "join" && (
          <>
            <div className="field">
              <label>Código de sala</label>
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
              Unirse a la sala
            </button>
          </>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Room setup: pick how many bots on your team and how many enemy bots.
// ---------------------------------------------------------------------------
function RoomSetup({
  allyBots,
  enemyBots,
  minions,
  difficulty,
  onAllyBots,
  onEnemyBots,
  onMinions,
  onDifficulty,
}: {
  allyBots: number;
  enemyBots: number;
  minions: boolean;
  difficulty: GameConfig["difficulty"];
  onAllyBots: (n: number) => void;
  onEnemyBots: (n: number) => void;
  onMinions: (b: boolean) => void;
  onDifficulty: (d: GameConfig["difficulty"]) => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Configuración de la partida</div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>
          Compañeros bot (tu equipo): <b style={{ color: "var(--green)" }}>{allyBots}</b> — jugáis {allyBots + 1}
        </label>
        <input type="range" min={0} max={4} value={allyBots} style={{ width: "100%" }} onChange={(e) => onAllyBots(Number(e.target.value))} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>
          Bots enemigos: <b style={{ color: "var(--red)" }}>{enemyBots}</b>
        </label>
        <input type="range" min={1} max={5} value={enemyBots} style={{ width: "100%" }} onChange={(e) => onEnemyBots(Number(e.target.value))} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Dificultad de los bots</label>
        <select value={difficulty} onChange={(e) => onDifficulty(e.target.value as GameConfig["difficulty"])}>
          <option value="casual">Fácil (bots despistados)</option>
          <option value="normal">Normal</option>
          <option value="savage">Difícil (bots con cafeína)</option>
        </select>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={minions} onChange={(e) => onMinions(e.target.checked)} />
        Oleadas de minions
      </label>
    </div>
  );
}
