"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHAMPION_LIST } from "@/game/engine/champions";
import { ITEM_LIST } from "@/game/engine/items";

function useFlashCountdown() {
  const [left, setLeft] = useState(60 * 47 + 12);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => (l <= 0 ? 60 * 60 * 3 : l - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StorePage() {
  const router = useRouter();
  const flash = useFlashCountdown();
  const stars = (r: number) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));

  const go = (mode: string) => router.push(`/play?mode=${mode}`);

  return (
    <div className="store">
      <div className="topbar">
        <div className="logo">
          🛒 LMAO <small>MØØBAS</small>
        </div>
        <div className="searchbar">
          <input placeholder="Search 'legally distinct champion'…" defaultValue="league of legends" />
          <button>Search</button>
        </div>
        <div className="cart">🛒 Cart (0)</div>
      </div>

      <div className="banner">
        <b>🔥 LIGHTNING DEAL</b>
        <span className="pill">Up to 97% OFF full-price MOBAs</span>
        <span className="pill">Free* online multiplayer</span>
        <span className="flash">Ends in {flash}</span>
        <span className="pill">🚚 Instant download (no cartridge)</span>
      </div>

      <div className="hero">
        <div className="hero-card">
          <h1>
            League of <span className="zap">Møøbas</span>
            <br />Amazingly Off-brand™
          </h1>
          <p>
            Why pay $0 for that <i>other</i> game when you can pay $0 for this one? Grab a knockoff
            champion, host a room, send the 5-letter code to your friends, and race to smash the enemy
            Nexus. Bots fill any empty seats. No install, no account, no dignity required.
          </p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => go("solo")}>
              ▶ Play Now (vs Bots)
            </button>
            <button className="btn green" onClick={() => go("host")}>
              🏠 Host a Room
            </button>
            <button className="btn blue" onClick={() => go("join")}>
              🔑 Join with Code
            </button>
          </div>
          <div style={{ marginTop: 14, color: "var(--ink-dim)", fontSize: 13 }}>
            ⚡ Tip: “Host a Room” gives you a code. Friends click “Join with Code”, type it in, done.
          </div>
        </div>
        <div className="hero-side">
          <div className="stars" style={{ fontSize: 22 }}>
            ★★★★½ <span style={{ color: "var(--ink-dim)", fontSize: 13 }}>4.6 · 1,204,331 ratings</span>
          </div>
          <div className="trust">✅ Ships from: your GPU</div>
          <div className="trust">✅ 30-day return policy (returns void your MMR)</div>
          <div className="trust">✅ As seen in 3 sketchy pop-up ads</div>
          <div className="trust">✅ 100% real WebRTC peer-to-peer netcode</div>
          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
          <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            “I ordered a Support and got an item that says 'Aromor'. 5 stars, does the same thing.”
          </div>
          <button className="btn primary" onClick={() => go("solo")}>
            Add to Cart & Play
          </button>
        </div>
      </div>

      <div className="section-title">
        🧑‍🎤 Champion Catalog <span className="tag">FLASH SALE</span>
        <span style={{ fontSize: 13, color: "var(--ink-dim)", fontWeight: 400 }}>
          — {CHAMPION_LIST.length} totally original characters
        </span>
      </div>
      <div className="grid">
        {CHAMPION_LIST.map((c) => (
          <div className="card" key={c.id} onClick={() => go("solo")}>
            <div className="thumb" style={{ background: `radial-gradient(circle at 50% 40%, ${c.color}33, #161e33)` }}>
              <span className="disc">-{Math.round((1 - parseFloat(c.price.slice(1)) / parseFloat(c.listPrice.slice(1))) * 100)}%</span>
              <span className="role">{c.role}</span>
              {c.emoji}
            </div>
            <div className="body">
              <div className="name">{c.name}</div>
              <div className="title">{c.title}</div>
              <div className="price">
                <span className="now">{c.price}</span>
                <span className="was">{c.listPrice}</span>
              </div>
              <div className="rating">
                {stars(c.rating)} <span>({c.reviews.toLocaleString()})</span>
              </div>
              <div className="ship">{c.shipping}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">
        🛍️ The Bootleg Bazaar <span className="tag">ITEMS</span>
        <span style={{ fontSize: 13, color: "var(--ink-dim)", fontWeight: 400 }}>— buy these in-game with gold</span>
      </div>
      <div className="grid">
        {ITEM_LIST.slice(0, 10).map((it) => (
          <div className="card" key={it.id} onClick={() => go("solo")}>
            <div className="thumb">{it.emoji}</div>
            <div className="body">
              <div className="name">{it.name}</div>
              <div className="title">{it.desc}</div>
              <div className="price">
                <span className="now">🪙 {it.cost}</span>
                <span className="was">${it.listPrice}</span>
              </div>
              <div className="rating">{stars(it.rating)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="footer">
        LMAO — League of Møøbas is a parody. Not affiliated with, endorsed by, or legally distinct enough
        from any real game. Any resemblance to champions living or dead is a coincidence we will deny in
        court. Built with Next.js + React + WebRTC. No champions were refunded in the making of this game.
        <br />
        © {new Date().getFullYear()} Definitely Not Riot Games LLC (a shell company inside another shell company).
      </div>
    </div>
  );
}
