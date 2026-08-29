# LocalManager

Educational Italian mayor sim: manage a real municipality from a desk, grow it, survive politics, and watch the town map evolve as infrastructure changes. Choose any comune from the national ISTAT catalog (hydrate BDAP/CUP) — not administrative or political advice.

Design spec: [`docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md`](docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md).

## Setup

```bash
npm install
npm test
```

## Railway staging

**Config as Code (`railway.toml` / `railway.json`) is deprecated.** New services must use the dashboard build/start settings or [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) (`.railway/railway.ts`). See [`.railway/README.md`](.railway/README.md).

Provision one Railway Postgres and two services from this repository:

| Service | Root directory | Build / start | Required variables |
| --- | --- | --- | --- |
| `web-api` | `/` (repo root) | Railpack uses root `build` + `start` scripts (see `railpack.json`). Health `/api/health` | `DATABASE_URL`, `LOCALMANAGER_SECRET`, `MAPS_WORKER_KEY` |
| `maps` | `services/maps` | Dockerfile in that folder | `LOCALMANAGER_API_URL`, `MAPS_WORKER_KEY` (same value), `LOCALMANAGER_MAPS_FIXTURE=0` (use `1` only for CI) |

Use Railway's Postgres reference for `DATABASE_URL` on `web-api`.
Generate long, independent random values for `LOCALMANAGER_SECRET` and
`MAPS_WORKER_KEY`; the worker key must match on both services.
Set `LOCALMANAGER_API_URL` on `maps` to the public Railway URL of `web-api`
with scheme, e.g. `https://….up.railway.app` (no trailing slash). Railway supplies `PORT` to `web-api`.

The `web-api` build runs `npm run build` at the repository root, which
builds shared, sim, web, and API in order so `apps/web/dist` exists. The API
serves that directory and supports SPA routes.
Set `WEB_DIST` only when the built web directory is in a nonstandard location.

Map PNGs are stored in Postgres as `BYTEA` in `map_artifacts.content` and
streamed by `GET /api/runs/:id/map`, so v0 does not need a Railway volume.
The API applies `apps/api/src/schema.sql` at startup.

Deployment checklist (account / V1 staging bar):

1. Create Postgres, `web-api`, and `maps`; set roots, build/start, and variables (dashboard or `railway config apply`).
2. Deploy `web-api`, copy its public URL to `LOCALMANAGER_API_URL`, then deploy `maps`.
3. Confirm `/api/health` returns `{"ok":true,"storage":"postgres",...}`.
4. Register, pick a comune (not only SMI), hydrate, start a game; confirm basemap for that comune.
5. Act and close months until a project completes; confirm autosave, overlay update, and a changed image.
6. Refresh the browser: session should restore to the menu; **Riprendi partita** reloads the same run and map (no re-login).
7. Reach month 48 and confirm the election screen.
8. Log out clears the stored session; guest remains best-effort (no cloud map / no local slots yet).
