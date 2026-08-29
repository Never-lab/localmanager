# Map Steroids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a faithful HQ prettymaps basemap when the player picks a comune, then apply overlay changes as precise composites on a stable frame (no random zoom).

**Architecture:** Nominatim during hydrate writes geo + fixed map slots into `ComuneSeed`. Map jobs carry that geo. The Python worker caches the basemap PNG per `(runId, basemapRevision)` and composites slot markers from lat/lon; full re-plot only on cache miss or revision change. Client enqueues a map job on `startGame` and again on dirty month-close.

**Tech Stack:** TypeScript (shared, comuni-data, sim, api, web), Vitest / node:test, Python 3.11 + Pillow (+ prettymaps live only outside CI fixture mode), Nominatim HTTP.

**Spec:** `docs/superpowers/specs/2026-08-29-map-steroids-design.md`

## Global Constraints

- Player-facing UI copy: Italian; identifiers/PR text: English
- Comments on **touched** code: Italian
- No live Nominatim/prettymaps in CI — mock HTTP + `LOCALMANAGER_MAPS_FIXTURE=1`
- Do not invent sim balances; map geometry only from seed offsets / Nominatim
- Commit steps below are **suggested messages** — commit only when the user asks
- No `Co-authored-by: Cursor`
- Out of scope: offline national coord catalog, smart OSM POI slots, freeform edit, thumbs

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/shared/src/types.ts` | `MapGeo`, `MapSlotDef`, extend `ComuneSeedSnapshot` / `NewGameOptions` |
| `packages/shared/src/dto.ts` | Enriched `MapJobInput` |
| `packages/comuni-data/src/types.ts` | Geo fields on `ComuneSeed` |
| `packages/comuni-data/src/mapSlots.ts` | Fixed offsets → `MapSlotDef[]` from center |
| `packages/comuni-data/src/nominatim.ts` | Nominatim lookup → center/radius/query |
| `packages/comuni-data/src/hydrate.ts` | Call Nominatim; fail without geo |
| `data/comuni/fixtures/069084.json` | Fixture geo + mapSlots |
| `packages/sim/src/createInitial.ts` | Copy map geo into `GameState.comune` |
| `apps/api/src/mapJobs.ts` | Parse/validate enriched job input |
| `services/maps/render.py` | Basemap + composite + lat/lon→pixel |
| `services/maps/worker.py` | Cache path; use job input; no SMI hardcode |
| `apps/web/src/store/gameStore.ts` | Initial map job + enriched body + `retryMap` |
| `apps/web/src/App.tsx` | Spinner / retry / alt per comune |

---

### Task 1: Shared map geo types + MapJobInput

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/dto.ts`
- Create: `packages/shared/src/dto.test.ts` (or extend existing shared tests if present)

**Interfaces:**
- Produces:
  - `MapSlotDef = { id: MapSlotId; labelIt: string; lat: number; lon: number; radiusM: number }`
  - `MapGeo = { osmQuery: string; center: { lat: number; lon: number }; radiusM: number; basemapRevision: string; mapSlots: MapSlotDef[] }`
  - `ComuneSeedSnapshot` includes `MapGeo` fields (spread or nested `map: MapGeo`)
  - `MapJobInput` includes the same geo fields required for the worker

- [ ] **Step 1: Write failing type-level / DTO shape test**

Create `packages/shared/src/mapGeo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MapGeo, MapJobInput } from "./index.js";

describe("map geo shapes", () => {
  it("MapJobInput requires stable framing fields", () => {
    const input: MapJobInput = {
      comuneId: "069084",
      runId: "run-1",
      overlaySlots: ["centro"],
      basemapRevision: "2026-08-29",
      osmQuery: "Santa Maria Imbaro, Abruzzo, Italy",
      center: { lat: 42.2167, lon: 14.45 },
      radiusM: 1200,
      mapSlots: [
        {
          id: "centro",
          labelIt: "Centro",
          lat: 42.2167,
          lon: 14.45,
          radiusM: 120,
        },
      ],
    };
    expect(input.radiusM).toBe(1200);
    expect(input.mapSlots[0].id).toBe("centro");
  });
});
```

