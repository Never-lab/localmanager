# Map steroids — design (2026-08-29)

Approved in chat. Goal: faithful HQ basemap at comune selection; overlay updates precise and stable (no random zoom). Touched-code comments in Italian.

## Locked choices

| Topic | Choice |
| --- | --- |
| Visual quality | High-quality prettymaps + framing on inhabited center |
| Geography | Nominatim at hydrate → persist `osmQuery`, `center`, `radiusM`, `basemapRevision`, `mapSlots` in `ComuneSeed` |
| Regen strategy | Hybrid: cache basemap PNG per `(runId, basemapRevision)`; composite overlays when dirty; full re-plot only on cache miss or `basemapRevision` change |
| Slot placement | Fixed degree offsets from center for `centro` / `zona_nord` / `viabilita_est` (SMI-style) |
| Architecture approach | Geo in seed + two-step worker |

## Architecture

1. **Hydrate** (`comuni-data` / API): after BDAP/CUP, Nominatim lookup (`"{name}, {province|region}, Italy"`). Seed gains geo + `mapSlots`. No geo → hydrate `failed` with Italian message + retry.
2. **Map jobs** (API): input `{ comuneId, runId, overlaySlots, basemapRevision, osmQuery, center, radiusM, mapSlots }`.
   - Trigger **basemap** on `startGame` / comune confirm (even with empty overlay).
   - Trigger **overlay** on month close if `overlay.dirty`.
3. **Worker** (`services/maps`):
   - `render_basemap`: prettymaps with fixed query/center/radius, richer style/DPI; cache PNG.
   - `composite_overlay`: active slots lat/lon → pixel on cached basemap (same frame).
   - Remove hardcoded Santa Maria Imbaro query and fake 0–1 `transAxes` coordinates.

## Data flow / UX

- Setup: hydrate → `startGame` → enqueue map job → desk shows Italian spinner/badge until `GET /map` is 200 → crossfade.
- Placeholder only on failure, with reason + «Riprova»; game remains playable.
- Month close: existing dirty flag → job with same geo params + updated slots → composite → crossfade → clear dirty on `mapVersion` bump.
- CI: `LOCALMANAGER_MAPS_FIXTURE=1` stub basemap + markers; no live Nominatim/prettymaps.

## Errors

- Nominatim down / empty / rate limit → hydrate failed (IT copy).
- Map job failed → `failed` + UI retry; playable with placeholder.
- Corrupt/missing basemap cache → one full re-plot with same fixed params, then resume composite.
- Client poll timeout → existing-style Italian timeout + retry (also for initial job).

## Tests (no live prettymaps in CI)

- `comuni-data`: mock Nominatim → seed geo; fail path.
- API: enriched map-job input validation; reject missing geo.
- Worker fixture: deterministic composite; stable marker positions across overlay versions.
- Web store: initial job on `startGame`; overlay job when dirty; version bump clears dirty.

## Out of scope

Offline national coordinate catalog, smart OSM POI slots, freeform map editing, multiple thumbs.

## Conventions

- Player UI: Italian.
- Identifiers: English.
- Comments on touched code: Italian.
