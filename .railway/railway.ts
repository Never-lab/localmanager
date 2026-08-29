import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

/**
 * Railway Infrastructure as Code (replaces deprecated railway.toml / railway.json).
 *
 * Workflow (needs Railway CLI):
 *   railway login && railway link
 *   railway config plan
 *   railway config apply   # only after you review the plan
 *
 * Secrets stay on Railway via preserve() — set them once in the dashboard
 * (or with `railway variables`) before/after the first apply.
 */
export default defineRailway(() => {
  const db = postgres("Postgres");

  const webApi = service("web-api", {
    source: github("Never-lab/localmanager"),
    build: "npm ci && npm run build",
    start: "npm run start -w @localmanager/api",
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      LOCALMANAGER_SECRET: preserve(),
      MAPS_WORKER_KEY: preserve(),
    },
  });

  const maps = service("maps", {
    source: github("Never-lab/localmanager", {
      rootDirectory: "services/maps",
    }),
    env: {
      // Public HTTPS origin of web-api (no trailing slash), e.g. https://….up.railway.app
      LOCALMANAGER_API_URL: `https://${webApi.env.RAILWAY_PUBLIC_DOMAIN}`,
      MAPS_WORKER_KEY: preserve(),
      // Live prettymaps (fixture=1 only for CI / local unittest)
      LOCALMANAGER_MAPS_FIXTURE: "0",
    },
  });

  return project("localmanager", {
    resources: [db, webApi, maps],
  });
});