If shared has no vitest script, add a minimal `"test": "vitest run"` to `packages/shared/package.json` or colocated check via TypeScript compile only — prefer vitest to match monorepo.

- [ ] **Step 2: Run test / tsc to verify types missing**

Run: `npm run test -w @localmanager/shared` (or `npx tsc -p packages/shared` if test harness not ready)  
Expected: FAIL — `MapJobInput` missing geo fields / `MapGeo` not exported

- [ ] **Step 3: Implement types**

In `packages/shared/src/types.ts` add:

```ts
export interface MapSlotDef {
  id: MapSlotId;
  labelIt: string;
  lat: number;
  lon: number;
  radiusM: number;
}

export interface MapGeo {
  osmQuery: string;
  center: { lat: number; lon: number };
  radiusM: number;
  basemapRevision: string;
  mapSlots: MapSlotDef[];
}
```

Extend `ComuneSeedSnapshot` with `map: MapGeo`.  
Extend `NewGameOptions.comuneSeed` with optional `map?: MapGeo`.

In `packages/shared/src/dto.ts` replace `MapJobInput` with:

```ts
export interface MapJobInput {
  comuneId: string;
  runId: string;
  overlaySlots: string[];
  basemapRevision: string;
  osmQuery: string;
  center: { lat: number; lon: number };
  radiusM: number;
  mapSlots: MapSlotDef[];
}
```

Import `MapSlotDef` from `./types.js`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test -w @localmanager/shared` and `npm run build -w @localmanager/shared`  
Expected: PASS

- [ ] **Step 5: Commit (when user asks)**

```bash
git add packages/shared/src/types.ts packages/shared/src/dto.ts packages/shared/src/mapGeo.test.ts packages/shared/package.json
git commit -m "$(cat <<'EOF'
feat(shared): enrich map job input with stable geo framing

EOF
)"
```

---

### Task 2: Fixed mapSlots builder

**Files:**
- Create: `packages/comuni-data/src/mapSlots.ts`
- Create: `packages/comuni-data/src/mapSlots.test.ts`
- Modify: `packages/comuni-data/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `MapSlotId` / `MapSlotDef` from `@localmanager/shared`
- Produces: `buildDefaultMapSlots(center: { lat: number; lon: number }): MapSlotDef[]`

Offsets (match `data/comuni/santa-maria-imbaro/map/slots.json`):

| id | labelIt | offset lon, lat (degrees) | radiusM |
| --- | --- | --- | --- |
| `centro` | Centro | 0, 0 | 120 |
| `zona_nord` | Zona nord | 0, +0.004 | 100 |
| `viabilita_est` | Viabilità est | +0.005, 0 | 140 |

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildDefaultMapSlots } from "./mapSlots.js";

