"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameSession } from "@/game/net/session";
import { LobbyState } from "@/game/net/protocol";
import { Team, GameConfig } from "@/game/engine/types";
import { CHAMPION_LIST, CHAMPIONS } from "@/game/engine/champions";

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

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/play?mode=join` : "";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const detailDef = CHAMPIONS[detail];

  return (
    <div className="center" style={{ alignItems: "stretch", padding: 0, minHeight: "100vh", justifyContent: "flex-start" }}>
      <div style={{ padding: "14px 20px", background: "linear-gradient(90deg, #16202e, #101722)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
        <div className="logo" style={{ fontSize: 22 }}>
          LMAO — Mobass
        </div>
        {session.role !== "solo" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--ink)", fontWeight: 700 }}>Código de sala:</span>
            <button onClick={copyCode} className="flash" style={{ fontSize: 24, letterSpacing: 4, cursor: "pointer" }}>
              {lobby.roomCode} {copied ? "Copied!" : "Copy"}
            </button>
            <span style={{ color: "var(--ink-dim)", fontSize: 12 }}>
              Tus amigos entran con <b>Unirse con código</b> y escriben esto.
            </span>
          </div>
        )}
        {session.role === "solo" && <span style={{ color: "var(--ink)", fontWeight: 700 }}>Práctica contra bots</span>}
        <div style={{ marginLeft: "auto" }}>
          <button className="btn ghost" style={{ padding: "8px 14px" }} onClick={onLeave}>
            Salir
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ background: "#111", color: "var(--brand-yellow)", padding: "8px 20px", fontSize: 13 }}>{notice}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, padding: 16, alignItems: "start" }} className="lobby-grid">
        {/* Teams */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TeamPanel team="blue" slots={teamSlots("blue")} myId={myId} canJoin={isHost || session.role === "client"} onJoinTeam={() => session.setTeam("blue")} />
          <TeamPanel team="red" slots={teamSlots("red")} myId={myId} canJoin={isHost || session.role === "client"} onJoinTeam={() => session.setTeam("red")} />

          {isHost && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Ajustes de la sala (Host)</div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Tu equipo: <b>{lobby.config.teamSize}</b> jugadores</label>
                <input type="range" min={1} max={5} value={lobby.config.teamSize} style={{ width: "100%" }} onChange={(e) => session.setConfig?.({ teamSize: Number(e.target.value) })} />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Bots enemigos: <b>{lobby.config.enemyBots}</b></label>
                <input type="range" min={1} max={5} value={lobby.config.enemyBots} style={{ width: "100%" }} onChange={(e) => session.setConfig?.({ enemyBots: Number(e.target.value) })} />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Bot Difficulty</label>
                <select value={lobby.config.difficulty} onChange={(e) => session.setConfig?.({ difficulty: e.target.value as any })}>
                  <option value="casual">Casual (bots blindfolded)</option>
                  <option value="normal">Normal</option>
                  <option value="savage">Savage (bots caffeinated)</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={lobby.config.botFill} onChange={(e) => session.setConfig?.({ botFill: e.target.checked })} />
                Fill empty seats with AI bots
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 6 }}>
                <input type="checkbox" checked={lobby.config.minionsEnabled} onChange={(e) => session.setConfig?.({ minionsEnabled: e.target.checked })} />
                Spawn minion waves
              </label>
            </div>
          )}

          {/* Chat */}
          {session.role !== "solo" && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Trash Talk</div>
              <div ref={chatRef} style={{ height: 120, overflowY: "auto", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                {chat.length === 0 && <div style={{ color: "var(--ink-dim)" }}>Say hi (or GLHF, or something regrettable).</div>}
                {chat.map((c, i) => (
                  <div key={i}>
                    <b style={{ color: "var(--brand-orange)" }}>{c.from}:</b> {c.text}
                  </div>
                ))}
              </div>
              <form
                style={{ display: "flex", gap: 6, marginTop: 6 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    session.sendChat(chatInput.trim().slice(0, 120));
                    setChatInput("");
                  }
                }}
              >
                <input style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--ink)" }} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type…" />
                <button className="btn blue" style={{ padding: "8px 14px" }}>Send</button>
              </form>
            </div>
          )}
        </div>

        {/* Champion select */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 18 }}>Elige tu campeón</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
            {CHAMPION_LIST.map((c) => {
              const taken = takenChamps.has(c.id);
              const mine = mySlot?.championId === c.id;
              return (
                <button
                  key={c.id}
                  disabled={taken}
                  onMouseEnter={() => setDetail(c.id)}
                  onClick={() => {
                    session.pickChamp(c.id);
                    setDetail(c.id);
                  }}
                  style={{
                    background: mine ? "linear-gradient(135deg, var(--brand-orange), var(--brand-red))" : "var(--bg-2)",
                    border: mine ? "2px solid #fff" : "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 4px",
                    color: taken ? "var(--ink-dim)" : "var(--ink)",
                    opacity: taken ? 0.4 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 26 }}>{c.glyph}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* Detail card */}
          {detailDef && (
            <div style={{ marginTop: 14, background: "var(--bg-2)", borderRadius: 12, padding: 14, border: `1px solid ${detailDef.color}55` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 44 }}>{detailDef.glyph}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: detailDef.color }}>{detailDef.name}</div>
                  <div style={{ color: "var(--ink-dim)", fontSize: 13 }}>{detailDef.title} · {detailDef.role} · Difficulty {"•".repeat(detailDef.difficulty)}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, margin: "10px 0", fontStyle: "italic", color: "var(--ink-dim)" }}>{detailDef.blurb}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Ability glyph={detailDef.passive.glyph} name={detailDef.passive.name} desc={detailDef.passive.desc} tag="Passive" />
                {detailDef.abilities.map((a, i) => (
                  <Ability key={i} glyph={a.glyph} name={a.name} desc={a.desc} tag={["Q", "W", "E", "R"][i]} />
                ))}
              </div>
            </div>
          )}

          {/* Ready / Start */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <button
              className={"btn " + (mySlot?.ready ? "green" : "primary")}
              style={{ flex: 1 }}
              onClick={() => session.setReady(!mySlot?.ready)}
            >
              {mySlot?.ready ? "¡Listo!" : "Marcar Listo"}
            </button>
            {isHost && (
              <button
                className="btn green"
                style={{ flex: 1 }}
                onClick={() => session.start?.()}
              >
                Empezar partida
              </button>
            )}
          </div>
          {!isHost && <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 8, textAlign: "center" }}>Waiting for the host to start the match…</div>}
        </div>
      </div>

      <style>{`@media (max-width: 820px){ .lobby-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function TeamPanel({ team, slots, myId, canJoin, onJoinTeam }: { team: Team; slots: (any | null)[]; myId: string; canJoin: boolean; onJoinTeam: () => void }) {
  const color = team === "blue" ? "var(--blue)" : "var(--red)";
  return (
    <div style={{ background: "var(--panel)", border: `1px solid ${color}55`, borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color }}>{team === "blue" ? "Blue Bootlegs" : "Red Refunds"}</div>
        {canJoin && (
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={onJoinTeam}>
            Join
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slots.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--bg-2)", borderRadius: 8, opacity: s ? 1 : 0.5 }}>
            <span style={{ fontSize: 22 }}>{s ? CHAMPIONS[s.championId]?.glyph : "+"}</span>
            <span style={{ flex: 1, fontWeight: s?.playerId === myId ? 800 : 500 }}>
              {s ? s.name : "AI Bootleg Bot"} {s?.playerId === myId ? "(you)" : ""}
            </span>
            {s?.ready && <span style={{ color: "var(--green)", fontSize: 12, fontWeight: 800 }}>READY</span>}
            {!s && <span style={{ color: "var(--ink-dim)", fontSize: 11 }}>bot</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Ability({ glyph, name, desc, tag }: { glyph: string; name: string; desc: string; tag: string }) {
  return (
    <div title={desc} style={{ flex: "1 1 30%", minWidth: 120, background: "var(--panel-2)", borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>
        <span style={{ background: "#000", borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>{tag}</span>
        {glyph} {name}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3, lineHeight: 1.3 }}>{desc}</div>
    </div>
  );
}
