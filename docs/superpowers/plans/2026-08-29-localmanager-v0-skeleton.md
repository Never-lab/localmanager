# LocalManager v0 Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable LocalManager skeleton: Santa Maria Imbaro desk loop, dual reputation + rival + election, month-close map regen via prettymaps worker, Postgres auth/saves, Railway staging.

**Architecture:** npm workspaces monorepo — `packages/shared` types, `packages/sim` pure TS month loop, `apps/web` React desk, `apps/api` Node+Postgres, `services/maps` Python worker. Map jobs enqueue on dirty month close.

**Tech Stack:** Node ≥20.19, TypeScript, React 19, Vite, Zustand, Vitest, `pg`, Python 3.11+, prettymaps/matplotlib, Postgres, Railway (2 services).

## Global Constraints

- Player-facing UI copy: Italian; code/PR/issues: English
- Chat with user: Italian
- Numbers only from `packages/sim` config + `data/comuni/...` JSON — never invent balances in UI
- Postgres only (`DATABASE_URL` required for API)
- Single comune v0: Santa Maria Imbaro (ISTAT `069084`)
- Map regen only on month close when overlay dirty
- Rival move every 6 months; mandate 48 months; election: `(peopleRep + politicalRep) / 2 >= rivalHeat`
- No `Co-authored-by: Cursor`; commit only when the user asks (plan commit steps = suggested messages for when they do)
- Educational disclaimer required in UI + `SOURCES.md`
- Spec: `docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md`

## File structure (create)

```
package.json                 # workspaces root
tsconfig.base.json
CLAUDE.md / AGENTS.md / README.md / PROJECTS.md (update)
data/comuni/santa-maria-imbaro/{meta,demographics,budget,projects}.json
data/comuni/santa-maria-imbaro/map/slots.json
data/comuni/santa-maria-imbaro/SOURCES.md
packages/shared/package.json + src/{index,types,dto}.ts
packages/sim/package.json + src/{index,config,loadComune,createInitial,advanceMonth,actions,election,rng}.ts
packages/sim/src/*.test.ts
apps/api/package.json + src/{index,db,auth,saves,mapJobs,health}.mjs|.ts
apps/web/package.json + vite + src/{App,store,screens/*,components/*}
services/maps/{requirements.txt,worker.py,render.py,Dockerfile}
.github/workflows/ci.yml
railway.toml / nixpacks notes in README
```

---

### Task 1: Monorepo scaffold + agent docs

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `README.md`
- Modify: `PROJECTS.md` (localmanager = game, not hub-only)

**Interfaces:**
- Produces: npm workspaces `apps/*`, `packages/*`; root scripts `test`, `build`, `lint`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "localmanager",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20.19.0" },
  "scripts": {
    "test": "npm run test -w @localmanager/sim",
    "build": "npm run build -w @localmanager/shared && npm run build -w @localmanager/sim && npm run build -w @localmanager/web && npm run build -w @localmanager/api",
    "dev:web": "npm run dev -w @localmanager/web",
    "dev:api": "npm run dev -w @localmanager/api",
    "lint": "npm run lint -w @localmanager/sim --if-present"
  }
}
```

- [ ] **Step 2: Write `tsconfig.base.json` and `.gitignore`**

`tsconfig.base.json`: `strict: true`, `module: NodeNext`, `target: ES2022`, `skipLibCheck: true`.

`.gitignore`: `node_modules/`, `dist/`, `.env`, `*.png` under `data/**/generated/`, `.DS_Store`, coverage.

- [ ] **Step 3: Write `CLAUDE.md` + `AGENTS.md`**

Mirror Floatdesk brief adapted to LocalManager: product = mayor sim; point to design spec; Italian UI; Postgres; no commit unless asked; Superpowers for ambiguous slices.

`AGENTS.md` stub pointing at `CLAUDE.md`.

- [ ] **Step 4: Update `PROJECTS.md` and minimal `README.md`**

`PROJECTS.md` row for `localmanager`: game repo LocalManager, entry `AGENTS.md` → `CLAUDE.md`.

`README.md`: one-paragraph product + `npm install` / `npm test` / link to spec.

- [ ] **Step 5: Verify**

Run: `npm install` (from repo root after Task 2 stubs exist — if workspaces empty, create placeholder `packages/shared/package.json` with name `@localmanager/shared` and `"private": true` so install succeeds).

Expected: lockfile created, no error.

- [ ] **Step 6: Commit** (when user asks)

```bash
git add package.json tsconfig.base.json .gitignore CLAUDE.md AGENTS.md README.md PROJECTS.md packages/shared/package.json
git commit -m "chore: scaffold LocalManager monorepo and agent docs"
```

---

### Task 2: `packages/shared` — GameState types + API DTOs

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/types.ts`, `packages/shared/src/dto.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- Produces: types below (consumed by sim, api, web)

- [ ] **Step 1: Define core types in `packages/shared/src/types.ts`**

```typescript
export type StaffRole = "secretary" | "technician" | "communicator";

