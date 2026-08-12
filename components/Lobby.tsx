"use client";

import { useEffect, useRef, useState } from "react";
import { GameSession } from "@/game/net/session";
import { LobbyState } from "@/game/net/protocol";
import { Team, GameConfig } from "@/game/engine/types";
import { CHAMPION_LIST, CHAMPIONS } from "@/game/engine/champions";

const ROLE_ES: Record<string, string> = {
  Fighter: "Luchador",
  Marksman: "Tirador",
  Mage: "Mago",
  Tank: "Tanque",
  Assassin: "Asesino",
  Support: "Support",
};

const DIFFS: { v: GameConfig["difficulty"]; label: string }[] = [
  { v: "casual", label: "Fácil" },
  { v: "normal", label: "Medio" },
  { v: "savage", label: "Difícil" },
];

function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="stars">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < value ? "" : "off"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function Lobby({
  session,
  lobby,
  notice,
  onLeave,
}: {
  session: GameSession;
  lobby: LobbyState;
  notice: string;
  onLeave: () => void;
}) {
  const isHost = session.role !== "client";
  const myId = session.localPlayerId;
  const mySlot = lobby.slots.find((s) => s.playerId === myId);
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<string>(mySlot?.championId || "garon");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    session.onChat((from, text) => setChat((c) => [...c.slice(-40), { from, text }]));
  }, [session]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [chat]);

  const takenChamps = new Set(lobby.slots.filter((s) => s.playerId !== myId).map((s) => s.championId));
  const hostTeam: Team = lobby.slots.find((s) => s.playerId === "host")?.team || "blue";
  const targetFor = (team: Team) => (team === hostTeam ? lobby.config.teamSize : lobby.config.enemyBots);

  const teamSlots = (team: Team) => {
    const humans = lobby.slots.filter((s) => s.team === team);
    const size = targetFor(team);
    const arr: (typeof lobby.slots[0] | null)[] = [...humans];
    while (arr.length < size) arr.push(null);
    return arr.slice(0, Math.max(size, humans.length));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const detailDef = CHAMPIONS[detail];
  const myName = mySlot?.name || "Invocador";

  return (
    <div className="lobby">
      {/* -------------------------------------------------- Top bar */}
      <div className="lobby-top">
        <span className="mark wordmark">LMAO</span>
        <div>
          <div className="cs-label">Selección de campeón</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            🗺️ El Barranco del Alboroto · 3 calles · 1–5 por equipo
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Juegas como <b style={{ color: "var(--ink)" }}>{myName}</b>
          </span>
          {session.role !== "solo" && (
            <button className="room-chip" onClick={copyCode} title="Copiar código">
              {lobby.roomCode}
              <span className="copy">{copied ? "¡Copiado!" : "Copiar"}</span>
            </button>
          )}
          {session.role === "solo" && <span className="pill plain">Práctica contra bots</span>}
          <button className="btn ghost" style={{ padding: "8px 16px" }} onClick={onLeave}>
            ← Salir
          </button>
        </div>
      </div>

      {notice && <div className="lobby-notice">{notice}</div>}

      {/* -------------------------------------------------- Body */}
      <div className="lobby-grid">
        {/* Left column: blue team + host settings */}
        <div>
          <TeamPanel
            team="blue"
            slots={teamSlots("blue")}
            target={targetFor("blue")}
            myId={myId}
            canJoin={isHost || session.role === "client"}
            onJoinTeam={() => session.setTeam("blue")}
          />

          {isHost && (
            <div className="panel">
              <div className="panel-title">Ajustes de la sala</div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Tu equipo: <b style={{ color: "var(--blue)" }}>{lobby.config.teamSize}</b> jugadores</label>
                <input type="range" min={1} max={5} value={lobby.config.teamSize} onChange={(e) => session.setConfig?.({ teamSize: Number(e.target.value) })} />
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Bots enemigos: <b style={{ color: "var(--red)" }}>{lobby.config.enemyBots}</b></label>
                <input type="range" min={1} max={5} value={lobby.config.enemyBots} onChange={(e) => session.setConfig?.({ enemyBots: Number(e.target.value) })} />
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Dificultad de los bots</label>
                <div className="segmented">
                  {DIFFS.map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      className={lobby.config.difficulty === d.v ? "active" : ""}
                      onClick={() => session.setConfig?.({ difficulty: d.v })}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="check" style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={lobby.config.botFill} onChange={(e) => session.setConfig?.({ botFill: e.target.checked })} />
                Rellenar huecos vacíos con bots
              </label>
              <label className="check">
                <input type="checkbox" checked={lobby.config.minionsEnabled} onChange={(e) => session.setConfig?.({ minionsEnabled: e.target.checked })} />
                Oleadas de minions
              </label>
            </div>
          )}
        </div>

        {/* Center column: champion select */}
        <div className="cs-panel">
          <div className="cs-head">
            <p className="eyebrow">Elige tu campeón bootleg</p>
            <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{CHAMPION_LIST.length} campeones</span>
          </div>

          <div className="cs-grid">
            {CHAMPION_LIST.map((c) => {
              const taken = takenChamps.has(c.id);
              const mine = mySlot?.championId === c.id;
              return (
                <button
                  key={c.id}
                  disabled={taken}
                  className={"cs-cell" + (mine ? " mine" : "")}
                  style={mine ? ({ ["--cc" as any]: c.color }) : undefined}
                  onMouseEnter={() => setDetail(c.id)}
                  onFocus={() => setDetail(c.id)}
                  onClick={() => {
                    session.pickChamp(c.id);
                    setDetail(c.id);
                  }}
                >
                  <span
                    className="glyph"
                    style={{ background: `linear-gradient(150deg, ${c.color}, ${c.color}99)` }}
                  >
                    {c.glyph}
                  </span>
                  <span className="cn">{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* Detail card */}
          {detailDef && (
            <div className="detail" style={{ ["--dc" as any]: `${detailDef.color}` }}>
              <div className="d-top">
                <div
                  className="d-portrait"
                  style={{ background: `linear-gradient(150deg, ${detailDef.color}, ${detailDef.color}99)` }}
                >
                  {detailDef.glyph}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="d-name" style={{ color: detailDef.color }}>{detailDef.name}</div>
                  <div className="d-title">{detailDef.title}</div>
                  <div className="d-meta">
                    <span>{ROLE_ES[detailDef.role] || detailDef.role}</span>
                    <span>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      Dificultad <Stars value={detailDef.difficulty} />
                    </span>
                    <span className="pill plain" style={{ fontSize: 11, padding: "2px 8px" }}>★ {detailDef.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="d-blurb">{detailDef.blurb}</div>

              <div className="ability-row">
                <Ability slotKey="PAS" glyph={detailDef.passive.glyph} name={detailDef.passive.name} desc={detailDef.passive.desc} />
                {detailDef.abilities.map((a, i) => (
                  <Ability key={i} slotKey={["Q", "W", "E", "R"][i]} glyph={a.glyph} name={a.name} desc={a.desc} />
                ))}
              </div>
            </div>
          )}

          {/* Ready / start */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className={"btn block " + (mySlot?.ready ? "green" : "primary")}
              onClick={() => session.setReady(!mySlot?.ready)}
            >
              {mySlot?.ready ? "✓ ¡Listo!" : "Marcar Listo"}
            </button>
            {isHost && (
              <button className="btn teal block" onClick={() => session.start?.()}>
                ▷ Empezar partida
              </button>
            )}
          </div>
          {!isHost && (
            <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 10, textAlign: "center" }}>
              Esperando a que el anfitrión empiece la partida…
            </div>
          )}
        </div>

        {/* Right column: red team + chat */}
        <div>
          <TeamPanel
            team="red"
            slots={teamSlots("red")}
            target={targetFor("red")}
            myId={myId}
            canJoin={isHost || session.role === "client"}
            onJoinTeam={() => session.setTeam("red")}
          />

          {session.role !== "solo" && (
            <div className="panel">
              <div className="panel-title">Piques y saludos</div>
              <div ref={chatRef} className="chat-log">
                {chat.length === 0 && (
                  <div style={{ color: "var(--ink-dim)" }}>Di hola (o GLHF, o algo de lo que arrepentirte).</div>
                )}
                {chat.map((c, i) => (
                  <div key={i}>
                    <b className="from">{c.from}:</b> {c.text}
                  </div>
                ))}
              </div>
              <form
                className="chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    session.sendChat(chatInput.trim().slice(0, 120));
                    setChatInput("");
                  }
                }}
              >
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe…" />
                <button className="btn blue" style={{ padding: "9px 16px" }}>Enviar</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamPanel({
  team,
  slots,
  target,
  myId,
  canJoin,
  onJoinTeam,
}: {
  team: Team;
  slots: (any | null)[];
  target: number;
  myId: string;
  canJoin: boolean;
  onJoinTeam: () => void;
}) {
  const humans = slots.filter(Boolean).length;
  return (
    <div className={"team-panel " + team}>
      <div className="team-head">
        <div className="team-name">
          {team === "blue" ? "Equipo Azul" : "Equipo Rojo"}
          <span className="team-count">{humans}/{target}</span>
        </div>
        {canJoin && (
          <button className="btn ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={onJoinTeam}>
            Unirme
          </button>
        )}
      </div>
      <div>
        {slots.map((s, i) => {
          const champ = s ? CHAMPIONS[s.championId] : null;
          return (
            <div key={i} className={"slot" + (s?.playerId === myId ? " you" : "")}>
              {champ ? (
                <span
                  className="avatar"
                  style={{ background: `linear-gradient(150deg, ${champ.color}, ${champ.color}99)` }}
                >
                  {champ.glyph}
                </span>
              ) : (
                <span className="avatar empty">+</span>
              )}
              <span className={"who" + (s ? "" : " bot")}>
                {s ? s.name : "Bot bootleg"}
                {s?.playerId === myId ? " " : ""}
                {s?.playerId === myId && <span className="tag-you">(tú)</span>}
              </span>
              {s?.ready && <span className="tag-ready">LISTO</span>}
              {!s && <span className="tag-bot">bot</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ability({ slotKey, glyph, name, desc }: { slotKey: string; glyph: string; name: string; desc: string }) {
  return (
    <div className="ability" title={desc}>
      <div className="ab-head">
        <span className="slot-key">{slotKey}</span>
        <span>{name}</span>
      </div>
      <div className="ab-desc">{desc}</div>
    </div>
  );
}
