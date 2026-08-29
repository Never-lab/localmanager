# LocalManager

Educational Italian mayor sim: manage a real municipality from a desk, grow it, survive politics, and watch the town map evolve as infrastructure changes. v0 starts on **Santa Maria Imbaro (CH)** — not administrative or political advice.

Design spec: [`docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md`](docs/superpowers/specs/2026-08-29-localmanager-v0-skeleton-design.md).

## Setup

```bash
npm install
npm test
```

## Railway staging

Provision one Railway Postgres database and two services from this repository:

| Service | Root directory | Config file | Required variables |
| --- | --- | --- | --- |
| `web-api` | `/` | `/apps/api/railway.toml` | `DATABASE_URL`, `LOCALMANAGER_SECRET`, `MAPS_WORKER_KEY` |
| `maps` | `/services/maps` | `/railway.toml` | `DATABASE_URL`, `MAPS_WORKER_KEY`, `LOCALMANAGER_API_URL` |

Use Railway's Postgres reference for the same `DATABASE_URL` in both services.
Generate long, independent random values for `LOCALMANAGER_SECRET` and
`MAPS_WORKER_KEY`; the `MAPS_WORKER_KEY` value must match in both services.
Set `LOCALMANAGER_API_URL` on `maps` to the public Railway URL of `web-api`
without a trailing slash. Railway supplies `PORT` to `web-api`.

The `web-api` Railway build runs `npm run build` at the repository root, which
builds shared, sim, web, and API in order so `apps/web/dist` exists. Its start
command runs the API, which serves that directory and supports SPA routes.
Set `WEB_DIST` only when the built web directory is in a nonstandard location.

Map PNGs are stored in Postgres as `BYTEA` in `map_artifacts.content` and
streamed by `GET /api/runs/:id/map`, so v0 does not need a Railway volume.
The API applies `apps/api/src/schema.sql` at startup.

Deployment checklist (requires Railway credentials):

1. Create Postgres, `web-api`, and `maps`; set the roots, config paths, and variables above.
2. Deploy `web-api`, copy its public URL to `LOCALMANAGER_API_URL`, then deploy `maps`.
3. Confirm `/api/health` returns `{"ok":true,"storage":"postgres",...}`.
4. Register, start a game, act, and close months until a project completes; confirm autosave, a ready map job, and a changed image.
5. Return to the menu and use **Riprendi partita**, then reach month 48 and confirm the election screen.

These steps document the deployment; they do not assert that a Railway deploy
has been performed from this checkout.
