import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findComune,
  hydrateComune,
  loadCatalog,
  searchCatalog,
  type ComuneSeed,
  type HydrateStatus,
} from "@localmanager/comuni-data";
import type { Database } from "./db.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const hydrateOptions = () => ({
  cacheDir:
    process.env.COMUNI_CACHE_DIR ?? join(repoRoot, "data/comuni/cache"),
  bulkDir: process.env.COMUNI_BULK_DIR ?? join(repoRoot, "data/comuni/bulk"),
  fixtureDir:
    process.env.COMUNI_FIXTURE_DIR ?? join(repoRoot, "data/comuni/fixtures"),
});

/** One in-flight hydrate per istat id (shared download). */
const inflight = new Map<string, Promise<ComuneSeed | null>>();

export async function listComuni(query: {
  q?: string;
  region?: string;
  province?: string;
  limit?: number;
}) {
  const catalog = await loadCatalog(
    process.env.COMUNI_CATALOG_PATH ??
      join(repoRoot, "data/comuni/catalog/comuni.json"),
  );
  return {
    count: catalog.count,
    snapshotDate: catalog.snapshotDate,
    items: searchCatalog(catalog, {
      q: query.q,
      region: query.region,
      province: query.province,
      limit: query.limit ?? 40,
    }),
  };
}

export async function getCachedSeed(
  pool: Database,
  istatId: string,
): Promise<ComuneSeed | null> {
  const id = istatId.padStart(6, "0");
  const result = await pool.query<{ seed_json: ComuneSeed }>(
    `SELECT seed_json FROM comune_seeds WHERE istat_id = $1`,
    [id],
  );
  return result.rows[0]?.seed_json ?? null;
}

async function persistSeed(pool: Database, seed: ComuneSeed): Promise<void> {
  await pool.query(
    `INSERT INTO comune_seeds (istat_id, seed_json, fetched_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (istat_id) DO UPDATE
     SET seed_json = EXCLUDED.seed_json, fetched_at = NOW()`,
    [seed.comuneId, JSON.stringify(seed)],
  );
}

async function updateJob(
  pool: Database,
  jobId: string,
  status: HydrateStatus,
  seed?: ComuneSeed,
  errorIt?: string,
): Promise<void> {
  await pool.query(
    `UPDATE hydrate_jobs
     SET status = $2,
         seed_json = COALESCE($3::jsonb, seed_json),
         error_it = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, status, seed ? JSON.stringify(seed) : null, errorIt ?? null],
  );
}

export async function startHydrate(
  pool: Database,
  istatId: string,
): Promise<{ jobId: string; status: HydrateStatus; seed?: ComuneSeed }> {
  const id = istatId.padStart(6, "0");
  const catalog = await loadCatalog(
    process.env.COMUNI_CATALOG_PATH ??
      join(repoRoot, "data/comuni/catalog/comuni.json"),
  );
  if (!findComune(catalog, id)) {
    throw new Error("Comune non trovato nel catalogo ISTAT");
  }

  const cached = await getCachedSeed(pool, id);
  if (cached) {
    const jobId = randomUUID();
    await pool.query(
      `INSERT INTO hydrate_jobs (id, istat_id, status, seed_json, updated_at)
       VALUES ($1, $2, 'ready', $3::jsonb, NOW())`,
      [jobId, id, JSON.stringify(cached)],
    );
    return { jobId, status: "ready", seed: cached };
  }

  const jobId = randomUUID();
  await pool.query(
    `INSERT INTO hydrate_jobs (id, istat_id, status, updated_at)
     VALUES ($1, $2, 'queued', NOW())`,
    [jobId, id],
  );

  let work = inflight.get(id);
  if (!work) {
    work = (async () => {
      try {
        const result = await hydrateComune(id, {
          ...hydrateOptions(),
          onStatus: (status) => {
            void updateJob(pool, jobId, status);
          },
        });
        if (result.status === "ready" && result.seed) {
          await persistSeed(pool, result.seed);
          return result.seed;
        }
        await updateJob(pool, jobId, "failed", undefined, result.errorIt);
        return null;
      } catch (error) {
        await updateJob(
          pool,
          jobId,
          "failed",
          undefined,
          error instanceof Error ? error.message : "Errore hydrate",
        );
        return null;
      } finally {
        inflight.delete(id);
      }
    })();
    inflight.set(id, work);
  }

  void work.then(async (seed) => {
    if (seed) await updateJob(pool, jobId, "ready", seed);
  });

  return { jobId, status: "queued" };
}

export async function getHydrateJob(pool: Database, jobId: string) {
  const result = await pool.query<{
    id: string;
    istat_id: string;
    status: HydrateStatus;
    seed_json: ComuneSeed | null;
    error_it: string | null;
  }>(
    `SELECT id, istat_id, status, seed_json, error_it
     FROM hydrate_jobs WHERE id = $1`,
    [jobId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    jobId: row.id,
    istatId: row.istat_id,
    status: row.status,
    seed: row.seed_json ?? undefined,
    errorIt: row.error_it ?? undefined,
  };
}
