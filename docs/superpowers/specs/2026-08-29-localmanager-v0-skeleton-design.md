# LocalManager v0 — Skeleton Design

**Date:** 2026-08-29  
**Status:** Approved in brainstorming (Approach 1)  
**Product name:** LocalManager  
**Repo:** https://github.com/Never-lab/localmanager  

Educational Italian mayor sim: manage a real municipality from a desk, grow it, survive politics, see the town map evolve. Not administrative or political advice.

## Goals (v0 done-when)

A player can: start a new game on **Santa Maria Imbaro (CH)** → use desk actions → **close month** → see **map regenerate** at least once when infrastructure changed → see **people / political reputation** meters and a **rival** → save to **cloud** when logged in → deploy **staging on Railway** healthy.

## Non-goals (v0)

- Multiple municipalities or live ISTAT ingestion
- City council / formal delibere voting
- Multiplayer, mobile-first polish, long tutorial, heavy marketing landing
- Interactive GIS tiles or frame-by-frame map animation (crossfade between PNGs only)
- SQLite or dual storage backends

## Architecture

Monorepo in this workspace (replaces hub-only role; keep `.cursor` skills).

| Path | Role |
|------|------|
| `apps/web` | React 19 + Vite + Zustand; Italian UI; desk + map |
| `apps/api` | Node ≥20; auth/sessions; cloud saves; map job enqueue/status; serves built web |
| `packages/sim` | Pure TypeScript simulation (no React) |
| `packages/shared` | `GameState` types, API DTOs, shared constants |
| `services/maps` | Python + prettymaps worker; basemap + overlay → PNG |
| `data/comuni/santa-maria-imbaro/` | Versioned real-data snapshot + map slots |

**Railway:** two services sharing one Postgres — `web-api` and `maps` worker.

**Data flow:** UI actions → sim state → on month close, if infrastructure overlay dirty → `map_jobs` row → maps worker → PNG artifact → client shows new `mapVersion`.

## Simulation loop

- **Tick:** 1 month  
- **Mandate:** 48 months → election → win/lose / gameover  

**`GameState` (minimum):** municipal cash; population; mean age (snapshot + slow drift); people reputation 0–100; political reputation 0–100; staff (few roles: secretary, technician, communicator); active/completed projects; event queue; rival (heat + last move); map overlay dirty flag; Italian log.

**Month-close pipeline (`packages/sim`):**

1. Apply fixed costs (staff, maintenance)
2. Advance projects → completions → effects + set map dirty
3. Resolve pending province funding request
4. Light demographic drift + minor shocks from config
5. Rival move every **6 months** (press attack / promises / meter erosion)
6. Update both meters from month actions
7. Append log; if month == 48 → `resolveElection()`: player wins if `(peopleRep + politicalRep) / 2 >= rivalHeat` (all 0–100 scale); else lose. Exact weights live in sim config + tests.

**In-month desk actions:** constrained budget allocations; start/accelerate infrastructure projects (2–3 seed types); province funding request; limited hire/fire; press release (people vs political tradeoff); respond to rival event; **Close month**.

All balance numbers live in `packages/sim` config + Vitest tests — no magic constants in UI.

## Map system

- Regenerate **on month close** only if infrastructure overlay changed.
- Job contract: input `{ comuneId, runId, overlay, basemapRevision }` → PNG (+ optional thumb) + `mapVersion`; states `pending` → `running` → `ready` | `failed` (bounded retries).
- **Overlay model:** predefined geographic slots in seed data (not freeform OSM editing). Completing a project activates/styles a slot. prettymaps draws OSM basemap; overlay composited on top.
- API: `GET /api/runs/:id/map` returns current asset URL/version; UI badge “updated at month X” / spinner while job pending.
- CI: fixture PNGs + job contract tests; full prettymaps render not required in CI.

## Comune data (Santa Maria Imbaro)

Under `data/comuni/santa-maria-imbaro/`:

- `meta.json` — ISTAT code, name, province, OSM bounds, sources + snapshot dates
- `demographics.json` — population, mean age (age bands if available)
- `budget.json` — simplified opening cash / income-expense types (educational model)
- `projects.json` — 2–3 project templates (cost, months, effects, map slot)
- `map/slots.json` — overlay slots + simplified geometries
- `SOURCES.md` — ISTAT / budgets / OSM links + educational disclaimer

Loaded at `createInitialGameState()`; no live fetches in v0. UI disclaimer: educational model, not advice.

## UI

Screens (Zustand): `auth` → `menu` → `setup` (confirm comune + mayor name) → `game` → `gameover`.

**Game layout:** one desk composition — map as dominant visual; panels for cash, meters, staff, projects, province funds, press, event log; bar with month/mandate, rival heat, Close month. Disabled controls explain why + what to do. Player-facing copy in Italian.

## Auth, persistence, deploy

- Guest: local slots only  
- Account: register/login; HMAC sessions (~2h idle / ~7d absolute, Floatdesk-like); cloud saves in Postgres  
- Health: `GET /api/health` → `storage: postgres` and maps worker reachability when configured  
- Tests: Vitest on sim; map job contract with fixtures; lint/tsc/build for web+api  

## Agent / repo conventions

- Chat Italian; code / PR / issues English; player UI Italian  
- Commit/push only when asked; no `Co-authored-by: Cursor`  
- Prefer ponytail + Karpathy; Superpowers for ambiguous slices  
- Add root `CLAUDE.md` / `AGENTS.md` for this product; update hub `PROJECTS.md` so localmanager is the game, not skills-only  

## Decisions log

| Topic | Choice |
|-------|--------|
| v0 map | Live update on month close if dirty |
| Workspace | This folder = game repo |
| Layout | Monorepo `web` + `api` + `maps` |
| DB | Postgres only |
| Comune | Santa Maria Imbaro only |
| Politics | Meters + periodic rival + election at month 48 |
| Auth | Guest local + account cloud |
| Desk | Budget, projects, funds, staff, press, rival |
| Name | LocalManager |
| Approach | Floatdesk DNA + maps worker |