export type ProjectTemplateId = "youth_space" | "road_fix" | "school_wing";

export type MapSlotId = "centro" | "zona_nord" | "viabilita_est";

export interface StaffMember {
  role: StaffRole;
  hired: boolean;
  monthlyCost: number;
}

export interface ActiveProject {
  templateId: ProjectTemplateId;
  monthsRemaining: number;
  slotId: MapSlotId;
}

export interface CompletedProject {
  templateId: ProjectTemplateId;
  slotId: MapSlotId;
  completedMonth: number;
}

export interface RivalState {
  heat: number; // 0..100
  lastMoveMonth: number | null;
  pendingEvent: RivalEvent | null;
}

export type RivalEventKind = "press_attack" | "promises" | "meter_erosion";

export interface RivalEvent {
  kind: RivalEventKind;
  messageIt: string;
}

export interface LogEntry {
  month: number;
  textIt: string;
}

export interface MapOverlay {
  activeSlots: MapSlotId[];
  dirty: boolean;
  mapVersion: number;
}

export interface ProvinceFundingRequest {
  amount: number;
  resolveMonth: number;
}

export interface GameState {
  comuneId: "069084";
  mayorName: string;
  month: number; // 1..48
  mandateMonths: 48;
  cash: number;
  population: number;
  meanAge: number;
  peopleRep: number; // 0..100
  politicalRep: number; // 0..100
  staff: StaffMember[];
  activeProjects: ActiveProject[];
  completedProjects: CompletedProject[];
  provinceRequest: ProvinceFundingRequest | null;
  rival: RivalState;
  overlay: MapOverlay;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
  seed: number;
}

export interface NewGameOptions {
  mayorName: string;
  seed?: number;
}
```

- [ ] **Step 2: DTOs in `packages/shared/src/dto.ts`**

```typescript
export interface MapJobInput {
  comuneId: "069084";
  runId: string;
  overlaySlots: string[];
  basemapRevision: string;
}

export type MapJobStatus = "pending" | "running" | "ready" | "failed";

export interface MapJobRecord {
  id: string;
  runId: string;
  status: MapJobStatus;
  input: MapJobInput;
  artifactPath: string | null;
  mapVersion: number | null;
  error: string | null;
  attempts: number;
}

export interface SavePayload {
  runId: string;
  state: unknown; // GameState JSON
  updatedAt: string;
}

