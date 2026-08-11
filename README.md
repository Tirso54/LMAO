# LMAO — League of Mobass: The Amazingly Off-brand MOBA

> Why pay full price for a MOBA when you can pay **$0** for this legally-distinct one?
> **LMAO** is a bargain-bin *League of Legends* knockoff you can actually play online with your friends.

A complete, browser-based ARAM-style MOBA built with **Next.js + React + TypeScript**, a pure-TypeScript
authoritative game engine, an HTML5 Canvas renderer, and **host-authoritative WebRTC (PeerJS) netcode** —
so it deploys anywhere Next.js does, with **no dedicated game server required.**

*(“LMAO” officially stands for **L**eague of **M**obass: **A**mazingly **O**ff-brand.)*

---

## What's in the box

- **A parody bargain-bin storefront** front-end (fake discounts, flash-sale timers, star reviews, dropshipping jokes).
- **Real online multiplayer.** The host creates a room and gets a 5-letter code; friends type it in to join —
  exactly the "join the host's room" model of modern web multiplayer games. Empty seats fill with **AI bots**,
  so it's fully playable solo too.
- **8 legally-distinct champions**, each with a passive + Q/W/E/R abilities (skillshots, dashes, hooks,
  global ults, executes, traps, shields…): Yasøu, Teemoo, Ashee, Garón, Jinix, Luux, Blïtzcronk, Dariôs.
- **A full MOBA loop:** minion waves, turrets, a Nexus, last-hitting for gold, shared XP, 18 levels,
  ability ranking, respawn timers, kill/assist bounties, multikills & shutdowns.
- **The Bootleg Bazaar** in-game item shop (Infoggnity Edge, Rabadong's Deathkap, Ninja Tabbies…).
- **AI bots** that farm, poke, engage, kite, retreat, recall, buy items, and push to end the game.
- **Classic controls:** right-click move/attack, QWER quick-cast, attack-move, recall, shop, ping, zoom.

## How to win

Push a lane with your minions, take down the enemy turrets, then smash their **Nexus**. Last-hit minions
for gold, buy items, snowball, win. It's basically the real game, but 97% off.

## Controls

| Action | Input |
| --- | --- |
| Move / attack an enemy | **Right-click** |
| Cast abilities (quick-cast toward cursor) | **Q W E R** |
| Attack-move / Stop | **A** / **S** |
| Recall to base | **B** |
| Open shop (must be in fountain) | **P** |
| Level up an ability | the **＋** button or **Ctrl+Q/W/E/R** |
| Zoom / Ping | **Mouse wheel** / **Alt+Click** |

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
# or
npm run build && npm run start
```

Open the store, hit **Play Now (vs Bots)**, or **Host a Room** and share the code.

### Deploy to Vercel

This is a **zero-config Next.js app** — Vercel auto-detects the framework, build command, and output.
No environment variables, no database, no serverless functions to configure.

**Option A — Vercel dashboard:**
1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Leave every setting on its default (Framework Preset: **Next.js**, Build Command: `next build`,
   Output: managed automatically). Click **Deploy**.
4. You'll get a `*.vercel.app` URL — that's the whole game, portal and all.

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel        # first deploy, follow the prompts
vercel --prod # promote to production
```

All real-time gameplay runs peer-to-peer in the browsers via WebRTC, using PeerJS's public broker
purely for signaling (finding peers) — **no backend/game server or database is needed**, so the
Vercel deployment is 100% static/serverless-friendly. Hosting elsewhere (Netlify, Node server, etc.)
works the same way — it's a standard `next build && next start` app.

## Architecture

```
app/                     Next.js App Router (store portal + /play)
components/               React UI — GameShell, Lobby, GamePlay (canvas), Hud
game/
  engine/                Pure-TS authoritative simulation (framework-agnostic)
    types, constants, math, champions, items, stats,
    combat, abilities, ai, simulation, setup
  net/                   Netcode: protocol/snapshots, PeerJS wrapper, Host/Client/Solo sessions
  render/                Canvas renderer, snapshot interpolation, FX particle system
```

**Netcode model:** the host runs the authoritative simulation at 30 ticks/s. Clients send input intents and
receive ~20 Hz snapshots, which the renderer interpolates for smooth 60fps play. When a player disconnects,
their champion is handed to the AI. Solo play is just a host with no remote peers.

---

*LMAO — League of Mobass is a parody and is not affiliated with, endorsed by, or legally distinct enough from
any real game. Any resemblance to champions living or dead is a coincidence we will deny in court.*
