# Railway Infrastructure as Code

This project uses [Railway IaC](https://docs.railway.com/infrastructure-as-code) (`.railway/railway.ts`).  
`railway.toml` / `railway.json` are **deprecated** and ignored for **new** services (hard cutoff 2026-12-01).

## Dashboard (no CLI) — fastest for first deploy

### Service `web-api`

| Setting | Value |
| --- | --- |
| Source | GitHub `Never-lab/localmanager` (branch you deploy) |
| Root Directory | *(empty / repo root)* |
| Builder | Railpack / Nixpacks (auto) |
| Build command | *(leave empty — uses `npm run build` from package.json)* or `npm ci && npm run build` |
| Start command | *(leave empty — uses root `"start"` → API)* or `npm run start -w @localmanager/api` |
| Healthcheck path | `/api/health` |

Variables:

- `DATABASE_URL` → reference to your Postgres
- `LOCALMANAGER_SECRET` → long random string
- `MAPS_WORKER_KEY` → long random string (same on `maps`)

Generate a public domain, then open `/api/health`.

### Service `maps`

| Setting | Value |
| --- | --- |
| Source | same repo |
| Root Directory | `services/maps` |
| Builder | Dockerfile (auto from `services/maps/Dockerfile`) |

Variables:

- `LOCALMANAGER_API_URL` → public URL of `web-api` **without** trailing slash
- `MAPS_WORKER_KEY` → **same** as `web-api`
- `LOCALMANAGER_MAPS_FIXTURE` → `1` for staging stub maps

Do **not** point any “Config as Code file” setting at the old `railway.toml` paths.

## CLI (IaC)

```bash
npm install          # installs `railway` package for the TS DSL
# install Railway CLI: https://docs.railway.com/guides/cli
railway login
railway link
railway config plan
railway config apply   # only after reviewing the plan
```

Set secrets once in the dashboard (`LOCALMANAGER_SECRET`, `MAPS_WORKER_KEY`); the IaC file uses `preserve()` so they are not stored in git.