export interface HealthResponse {
  ok: true;
  storage: "postgres";
  maps?: "ok" | "down" | "unconfigured";
}
```

- [ ] **Step 3: Export from `index.ts`, build script**

`package.json` name `@localmanager/shared`, `"type": "module"`, scripts `"build": "tsc"`, exports `./dist/index.js`.

- [ ] **Step 4: `npx tsc -p packages/shared` — expect exit 0**

- [ ] **Step 5: Commit** (when user asks) — `feat: add shared GameState and API DTO types`

---

### Task 3: Comune seed data (Santa Maria Imbaro)

**Files:**
- Create: all files under `data/comuni/santa-maria-imbaro/`

**Interfaces:**
- Produces: JSON loaded by `loadComune()` in Task 4

- [ ] **Step 1: Write `meta.json`**

```json
{
  "comuneId": "069084",
  "name": "Santa Maria Imbaro",
  "province": "CH",
  "region": "Abruzzo",
  "cadastralCode": "I244",
  "areaKm2": 5.71,
  "osmQuery": "Santa Maria Imbaro, Abruzzo, Italy",
  "center": { "lat": 42.2167, "lon": 14.45 },
  "basemapRevision": "2026-08-29",
  "snapshotDate": "2026-01-01",
  "sources": ["SOURCES.md"]
}
```

- [ ] **Step 2: Write `demographics.json`**

```json
{
  "population": 2022,
  "meanAge": 43.1,
  "note": "population Tuttitalia/ISTAT 01/01/2026; meanAge Urbistat 2024 — verify against ISTAT before claiming precision"
}
```

- [ ] **Step 3: Write `budget.json`**

```json
{
  "openingCash": 850000,
  "monthlyBaseIncome": 42000,
  "monthlyMaintenance": 18000,
  "disclaimer": "Educational simplified model — not a real bilancio"
}
```

- [ ] **Step 4: Write `projects.json`**

```json
[
  {
    "templateId": "youth_space",
    "nameIt": "Spazio giovani",
    "cost": 120000,
    "months": 4,
    "slotId": "centro",
    "effects": { "population": 15, "meanAge": -0.2, "peopleRep": 4, "politicalRep": 1 }
  },
  {
    "templateId": "road_fix",
    "nameIt": "Sistemazione viabilità",
    "cost": 200000,
    "months": 5,
    "slotId": "viabilita_est",
    "effects": { "population": 8, "meanAge": 0, "peopleRep": 3, "politicalRep": 3 }
  },
  {
    "templateId": "school_wing",
    "nameIt": "Ala scolastica",
    "cost": 280000,
    "months": 8,
    "slotId": "zona_nord",
    "effects": { "population": 25, "meanAge": -0.4, "peopleRep": 5, "politicalRep": 2 }
  }
]
```

- [ ] **Step 5: Write `map/slots.json`**

```json
{
  "slots": [
    { "id": "centro", "labelIt": "Centro", "offset": [0.0, 0.0], "radiusM": 120 },
    { "id": "zona_nord", "labelIt": "Zona nord", "offset": [0.0, 0.004], "radiusM": 100 },
    { "id": "viabilita_est", "labelIt": "Viabilità est", "offset": [0.005, 0.0], "radiusM": 140 }
  ]
}
```

Offsets are relative degrees from `meta.center` for overlay dots (v0, not cadastral parcels).

- [ ] **Step 6: Write `SOURCES.md`**

Cite: ISTAT code 069084; Tuttitalia population snapshot; Urbistat mean age; OSM via prettymaps; educational disclaimer.

- [ ] **Step 7: Commit** (when user asks) — `data: add Santa Maria Imbaro seed snapshot`

---

### Task 4: `packages/sim` — initial state + advanceMonth (TDD)

**Files:**
- Create: `packages/sim/package.json`, `vitest.config.ts`, `src/config.ts`, `src/loadComune.ts`, `src/rng.ts`, `src/createInitial.ts`, `src/advanceMonth.ts`, `src/election.ts`, `src/index.ts`
- Test: `src/advanceMonth.test.ts`, `src/election.test.ts`

**Interfaces:**
- Consumes: `@localmanager/shared` GameState; `data/comuni/santa-maria-imbaro/*`
- Produces:
  - `createInitialGameState(opts: NewGameOptions): GameState`
  - `advanceMonth(state: GameState): GameState`
  - `resolveElection(state: GameState): GameState`

- [ ] **Step 1: Write failing tests `advanceMonth.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { createInitialGameState } from "./createInitial";
import { advanceMonth } from "./advanceMonth";

describe("advanceMonth", () => {
  it("increments month and applies maintenance + staff costs", () => {
    let s = createInitialGameState({ mayorName: "Test", seed: 1 });
    const before = s.cash;
    s = advanceMonth(s);
    expect(s.month).toBe(2);
    expect(s.cash).toBeLessThan(before);
  });

  it("sets overlay.dirty when a project completes", () => {
    let s = createInitialGameState({ mayorName: "Test", seed: 1 });
    s = {
      ...s,
      cash: 1_000_000,
      activeProjects: [
        { templateId: "youth_space", monthsRemaining: 1, slotId: "centro" },
      ],
    };
    s = advanceMonth(s);
    expect(s.completedProjects.some((p) => p.slotId === "centro")).toBe(true);
    expect(s.overlay.dirty).toBe(true);
    expect(s.overlay.activeSlots).toContain("centro");
  });

  it("runs rival move on month 6", () => {
    let s = createInitialGameState({ mayorName: "Test", seed: 1 });
    for (let i = 0; i < 5; i++) s = advanceMonth(s);
    expect(s.month).toBe(6);
    expect(s.rival.pendingEvent).not.toBeNull();
  });
});
```

- [ ] **Step 2: Write failing `election.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { createInitialGameState } from "./createInitial";
import { resolveElection } from "./election";

describe("resolveElection", () => {
  it("wins when average reputation >= rival heat", () => {
    let s = createInitialGameState({ mayorName: "Test", seed: 1 });
    s = { ...s, month: 48, peopleRep: 60, politicalRep: 60, rival: { ...s.rival, heat: 50 } };
    s = resolveElection(s);
    expect(s.status).toBe("won");
  });

  it("loses when average reputation < rival heat", () => {
    let s = createInitialGameState({ mayorName: "Test", seed: 1 });
    s = { ...s, month: 48, peopleRep: 40, politicalRep: 40, rival: { ...s.rival, heat: 50 } };
    s = resolveElection(s);
    expect(s.status).toBe("lost");
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm run test -w @localmanager/sim`  
Expected: fail (modules missing).

- [ ] **Step 4: Implement `config.ts`**

```typescript
export const MANDATE_MONTHS = 48 as const;
export const RIVAL_INTERVAL_MONTHS = 6;
export const RIVAL_HEAT_GAIN = 8;
export const CLAMP = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const STAFF_COSTS: Record<string, number> = {
  secretary: 2800,
  technician: 3200,
  communicator: 2600,
};
```

- [ ] **Step 5: Implement `loadComune.ts` + `createInitial.ts`**

Read JSON from `data/comuni/santa-maria-imbaro/` via `fs` + `fileURLToPath` relative to monorepo root (`process.cwd()` in tests = repo root). Initial staff: secretary hired, others not. `peopleRep: 50`, `politicalRep: 50`, `rival.heat: 35`, `overlay: { activeSlots: [], dirty: false, mapVersion: 0 }`.

- [ ] **Step 6: Implement `advanceMonth.ts` pipeline** (order from spec)

1. Income − maintenance − hired staff costs  
2. Decrement active projects; on 0 → completed + slot in `activeSlots` + `dirty: true` + apply effects  
3. If `provinceRequest.resolveMonth === month` → roll success with seeded RNG, add cash or log fail  
4. Drift: `meanAge += 0.01`, tiny pop noise from RNG  
5. If `month % 6 === 0` → set `pendingEvent`, `heat = CLAMP(heat + 8)`  
6. Append Italian log line  
7. If `month >= 48` → `resolveElection`

- [ ] **Step 7: Implement `election.ts`**

```typescript
export function resolveElection(state: GameState): GameState {
  const avg = (state.peopleRep + state.politicalRep) / 2;
  return {
    ...state,
    status: avg >= state.rival.heat ? "won" : "lost",
  };
}
```

- [ ] **Step 8: Run tests — expect PASS**

- [ ] **Step 9: Commit** (when user asks) — `feat(sim): month loop, rival cadence, elections`

---

### Task 5: `packages/sim` — desk actions (TDD)

**Files:**
- Create: `packages/sim/src/actions.ts`
- Test: `packages/sim/src/actions.test.ts`

**Interfaces:**
- Produces:
  - `startProject(state, templateId): GameState | { errorIt: string }`
  - `hireStaff(state, role): GameState | { errorIt: string }`
  - `fireStaff(state, role): GameState | { errorIt: string }`
  - `requestProvinceFunds(state, amount: number): GameState | { errorIt: string }`
  - `issuePressRelease(state, tone: "people" | "political"): GameState`
  - `respondToRival(state, choice: "ignore" | "counter"): GameState | { errorIt: string }`

Use result union: prefer returning `GameState` and throwing/`Result` — pick **discriminated union**:

```typescript
export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; errorIt: string };
```

- [ ] **Step 1: Write failing `actions.test.ts`** covering: cannot start project if insufficient cash; hire communicator increases monthly burn next month; press `people` raises peopleRep lowers politicalRep; rival counter clears pendingEvent and bumps politicalRep.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `actions.ts`** with Italian `errorIt` strings (e.g. `"Cassa insufficiente."`, `"Nessun evento rivale da gestire."`).

Press tones:
- `people`: `peopleRep += 3`, `politicalRep -= 2`
- `political`: `politicalRep += 3`, `peopleRep -= 2`

Rival:
- `ignore`: clear event, `peopleRep -= 2`
- `counter`: clear event, costs 5000 cash if available else error, `politicalRep += 2`, `rival.heat -= 3`

Province request: only one pending; resolves in `month + 2` inside `advanceMonth` with 55% success (seeded).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** (when user asks) — `feat(sim): desk actions for projects staff press funds rival`

---

### Task 6: `apps/api` — Postgres, auth, saves, map jobs

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/index.ts`, `db.ts`, `auth.ts`, `saves.ts`, `mapJobs.ts`, `schema.sql`

**Interfaces:**
- Consumes: `DATABASE_URL`, `LOCALMANAGER_SECRET`
- Produces HTTP:
  - `POST /api/auth/register` `{ email, password }`
  - `POST /api/auth/login` → `{ token }`
  - `GET /api/health` → `HealthResponse`
  - `PUT /api/saves/:runId` (auth) body `GameState`
  - `GET /api/saves/:runId` (auth)
  - `POST /api/runs/:runId/map-jobs` (auth) body from state overlay → creates `pending` job
  - `GET /api/runs/:runId/map` → `{ status, mapVersion, url }`
  - `GET /api/internal/map-jobs/next` (maps worker key `MAPS_WORKER_KEY`)
  - `POST /api/internal/map-jobs/:id/complete`

- [ ] **Step 1: Write `schema.sql`**

Tables: `users(id, email, password_hash, created_at)`, `sessions(token_hash, user_id, created_at, last_seen_at)`, `saves(run_id, user_id, state_json, updated_at)`, `map_jobs(id, run_id, status, input_json, artifact_path, map_version, error, attempts, created_at)`, `map_artifacts(run_id, map_version, path, created_at)`.

- [ ] **Step 2: Implement `db.ts`** — `pg` Pool; on boot run schema if not present (simple `CREATE TABLE IF NOT EXISTS`).

- [ ] **Step 3: Implement auth** — password min 8; hash with `scrypt`; session token HMAC; idle 2h / absolute 7d (same constants as Floatdesk intent).

- [ ] **Step 4: Implement saves + map job enqueue**

On `POST .../map-jobs`: insert job with `overlaySlots` from body; reject if identical pending exists.

- [ ] **Step 5: Health endpoint**

```typescript
// storage: "postgres" when pool.query('select 1') works
// maps: "ok" if latest worker heartbeat row or env MAPS_OPTIONAL skip → "unconfigured"
```

For v0: `maps` = `"ok"` if any job completed in last 24h OR env `MAPS_WORKER_HEARTBEAT_URL` ping — simplest: check `map_jobs` for `running`/`ready` recently, else `"unconfigured"` until first worker claim.

- [ ] **Step 6: Manual smoke**

Run with local Postgres:  
`DATABASE_URL=... LOCALMANAGER_SECRET=dev npm run dev -w @localmanager/api`  
`curl /api/health` → `"storage":"postgres"`.

- [ ] **Step 7: Commit** (when user asks) — `feat(api): auth saves and map job queue on Postgres`

---

### Task 7: `services/maps` — prettymaps worker

**Files:**
- Create: `services/maps/requirements.txt`, `render.py`, `worker.py`, `Dockerfile`, `fixtures/basemap_stub.png`

**Interfaces:**
- Consumes: `DATABASE_URL` or API internal endpoints + `MAPS_WORKER_KEY`
- Produces: PNG under `/data/maps/{runId}/v{n}.png`

- [ ] **Step 1: `requirements.txt`**

```
prettymaps==1.*
matplotlib
requests
psycopg[binary]==3.*
Pillow
```

Pin exact versions at implement time after `pip install` resolves.

- [ ] **Step 2: `render.py`**

```python
def render_map(osm_query: str, slots: list[dict], out_path: str, fixture_mode: bool = False) -> None:
    """If LOCALMANAGER_MAPS_FIXTURE=1 or fixture_mode, copy fixtures/basemap_stub.png and draw colored circles for slots.
    Else call prettymaps.plot(osm_query, ...) then overlay slot circles, save PNG.
    """
```

CI/dev default: `LOCALMANAGER_MAPS_FIXTURE=1`.

- [ ] **Step 3: `worker.py` loop**

Every 3s: `GET /api/internal/map-jobs/next` → mark running → `render_map` → `POST complete` with path + incremented mapVersion.

- [ ] **Step 4: Unit-less smoke**

```bash
LOCALMANAGER_MAPS_FIXTURE=1 python services/maps/render.py --self-test
```

Expected: writes a PNG to temp path, exit 0.

- [ ] **Step 5: Commit** (when user asks) — `feat(maps): prettymaps worker with fixture mode`

---

### Task 8: `apps/web` — desk UI + map panel

**Files:**
- Create: Vite React app under `apps/web/` with Zustand store and screens

**Interfaces:**
- Consumes: `@localmanager/sim` actions + `advanceMonth`; `/api/*` when logged in
- Produces: screens `auth | menu | setup | game | gameover`

- [ ] **Step 1: Scaffold Vite React-TS** in `apps/web`, depend on `@localmanager/sim` and `@localmanager/shared`.

- [ ] **Step 2: `gameStore.ts`**

```typescript
type Screen = "auth" | "menu" | "setup" | "game" | "gameover";
interface Store {
  screen: Screen;
  state: GameState | null;
  token: string | null;
  mapUrl: string | null;
  mapJobPending: boolean;
  startGame: (mayorName: string) => void;
  closeMonth: () => Promise<void>;
  // wrappers calling sim actions + setState
}
```

`closeMonth`: `advanceMonth` → if `overlay.dirty` and token+runId → `POST map-jobs` → poll `/map` until ready → clear dirty locally when `mapVersion` bumps → set `mapUrl`.

Guest: skip API; keep a pre-seeded static PNG from `public/maps/smi-basemap.png` (commit a fixture) and still flip overlay badge text “aggiornamento mappa disponibile online”.

Actually per spec guests should still *see* map evolution locally: for guest, call a **local fixture renderer path** — simplest v0: client-side canvas dots on basemap PNG without Python when offline; when API available use server PNG. Document in README.

**Guest map v0 (explicit):** basemap static in `public/`; overlay = CSS/SVG circles for `activeSlots`; no Python. Logged-in: server PNG replaces basemap when ready.

- [ ] **Step 3: Build Italian screens**

- `SetupScreen`: nome sindaco + conferma comune  
- `GameScreen`: map dominant; panels cassa, meter popolo/politica, personale, progetti, fondi, stampa, log; rival heat; Chiudi mese  
- Disabled controls: `title` / hint with perché + cosa fare  
- Disclaimer footer: modello educativo  

- [ ] **Step 4: Manual verify**

`npm run dev:web` — start game, start project, close months until complete, see slot appear on map, meters move.

- [ ] **Step 5: Commit** (when user asks) — `feat(web): mayor desk UI with map overlay`

---

### Task 9: Wire cloud save + CI + Railway

**Files:**
- Create: `.github/workflows/ci.yml`, `apps/api/railway.toml` or root `railway.toml`, `services/maps/railway.toml`, update `README.md` deploy section
- Modify: web save/load buttons

- [ ] **Step 1: CI workflow**

On PR/push: `npm ci` → `npm test` → `npm run build`; maps job: `python -m py_compile services/maps/*.py` + fixture self-test.

- [ ] **Step 2: README Deploy**

Two Railway services, same `DATABASE_URL`, secrets `LOCALMANAGER_SECRET`, `MAPS_WORKER_KEY`; volume `/data` for map PNGs on maps or api service (choose **api** serves `/media/maps/*` from shared volume — document attaching volume to api and writing path both containers can see, OR store PNG bytes in Postgres bytea for v0 simplicity).

**v0 storage decision (lock):** store PNG as `BYTEA` in `map_artifacts.content` to avoid multi-service volume hell; `GET /api/runs/:id/map` returns `image/png` or signed path that streams bytes.

Update Task 6 schema accordingly if not already: `map_artifacts(run_id, map_version, content BYTEA)`.

- [ ] **Step 3: Web cloud save**

Logged-in: autosave after each successful `closeMonth`; Load from menu.

- [ ] **Step 4: End-to-end checklist** (human)

1. Register → new game → actions → close month → project completes → map job ready → image changes  
2. `/api/health` storage postgres  
3. Month 48 election screen  

- [ ] **Step 5: Commit** (when user asks) — `chore: CI and Railway deploy docs for web-api and maps`

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Monorepo web/api/maps/sim/shared | 1, 2, 4–8 |
| Santa Maria Imbaro seed + SOURCES | 3 |
| Month loop + dirty map + rival 6mo + election | 4 |
| Desk actions incl. staff + press | 5 |
| Auth guest/local + cloud Postgres | 6, 8, 9 |
| Map job on month close if dirty | 6, 7, 8 |
| prettymaps + fixture CI | 7, 9 |
| Railway two services | 9 |
| Italian UI desk + disclaimer | 8 |
| CLAUDE/AGENTS/PROJECTS | 1 |

**Placeholder scan:** none intentional; BYTEA artifact decision locked in Task 9 Step 2 (overrides vague “volume” wording).

**Type consistency:** `GameState`, `MapSlotId`, `ActionResult`, map job DTOs named once in Tasks 2/5/6.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-29-localmanager-v0-skeleton.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans and checkpoints  

Which approach?