describe("buildDefaultMapSlots", () => {
  it("places slots with fixed degree offsets from center", () => {
    const slots = buildDefaultMapSlots({ lat: 42.2167, lon: 14.45 });
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({
      id: "centro",
      lat: 42.2167,
      lon: 14.45,
      radiusM: 120,
    });
    expect(slots[1]).toMatchObject({
      id: "zona_nord",
      lat: 42.2207,
      lon: 14.45,
    });
    expect(slots[2]).toMatchObject({
      id: "viabilita_est",
      lat: 42.2167,
      lon: 14.455,
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `npm run test -w @localmanager/comuni-data -- src/mapSlots.test.ts`  
Expected: FAIL cannot find module

- [ ] **Step 3: Implement**

```ts
import type { MapSlotDef } from "@localmanager/shared";

const OFFSETS: Array<{
  id: MapSlotDef["id"];
  labelIt: string;
  dLon: number;
  dLat: number;
  radiusM: number;
}> = [
  { id: "centro", labelIt: "Centro", dLon: 0, dLat: 0, radiusM: 120 },
  { id: "zona_nord", labelIt: "Zona nord", dLon: 0, dLat: 0.004, radiusM: 100 },
  {
    id: "viabilita_est",
    labelIt: "Viabilità est",
    dLon: 0.005,
    dLat: 0,
    radiusM: 140,
  },
];

/** Slot geografici deterministici intorno al centro del comune (stesso layout relativo ovunque). */
export function buildDefaultMapSlots(center: {
  lat: number;
  lon: number;
}): MapSlotDef[] {
  return OFFSETS.map((o) => ({
    id: o.id,
    labelIt: o.labelIt,
    lat: center.lat + o.dLat,
    lon: center.lon + o.dLon,
    radiusM: o.radiusM,
  }));
}
```

Export from `index.ts`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit (when user asks)** — `feat(comuni-data): default map slots from center offsets`

---

### Task 3: Nominatim client + hydrate geo

**Files:**
- Create: `packages/comuni-data/src/nominatim.ts`
- Create: `packages/comuni-data/src/nominatim.test.ts`
- Create: `packages/comuni-data/src/hydrate.geo.test.ts`
- Modify: `packages/comuni-data/src/types.ts`
- Modify: `packages/comuni-data/src/hydrate.ts`
- Modify: `packages/comuni-data/src/index.ts`
- Modify: `data/comuni/fixtures/069084.json`

**Interfaces:**
- Consumes: `buildDefaultMapSlots`, `CatalogComune`
- Produces:
  - `resolveComuneGeo(meta, options): Promise<MapGeo | { errorIt: string }>`
  - `ComuneSeed.map: MapGeo` required on ready seeds
  - HydrateOptions may include `nominatimUrl?`, `fetchImpl?` (already has fetchImpl)

Nominatim query: `` `${name}, ${provinceName ?? province ?? region}, Italy` `` (skip null parts cleanly).  
User-Agent: `LocalManager/0.1 (educational; contact: localmanager)`.  
Radius: half the max bbox side in meters, clamped `[800, 5000]`, default `1500` if no bbox.

- [ ] **Step 1: Failing Nominatim tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveComuneGeo } from "./nominatim.js";

describe("resolveComuneGeo", () => {
  it("maps nominatim hit to MapGeo + default slots", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "42.2167",
            lon: "14.45",
            boundingbox: ["42.20", "42.23", "14.43", "14.47"],
            display_name: "Santa Maria Imbaro, Abruzzo, Italy",
          },
        ]),
        { status: 200 },
      ),
    );
    const geo = await resolveComuneGeo(
      {
        id: "069084",
        name: "Santa Maria Imbaro",
        province: "CH",
        provinceName: null,
        region: "Abruzzo",
      },
      { fetchImpl },
    );
    expect("errorIt" in geo).toBe(false);
    if ("errorIt" in geo) return;
    expect(geo.osmQuery).toContain("Santa Maria Imbaro");
    expect(geo.center).toEqual({ lat: 42.2167, lon: 14.45 });
    expect(geo.mapSlots).toHaveLength(3);
    expect(geo.basemapRevision).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns Italian error when empty", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    const geo = await resolveComuneGeo(
      {
        id: "000000",
        name: "NessunDove",
        province: null,
        provinceName: null,
        region: "Lazio",
      },
      { fetchImpl },
    );
    expect(geo).toMatchObject({
      errorIt: expect.stringMatching(/Geolocalizzazione/i),
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `nominatim.ts`**

```ts
import type { MapGeo } from "@localmanager/shared";
import type { CatalogComune } from "./types.js";
import { buildDefaultMapSlots } from "./mapSlots.js";

const NOMINATIM =
  process.env.COMUNI_NOMINATIM_URL ??
  "https://nominatim.openstreetmap.org/search";

export interface NominatimOptions {
  fetchImpl?: typeof fetch;
  nominatimUrl?: string;
  /** Override revision stamp (tests). */
  basemapRevision?: string;
}

function buildOsmQuery(meta: CatalogComune): string {
  const parts = [
    meta.name,
    meta.provinceName ?? meta.province,
    meta.region,
    "Italy",
  ].filter(Boolean);
  return parts.join(", ");
}

function radiusFromBbox(bbox: string[] | undefined): number {
  if (!bbox || bbox.length < 4) return 1500;
  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  if (![south, north, west, east].every(Number.isFinite)) return 1500;
  const latM = Math.abs(north - south) * 111_320;
  const lonM =
    Math.abs(east - west) *
    111_320 *
    Math.cos((((north + south) / 2) * Math.PI) / 180);
  const half = Math.max(latM, lonM) / 2;
  return Math.round(Math.min(5000, Math.max(800, half)));
}

/** Risolve centro/raggio OSM del comune via Nominatim (nessun seed senza geo). */
export async function resolveComuneGeo(
  meta: CatalogComune,
  options: NominatimOptions = {},
): Promise<MapGeo | { errorIt: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const osmQuery = buildOsmQuery(meta);
  const url = new URL(options.nominatimUrl ?? NOMINATIM);
  url.searchParams.set("q", osmQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LocalManager/0.1 (educational; contact: localmanager)",
      },
    });
  } catch {
    return {
      errorIt:
        "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
    };
  }
  if (res.status === 429 || !res.ok) {
    return {
      errorIt:
        "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
    };
  }
  const rows = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    boundingbox?: string[];
  }>;
  const hit = rows[0];
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      errorIt:
        "Geolocalizzazione non disponibile per questo comune. Scegline un altro o riprova.",
    };
  }
  const center = { lat, lon };
  const revision =
    options.basemapRevision ?? new Date().toISOString().slice(0, 10);
  return {
    osmQuery,
    center,
    radiusM: radiusFromBbox(hit.boundingbox),
    basemapRevision: revision,
    mapSlots: buildDefaultMapSlots(center),
  };
}
```

- [ ] **Step 4: Extend `ComuneSeed` + fixture + `buildSeed` / hydrate**

`ComuneSeed` gains `map: MapGeo` (import type from shared or duplicate minimal shape in comuni-data — prefer shared).

Update `data/comuni/fixtures/069084.json` with:

```json
"map": {
  "osmQuery": "Santa Maria Imbaro, Abruzzo, Italy",
  "center": { "lat": 42.2167, "lon": 14.45 },
  "radiusM": 1200,
  "basemapRevision": "2026-08-29",
  "mapSlots": [
    { "id": "centro", "labelIt": "Centro", "lat": 42.2167, "lon": 14.45, "radiusM": 120 },
    { "id": "zona_nord", "labelIt": "Zona nord", "lat": 42.2207, "lon": 14.45, "radiusM": 100 },
    { "id": "viabilita_est", "labelIt": "Viabilità est", "lat": 42.2167, "lon": 14.455, "radiusM": 140 }
  ]
}
```

In `hydrateComune`, after budget/projects/population succeed (and for fixture path if fixture lacks map — call Nominatim or require fixture map), call `resolveComuneGeo`. On error return `{ status: "failed", errorIt }`. Pass `map` into `buildSeed`.

For `tryFixture`: if fixture JSON already has `map`, use it; else resolve Nominatim (tests use fixture with map).

`buildSeedFromRows`: accept optional geo or call resolve (prefer require caller / resolve inside with fetchImpl from options — add Nominatim to `HydrateOptions`).

- [ ] **Step 5: Hydrate geo test**

```ts
it("fails hydrate when nominatim empty", async () => {
  // use fixtureDir undefined, mock catalog + csv paths OR unit-test build path
  // Minimal: spy resolve via injecting fetchImpl that returns []
});
```

Keep one focused test that `hydrateComune` with `fixtureDir` pointing at a temp fixture **without** `map` and a fetchImpl returning `[]` yields Italian fail — OR simpler: unit-test that `buildSeed` requires map and hydrate wires resolve.

- [ ] **Step 6: Run comuni-data tests — PASS**

Run: `npm run test -w @localmanager/comuni-data`  
Expected: PASS

- [ ] **Step 7: Commit (when user asks)** — `feat(comuni-data): nominatim geo on hydrate`

---

### Task 4: Sim createInitial copies map geo

**Files:**
- Modify: `packages/sim/src/createInitial.ts`
- Modify: `packages/sim/src/loadComune.ts` (if needed to expose meta map for default fixture)
- Create/Modify: `packages/sim/src/createInitial.test.ts`

**Interfaces:**
- Consumes: `NewGameOptions.comuneSeed.map`
- Produces: `GameState.comune.map: MapGeo` always set for playable runs

- [ ] **Step 1: Failing test**

```ts
it("copies map geo from comuneSeed into state.comune.map", () => {
  const map = {
    osmQuery: "Santa Maria Imbaro, Abruzzo, Italy",
    center: { lat: 42.2167, lon: 14.45 },
    radiusM: 1200,
    basemapRevision: "2026-08-29",
    mapSlots: [
      {
        id: "centro" as const,
        labelIt: "Centro",
        lat: 42.2167,
        lon: 14.45,
        radiusM: 120,
      },
    ],
  };
  const state = createInitialGameState({
    mayorName: "Ada",
    comuneSeed: {
      comuneId: "069084",
      name: "Santa Maria Imbaro",
      province: "CH",
      region: "Abruzzo",
      population: 2022,
      meanAge: 43,
      openingCash: 1,
      monthlyBaseIncome: 1,
      monthlyMaintenance: 1,
      sourceYear: 2023,
      sources: [],
      projects: [],
      map,
    },
  });
  expect(state.comune.map).toEqual(map);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Wire `createInitial`**

Require `comuneSeed.map` when `comuneSeed` provided (UI already requires seed). For default `loadComune()` path used in unit tests without seed, build map from `data/comuni/santa-maria-imbaro/meta.json` center + `buildDefaultMapSlots` **or** hardcode the same fixture map inline in `loadComune` to avoid coupling sim → comuni-data. Prefer reading SMI `meta.json` + `map/slots.json` in `loadComune` if already loaded there.

- [ ] **Step 4: Run sim tests — PASS**

- [ ] **Step 5: Commit (when user asks)** — `feat(sim): persist map geo on game state`

---

### Task 5: API validates enriched map jobs

**Files:**
- Modify: `apps/api/src/mapJobs.ts`
- Modify: `apps/api/test/mapJobs.test.ts`
- Prefer importing `MapJobInput` from `@localmanager/shared` instead of local interface

**Interfaces:**
- Produces: `parseMapJobInput(body, runId): MapJobInput` — throws if geo missing/malformed
- Removes silent default `comuneId: "069084"` when body incomplete for geo (still may default comuneId only if present elsewhere — prefer require `comuneId` + all geo)

- [ ] **Step 1: Failing tests**

```ts
test("enqueue rejects map job without center", () => {
  assert.throws(
    () =>
      parseMapJobInput(
        {
          comuneId: "069084",
          overlaySlots: [],
          basemapRevision: "v0",
          osmQuery: "x",
          radiusM: 1000,
          mapSlots: [],
        },
        "run-1",
      ),
    /center/,
  );
});

test("parseMapJobInput accepts full geo payload", () => {
  const input = parseMapJobInput(
    {
      comuneId: "069084",
      overlaySlots: ["centro"],
      basemapRevision: "2026-08-29",
      osmQuery: "Santa Maria Imbaro, Abruzzo, Italy",
      center: { lat: 42.2167, lon: 14.45 },
      radiusM: 1200,
      mapSlots: [
        {
          id: "centro",
          labelIt: "Centro",
          lat: 42.2167,
          lon: 14.45,
          radiusM: 120,
        },
      ],
    },
    "run-1",
  );
  assert.equal(input.runId, "run-1");
  assert.equal(input.center.lat, 42.2167);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `parseMapJobInput`**

Validate:
- `comuneId` non-empty string
- `osmQuery` non-empty string
- `basemapRevision` non-empty string
- `center.lat` / `center.lon` finite numbers
- `radiusM` finite number `> 0`
- `mapSlots` array of objects with `id`, `lat`, `lon` (and pass through `labelIt`, `radiusM` if present)
- `overlaySlots` via existing `extractOverlaySlots`

Use in `enqueueMapJob`. Italian errors are for UI; API can throw English Error messages matching existing style (`overlaySlots must be...`) — client maps to Italian.

- [ ] **Step 4: Run api mapJobs tests — PASS**

Run: `npm test -w @localmanager/api` (or package script)  
Expected: PASS

- [ ] **Step 5: Commit (when user asks)** — `feat(api): require geo framing on map jobs`

---

### Task 6: Worker render — basemap cache + lat/lon composite

**Files:**
- Modify: `services/maps/render.py`
- Create: `services/maps/test_render.py`
- Modify: `services/maps/README.md` (one paragraph on cache + fixture)

**Interfaces:**
- Produces:
  - `latlon_to_pixel(lat, lon, center, radius_m, width, height) -> (x, y)`
  - `render_basemap(osm_query, center, radius_m, out_path, fixture_mode=False) -> None`
  - `composite_overlay(basemap_path, slots, active_ids, center, radius_m, out_path) -> None`
  - `render_map_job(...)` orchestration used by worker (optional thin wrapper)

HQ live mode (non-fixture): `prettymaps.plot` with explicit radius around center; `savefig` dpi≥180, `bbox_inches='tight', pad_inches=0`. Fixture mode: copy stub PNG, ignore OSM.

Pixel math (equirectangular local):

```python
def latlon_to_pixel(lat, lon, center, radius_m, width, height):
    # metri relativi al centro; frame = 2*radius_m lato
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(center["lat"]))
    dx = (lon - center["lon"]) * m_per_deg_lon
    dy = (lat - center["lat"]) * m_per_deg_lat
    x = (dx / (2 * radius_m) + 0.5) * width
    y = (0.5 - dy / (2 * radius_m)) * height  # nord in alto
    return int(x), int(y)
```

- [ ] **Step 1: Failing render tests**

```python
def test_latlon_to_pixel_center_is_image_center(self):
    x, y = latlon_to_pixel(42.0, 14.0, {"lat": 42.0, "lon": 14.0}, 1000, 200, 200)
    self.assertEqual((x, y), (100, 100))

def test_composite_stable_across_calls(self):
    # fixture basemap; composite ["centro"] twice; PNG bytes equal
```

- [ ] **Step 2: Run — FAIL**

Run: `cd services/maps && LOCALMANAGER_MAPS_FIXTURE=1 python -m unittest test_render.py -v`

- [ ] **Step 3: Implement render helpers; keep `render_map` as thin deprecated wrapper calling new API for self-test**

Italian comments on new/changed functions.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit (when user asks)** — `feat(maps): stable lat/lon overlay composite`

---

### Task 7: Worker process_job uses job geo + basemap cache

**Files:**
- Modify: `services/maps/worker.py`
- Modify: `services/maps/test_worker.py`

**Interfaces:**
- Consumes: job `input` with osmQuery, center, radiusM, basemapRevision, mapSlots, overlaySlots
- Cache path: `DATA_DIR / safe(runId) / f"basemap_{safe(basemapRevision)}.png"`
- Flow:
  1. If cache missing → `render_basemap` → write cache
  2. `composite_overlay(cache, mapSlots, overlaySlots, ...)` → temp png
  3. `complete_job` as today
  4. Rename versioned artifact as today

- [ ] **Step 1: Replace failing hardcode test**

Change `test_process_job_uses_santa_maria_imbaro_query` to:

```python
def test_process_job_uses_input_osm_query_and_cache(self) -> None:
    job = {
        "id": 1,
        "runId": "run",
        "input": {
            "overlaySlots": ["centro"],
            "osmQuery": "Pescara, Abruzzo, Italy",
            "center": {"lat": 42.46, "lon": 14.21},
            "radiusM": 1500,
            "basemapRevision": "2026-08-29",
            "mapSlots": [
                {
                    "id": "centro",
                    "labelIt": "Centro",
                    "lat": 42.46,
                    "lon": 14.21,
                    "radiusM": 120,
                }
            ],
        },
    }
    # assert render_basemap called with Pescara query when cache missing
    # second process_job with same revision does not call render_basemap again
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `process_job`**

Remove module-level `OSM_QUERY = "Santa Maria Imbaro..."`.  
Validate required keys; on missing geo call `fail_job` with clear error.

- [ ] **Step 4: Run worker + render tests — PASS**

- [ ] **Step 5: Commit (when user asks)** — `feat(maps): cache basemap per revision`

---

### Task 8: Web store — initial map job + enriched payload + retry

**Files:**
- Modify: `apps/web/src/store/gameStore.ts`
- Modify: `apps/web/src/store/gameStore.test.ts`
- Modify: `apps/web/src/App.tsx` (payload seed includes map; UI retry)

**Interfaces:**
- Extends `ComuneSeedPayload` with `map: MapGeo`
- Produces:
  - `enqueueAndPollMap(reason: "initial" | "overlay")` internal helper
  - `startGame` → after set state, if `token`+`runId`, fire-and-forget initial map (or sync void)
  - `closeMonth` uses same helper with geo from `state.comune.map`
  - `retryMap: () => Promise<void>` public

Guest mode (`token` null): skip jobs (keep placeholder) — same as today for saves; document in UI that mappa live richiede account (if already the case). If product needs guest maps later, out of scope unless already supported — **do not invent**. Current code only posts map-jobs when token exists inside `closeMonth`; keep that gate for initial too.

- [ ] **Step 1: Failing store tests**

```ts
it("startGame with token enqueues initial map job with geo", async () => {
  // set token, startGame with fixture seed including map
  // mock fetch for POST save? — startGame today does not save; only closeMonth saves
  // Spec: enqueue on startGame — implement POST map-jobs after ensuring run exists.
  // If save is required for ownership, startGame must POST /api/saves first (mirror closeMonth preamble).
});
```

Concrete behavior to implement:

1. `startGame`: if `token`, create `runId`, `POST /api/saves` with initial state, then `POST .../map-jobs` with full geo + `overlaySlots: []`, then poll `/map` (reuse loop from closeMonth).
2. Extract shared `pollMap(runId, token)` and `buildMapJobBody(state)`.

```ts
function buildMapJobBody(state: GameState, runId: string) {
  const { map } = state.comune;
  return {
    comuneId: state.comuneId,
    runId,
    overlaySlots: state.overlay.activeSlots,
    basemapRevision: map.basemapRevision,
    osmQuery: map.osmQuery,
    center: map.center,
    radiusM: map.radiusM,
    mapSlots: map.mapSlots,
  };
}
```

Update `closeMonth` job body to use `buildMapJobBody` (stop hardcoding `basemapRevision: "v0"`).

- [ ] **Step 2: Run web store tests — FAIL**

- [ ] **Step 3: Implement store + update `App.tsx` Setup to pass `map` from hydrate seed**

Hydrate response mapping in `App.tsx` must include `seed.map`.  
Map panel:
- Badge: `Generazione mappa del comune…` when `mapJobPending && !mapUrl`
- On failed job / errorIt from map: button «Riprova mappa» → `retryMap`
- `alt={`Mappa di ${state.comuneName}`}`

- [ ] **Step 4: Run web tests — PASS**

Run: `npm run test -w @localmanager/web`  
Expected: PASS

- [ ] **Step 5: Commit (when user asks)** — `feat(web): generate map on comune start with stable geo`

---

### Task 9: End-to-end verification (fixture mode)

**Files:** none new (run commands)

- [ ] **Step 1: Unit suites**

```bash
npm run test -w @localmanager/shared
npm run test -w @localmanager/comuni-data
npm run test -w @localmanager/sim
npm run test -w @localmanager/api
npm run test -w @localmanager/web
cd services/maps && LOCALMANAGER_MAPS_FIXTURE=1 python -m unittest discover -v
```

Expected: all PASS

- [ ] **Step 2: Build**

```bash
npm run lint && npm run build
```

Expected: PASS

- [ ] **Step 3: Manual smoke (optional, local)**

With maps worker + API: hydrate SMI fixture → start game logged-in → see map job → PNG; complete project → month close → overlay changes without framing jump (fixture: marker pixels stable).

- [ ] **Step 4: Commit (when user asks)** — only if verification fixed stragglers; else no empty commit

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| Nominatim at hydrate → seed geo | 3 |
| Fixed degree-offset slots | 2 |
| Enriched map job input | 1, 5 |
| Basemap on comune confirm / startGame | 8 |
| Overlay on dirty month close | 8 (existing path + geo) |
| Cache basemap; composite overlays | 6, 7 |
| Full re-plot on miss/revision | 7 |
| Italian errors + Riprova | 3, 8 |
| CI fixture / no live OSM | 6, 9 |
| Italian comments on touched code | all tasks |
| Out of scope respected | — |

No TBD placeholders. Type names consistent: `MapGeo`, `MapSlotDef`, `buildDefaultMapSlots`, `resolveComuneGeo`, `parseMapJobInput`, `buildMapJobBody`.
