"use client";

import { useMemo } from "react";
import { Snapshot, ChampSnap } from "@/game/net/protocol";
import { CHAMPIONS } from "@/game/engine/champions";
import { ITEM_LIST, ITEMS, RECOMMENDED } from "@/game/engine/items";
import { STRUCTURES } from "@/game/engine/constants";
import { Team } from "@/game/engine/types";

const KEYS = ["Q", "W", "E", "R"];

export default function Hud({
  snap,
  localId,
  shopOpen,
  setShopOpen,
  onBuy,
  onSell,
  onLevelUp,
  onRecall,
  onStop,
  onCastAbility,
  isTouch,
  onExit,
  onRematch,
  showHelp,
  setShowHelp,
}: {
  snap: Snapshot | null;
  localId: string;
  shopOpen: boolean;
  setShopOpen: (v: boolean) => void;
  onBuy: (id: string) => void;
  onSell: (id: string) => void;
  onLevelUp: (slot: number) => void;
  onRecall: () => void;
  onStop?: () => void;
  onCastAbility?: (slot: number) => void;
  isTouch?: boolean;
  onExit: () => void;
  onRematch?: () => void;
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}) {
  const me = snap?.champs.find((c) => c.owner === localId) || null;
  const def = me ? CHAMPIONS[me.cid] : null;

  const inFountain = useMemo(() => {
    if (!me) return false;
    const f = STRUCTURES[me.team].fountain;
    return Math.hypot(me.x - f.x, me.y - f.y) < 330;
  }, [me]);

  const mmss = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const blueTeam = snap?.champs.filter((c) => c.team === "blue") || [];
  const redTeam = snap?.champs.filter((c) => c.team === "red") || [];

  const canRank = (c: ChampSnap, slot: number) => {
    const d = CHAMPIONS[c.cid].abilities[slot];
    const maxRank = d.maxRank || 5;
    if (c.ab[slot].r >= maxRank) return false;
    if (d.ultLevels) return c.lvl >= d.ultLevels[c.ab[slot].r];
    return true;
  };

  return (
    <>
      {/* Top scoreboard */}
      {snap && (
        <div style={topBar}>
          <div style={{ fontWeight: 900, fontSize: 26, color: "var(--blue)", minWidth: 34, textAlign: "center" }}>{snap.teamKills.blue}</div>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>VS</span>
          <div style={{ textAlign: "center", minWidth: 70 }}>
            <div style={{ fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{mmss(snap.time)}</div>
            <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>Wave {snap.wave}</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>VS</span>
          <div style={{ fontWeight: 900, fontSize: 26, color: "var(--red)", minWidth: 34, textAlign: "center" }}>{snap.teamKills.red}</div>
        </div>
      )}

      {/* Team rosters */}
      {snap && (
        <div style={rosterWrap}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {blueTeam.map((c) => <RosterRow key={c.id} c={c} me={me?.id === c.id} />)}
          </div>
        </div>
      )}
      {snap && (
        <div style={{ ...rosterWrap, left: "auto", right: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            {redTeam.map((c) => <RosterRow key={c.id} c={c} me={me?.id === c.id} right />)}
          </div>
        </div>
      )}

      {/* Kill feed */}
      {snap && snap.killFeed.length > 0 && (
        <div style={killFeed}>
          {snap.killFeed.slice(-6).map((k) => (
            <div key={k.id} style={{ background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 12, marginBottom: 3 }}>
              <b style={{ color: k.killerTeam === "blue" ? "var(--blue)" : "var(--red)" }}>{k.killer}</b>
              {k.isTurret ? " 🗼 destroyed " : k.isNexus ? " 💥 DESTROYED " : " 🗡️ "}
              <b style={{ color: k.victimTeam === "blue" ? "var(--blue)" : "var(--red)" }}>{k.victim}</b>
              {k.multi ? <span style={{ color: "var(--brand-yellow)" }}> ×{k.multi}!</span> : null}
              {k.shutdown ? <span style={{ color: "var(--brand-orange)" }}> 💰SHUTDOWN</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* Bottom HUD */}
      {me && def && (
        <div style={bottomBar}>
          {/* Portrait + stats */}
          <div style={portrait}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 40, position: "relative" }}>
                {def.emoji}
                <span style={lvlBadge}>{me.lvl}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{me.name}</div>
                <Bar val={me.hp} max={me.mhp} color="#54e08a" label={`${Math.round(me.hp)}/${me.mhp}`} />
                <Bar val={me.mp} max={me.mmp} color="#3a78ff" label={me.mmp > 0 ? `${Math.round(me.mp)}/${me.mmp}` : "—"} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                  <span style={{ color: "var(--brand-yellow)", fontWeight: 800, fontSize: 13 }}>🪙 {me.gold}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>{me.k}/{me.d}/{me.a} · {me.cs} CS</span>
                </div>
              </div>
            </div>
            <div style={statGrid}>
              <Stat label="AD" v={me.ad} /><Stat label="AP" v={me.ap} />
              <Stat label="AR" v={me.armor} /><Stat label="MR" v={me.mr} />
              <Stat label="AS" v={me.as.toFixed(2)} /><Stat label="Crit" v={Math.round(me.crit * 100) + "%"} />
            </div>
          </div>

          {/* Abilities */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={passiveIcon} title={`${def.passive.name}: ${def.passive.desc}`}>
              <div style={{ fontSize: 26 }}>{def.passive.emoji}</div>
              <div style={{ fontSize: 9, color: "var(--ink-dim)" }}>Passive</div>
            </div>
            {def.abilities.map((a, i) => {
              const ab = me.ab[i];
              const onCd = ab.cd > 0;
              const learned = ab.r > 0;
              const showPlus = me.points > 0 && canRank(me, i);
              return (
                <div
                  key={i}
                  onClick={() => learned && !onCd && onCastAbility?.(i)}
                  style={{ ...abilityBox, opacity: learned ? 1 : 0.55, borderColor: learned ? "var(--brand-orange)" : "var(--border)", cursor: learned ? "pointer" : "default" }}
                  title={`${a.name}: ${a.desc}`}
                >
                  <div style={{ fontSize: 28 }}>{a.emoji}</div>
                  {onCd && <div style={cdOverlay}>{ab.cd.toFixed(1)}</div>}
                  <div style={keyBadge}>{isTouch ? "" : KEYS[i]}</div>
                  <div style={rankPips}>
                    {Array.from({ length: a.maxRank || 5 }).map((_, r) => (
                      <span key={r} style={{ width: 6, height: 4, borderRadius: 1, background: r < ab.r ? "var(--brand-yellow)" : "rgba(255,255,255,0.2)" }} />
                    ))}
                  </div>
                  {showPlus && (
                    <button style={plusBtn} onClick={(e) => { e.stopPropagation(); onLevelUp(i); }}>+</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Items + actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gridTemplateRows: "repeat(2, 34px)", gap: 4 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const it = me.items[i] ? ITEMS[me.items[i]] : null;
                return (
                  <div key={i} title={it?.name} onClick={() => it && onSell(me.items[i])} style={{ ...itemSlot, cursor: it ? "pointer" : "default" }}>
                    {it ? it.emoji : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn primary" style={miniBtn} onClick={() => setShopOpen(!shopOpen)}>🛒 Shop</button>
              <button className="btn blue" style={miniBtn} onClick={onRecall}>🏠 Recall</button>
              <button className="btn ghost" style={miniBtn} onClick={() => onStop?.()}>✋ Stop</button>
            </div>
          </div>
        </div>
      )}

      {/* Level-up hint */}
      {me && me.points > 0 && (
        <div style={pointsHint}>⬆️ {me.points} ability point{me.points > 1 ? "s" : ""}! Click the + (or Ctrl+Q/W/E/R)</div>
      )}

      {/* Shop overlay */}
      {shopOpen && me && (
        <Shop me={me} inFountain={inFountain} onBuy={onBuy} onSell={onSell} onClose={() => setShopOpen(false)} role={def?.role || "Fighter"} />
      )}

      {/* Countdown */}
      {snap?.phase === "countdown" && (
        <div style={fullOverlay}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 54, fontWeight: 900 }}>🛒 GET READY 🛒</div>
            <div style={{ color: "var(--ink-dim)", fontSize: 18 }}>Minions incoming. Destroy the enemy Nexus. Don't int.</div>
            {me && <div style={{ marginTop: 16, fontSize: 40 }}>{CHAMPIONS[me.cid].emoji} You are {me.name}</div>}
          </div>
        </div>
      )}

      {/* Death overlay */}
      {me && !me.alive && snap?.phase === "playing" && (
        <div style={{ ...fullOverlay, background: "rgba(40,0,0,0.55)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: "var(--red)" }}>💀 REFUNDED</div>
            <div style={{ fontSize: 22 }}>Respawning in {Math.ceil(me.rt)}s…</div>
            <div style={{ color: "var(--ink-dim)", marginTop: 8 }}>Tip: standing in things that hurt is bad, actually.</div>
          </div>
        </div>
      )}

      {/* End screen */}
      {snap?.phase === "ended" && snap.winner && (
        <EndScreen snap={snap} localTeam={me?.team || "blue"} onExit={onExit} onRematch={onRematch} />
      )}

      {/* Help */}
      <button style={helpBtn} onClick={() => setShowHelp(!showHelp)}>?</button>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

function TeamScore({ team, kills, gold, right }: { team: Team; kills: number; gold: number; right?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start" }}>
      <div style={{ fontWeight: 900, fontSize: 20, color: team === "blue" ? "var(--blue)" : "var(--red)" }}>
        {team === "blue" ? "🔵 Blue" : "Red 🔴"} · {kills} kills
      </div>
      <div style={{ fontSize: 12, color: "var(--brand-yellow)" }}>🪙 {gold.toLocaleString()}</div>
    </div>
  );
}

function RosterRow({ c, me, right }: { c: ChampSnap; me?: boolean; right?: boolean }) {
  const def = CHAMPIONS[c.cid];
  const hp = Math.max(0, c.hp / c.mhp);
  return (
    <div style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 6, background: me ? "rgba(255,180,60,0.18)" : "rgba(0,0,0,0.5)", border: me ? "1px solid var(--brand-yellow)" : "1px solid var(--border)", borderRadius: 8, padding: "3px 7px", fontSize: 12, minWidth: 150 }}>
      <span style={{ fontSize: 20, opacity: c.alive ? 1 : 0.4 }}>{def?.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <b>{c.name}</b>
          <span style={{ color: "var(--ink-dim)" }}>Lv{c.lvl}</span>
        </div>
        <div style={{ height: 4, background: "rgba(0,0,0,0.5)", borderRadius: 2, marginTop: 2 }}>
          <div style={{ height: "100%", width: `${hp * 100}%`, background: c.alive ? (c.team === "blue" ? "#3aa0ff" : "#ff5a52") : "#555", borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>{c.k}/{c.d}/{c.a} · {c.cs}cs {c.alive ? "" : `· ☠️${Math.ceil(c.rt)}s`}</div>
      </div>
    </div>
  );
}

function Bar({ val, max, color, label }: { val: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, val / max)) : 0;
  return (
    <div style={{ position: "relative", height: 14, background: "rgba(0,0,0,0.5)", borderRadius: 4, marginTop: 3, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: color, borderRadius: 4 }} />
      <div style={{ position: "absolute", inset: 0, textAlign: "center", fontSize: 9, lineHeight: "14px", textShadow: "0 1px 2px #000" }}>{label}</div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: any }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 5, padding: "2px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "var(--ink-dim)" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{v}</div>
    </div>
  );
}

function Shop({ me, inFountain, onBuy, onSell, onClose, role }: { me: ChampSnap; inFountain: boolean; onBuy: (id: string) => void; onSell: (id: string) => void; onClose: () => void; role: string }) {
  const rec = RECOMMENDED[role] || [];
  return (
    <div style={shopWrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>🛍️ The Bootleg Bazaar</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "var(--brand-yellow)", fontWeight: 800 }}>🪙 {me.gold}</span>
          <button className="btn ghost" style={{ padding: "4px 12px" }} onClick={onClose}>✕</button>
        </div>
      </div>
      {!inFountain && <div style={{ color: "var(--brand-orange)", fontSize: 13, marginBottom: 8 }}>⚠️ Return to your fountain (press B to recall) to buy items.</div>}
      {rec.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>⭐ Recommended for {role}:</div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {rec.map((id) => {
          const it = ITEMS[id];
          const afford = me.gold >= it.cost && inFountain && me.items.length < 6 && !me.items.includes(id);
          return (
            <button key={id} disabled={!afford} onClick={() => onBuy(id)} style={{ ...recItem, opacity: afford ? 1 : 0.5 }}>
              {it.emoji} {it.name} · 🪙{it.cost}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, maxHeight: "38vh", overflowY: "auto" }}>
        {ITEM_LIST.map((it) => {
          const owned = me.items.includes(it.id);
          const afford = me.gold >= it.cost && inFountain && me.items.length < 6;
          return (
            <button key={it.id} disabled={!afford && !owned} onClick={() => onBuy(it.id)} title={it.desc} style={{ ...shopItem, opacity: afford || owned ? 1 : 0.55, borderColor: owned ? "var(--green)" : "var(--border)" }}>
              <span style={{ fontSize: 22 }}>{it.emoji}</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{it.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-dim)", lineHeight: 1.2 }}>{it.desc}</div>
              </div>
              <span style={{ color: "var(--brand-yellow)", fontWeight: 800, fontSize: 12 }}>🪙{it.cost}</span>
            </button>
          );
        })}
      </div>
      {me.items.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-dim)" }}>
          Owned (click to sell 70%): {me.items.map((id, i) => (
            <button key={i} onClick={() => onSell(id)} style={sellChip}>{ITEMS[id]?.emoji} {ITEMS[id]?.name} ✕</button>
          ))}
        </div>
      )}
    </div>
  );
}

function EndScreen({ snap, localTeam, onExit, onRematch }: { snap: Snapshot; localTeam: Team; onExit: () => void; onRematch?: () => void }) {
  const win = snap.winner === localTeam;
  const sorted = [...snap.champs].sort((a, b) => b.k - a.k);
  return (
    <div style={{ ...fullOverlay, background: "rgba(3,6,14,0.92)", flexDirection: "column" }}>
      <div style={{ fontSize: 72, fontWeight: 900, color: win ? "var(--brand-yellow)" : "var(--red)", textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
        {win ? "🏆 VICTORY" : "💀 DEFEAT"}
      </div>
      <div style={{ color: "var(--ink-dim)", marginBottom: 18 }}>
        {win ? "Your bootleg reign is complete. Please rate 5 stars." : "Refunded. The enemy Nexus files for warranty."}
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, width: "min(560px, 92vw)" }}>
        {sorted.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 22 }}>{CHAMPIONS[c.cid]?.emoji}</span>
            <b style={{ flex: 1, color: c.team === "blue" ? "var(--blue)" : "var(--red)" }}>{c.name}</b>
            <span style={{ fontSize: 13 }}>{c.k}/{c.d}/{c.a}</span>
            <span style={{ fontSize: 12, color: "var(--ink-dim)", width: 60, textAlign: "right" }}>{c.cs} CS</span>
            <span style={{ fontSize: 12, color: "var(--brand-yellow)", width: 40, textAlign: "right" }}>Lv{c.lvl}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        {onRematch && <button className="btn green" onClick={onRematch}>🔁 Rematch</button>}
        <button className="btn primary" onClick={onExit}>🛒 Back to Store</button>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎮 How to Play</h2>
        <div className="sub">You've got this. Probably.</div>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>📱 Touch / Tablet</div>
        <ul style={{ lineHeight: 1.8, fontSize: 14, marginTop: 0 }}>
          <li><b>Tap / drag the map</b> — move · <b>tap an enemy</b> — attack it</li>
          <li><b>Tap an ability button</b> (Q/W/E/R) — auto-aims at the nearest enemy</li>
          <li><b>Pinch</b> — zoom · <b>Shop / Recall / Stop</b> buttons bottom-right</li>
          <li><b>＋ on an ability</b> — level it up</li>
        </ul>
        <div style={{ fontWeight: 800, margin: "8px 0 4px" }}>🖱️ Mouse / Keyboard</div>
        <ul style={{ lineHeight: 1.8, fontSize: 14, marginTop: 0 }}>
          <li><b>Right-click</b> — move / attack · <b>Q W E R</b> — cast at cursor</li>
          <li><b>A</b> attack-move · <b>S</b> stop · <b>B</b> recall · <b>P</b> shop</li>
          <li><b>Ctrl+Q/W/E/R</b> — level up · <b>Wheel</b> zoom · <b>Alt+Click</b> ping</li>
        </ul>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 10 }}>
          Goal: push a lane with your minions, destroy the enemy turrets, then smash their <b>Nexus</b>.
          Last-hit minions for 🪙 gold, buy items, snowball, win. It's basically the real game but 97% off.
        </div>
        <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

// ---- styles ----
const topBar: React.CSSProperties = { position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "center", background: "rgba(0,0,0,0.6)", borderRadius: 12, padding: "6px 20px", border: "1px solid var(--border)" };
const rosterWrap: React.CSSProperties = { position: "absolute", top: 70, left: 8 };
const killFeed: React.CSSProperties = { position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", width: 340, textAlign: "center" };
const bottomBar: React.CSSProperties = { position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "flex-end", background: "rgba(0,0,0,0.5)", borderRadius: 14, padding: "10px 16px", border: "1px solid var(--border)" };
const portrait: React.CSSProperties = { width: 230 };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, marginTop: 6 };
const lvlBadge: React.CSSProperties = { position: "absolute", bottom: -4, right: -6, background: "#0d1220", border: "2px solid var(--brand-yellow)", color: "var(--brand-yellow)", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
const abilityBox: React.CSSProperties = { position: "relative", width: 58, height: 58, borderRadius: 10, background: "var(--panel-2)", border: "2px solid var(--brand-orange)", display: "flex", alignItems: "center", justifyContent: "center" };
const passiveIcon: React.CSSProperties = { width: 48, height: 58, borderRadius: 10, background: "var(--panel)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" };
const cdOverlay: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(0,0,0,0.66)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 };
const keyBadge: React.CSSProperties = { position: "absolute", top: 2, left: 4, fontSize: 11, fontWeight: 800, color: "var(--brand-yellow)" };
const rankPips: React.CSSProperties = { position: "absolute", bottom: 3, left: 0, right: 0, display: "flex", gap: 2, justifyContent: "center" };
const plusBtn: React.CSSProperties = { position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "var(--green)", color: "#fff", border: "2px solid #fff", fontWeight: 900, fontSize: 14, lineHeight: "18px", padding: 0, animation: "pulse 1s infinite" };
const itemSlot: React.CSSProperties = { width: 34, height: 34, borderRadius: 6, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 };
const miniBtn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };
const pointsHint: React.CSSProperties = { position: "absolute", bottom: 92, left: "50%", transform: "translateX(-50%)", background: "var(--green)", color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 };
const shopWrap: React.CSSProperties = { position: "absolute", bottom: 100, left: 12, width: "min(560px, 94vw)", background: "rgba(10,14,24,0.97)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" };
const shopItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", color: "var(--ink)" };
const recItem: React.CSSProperties = { background: "var(--panel-2)", border: "1px solid var(--brand-orange)", borderRadius: 8, padding: "6px 10px", color: "var(--ink)", fontSize: 12, fontWeight: 700 };
const sellChip: React.CSSProperties = { background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px", margin: "0 4px", color: "var(--ink)", fontSize: 11, cursor: "pointer" };
const fullOverlay: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(3,6,14,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 };
const helpBtn: React.CSSProperties = { position: "absolute", bottom: 10, right: 10, width: 36, height: 36, borderRadius: "50%", background: "var(--panel)", border: "1px solid var(--border)", color: "var(--ink)", fontWeight: 900, fontSize: 18, zIndex: 61 };
