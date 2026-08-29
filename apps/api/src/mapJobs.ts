import { randomUUID } from "node:crypto";

import type { Database } from "./db.js";

interface MapJobInput {
  comuneId: string;
  runId: string;
  overlaySlots: string[];
  basemapRevision: string;
}

export class MapJobNotFoundError extends Error {}
export class MapJobStateConflictError extends Error {}
export class MapJobOwnershipError extends Error {}

export function extractOverlaySlots(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    throw new Error("overlaySlots must be an array of strings");
  }

  const value = body as {
    overlaySlots?: unknown;
    overlay?: { activeSlots?: unknown };
  };
  const slots = value.overlaySlots ?? value.overlay?.activeSlots;
  if (!Array.isArray(slots) || !slots.every((slot) => typeof slot === "string")) {
    throw new Error("overlaySlots must be an array of strings");
  }
  return slots;
}

export function decodeMapContent(body: unknown): Buffer {
  const contentBase64 =
    body && typeof body === "object"
      ? (body as { contentBase64?: unknown }).contentBase64
      : undefined;
  if (typeof contentBase64 !== "string" || contentBase64.length === 0) {
    throw new Error("contentBase64 is required");
  }
  return Buffer.from(contentBase64, "base64");
}

function toJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    runId: row.run_id,
    status: row.status,
    input: row.input_json,
    artifactPath: row.artifact_path,
    mapVersion: row.map_version,
    error: row.error,
    attempts: row.attempts,
  };
}

export async function enqueueMapJob(
  pool: Database,
  runId: string,
  userId: string,
  body: unknown,
): Promise<ReturnType<typeof toJob> | null> {
  const ownership = await pool.query(
    "SELECT 1 FROM saves WHERE run_id = $1 AND user_id = $2",
    [runId, userId],
  );
  if (ownership.rowCount !== 1) {
    throw new MapJobOwnershipError("Run belongs to another user");
  }

  const source = body as { basemapRevision?: unknown; comuneId?: unknown };
  const input: MapJobInput = {
    comuneId:
      typeof source.comuneId === "string" && source.comuneId
        ? source.comuneId
        : "069084",
    runId,
    overlaySlots: extractOverlaySlots(body),
    basemapRevision:
      typeof source.basemapRevision === "string" ? source.basemapRevision : "v0",
  };
  const result = await pool.query(
    `INSERT INTO map_jobs (id, run_id, status, input_json)
     VALUES ($1, $2, 'pending', $3)
     ON CONFLICT (run_id, input_json) WHERE status = 'pending' DO NOTHING
     RETURNING *`,
    [randomUUID(), runId, input],
  );
  return result.rows[0] ? toJob(result.rows[0]) : null;
}

export async function claimNextMapJob(
  pool: Database,
): Promise<ReturnType<typeof toJob> | null> {
  const result = await pool.query(
    `UPDATE map_jobs
     SET status = 'running', attempts = attempts + 1
     WHERE id = (
       SELECT id FROM map_jobs
       WHERE status = 'pending'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
  );
  return result.rows[0] ? toJob(result.rows[0]) : null;
}

export async function completeMapJob(
  pool: Database,
  jobId: string,
  content: Buffer | null,
  error: string | null,
): Promise<number | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobResult = await client.query<{
      run_id: string;
      status: string;
      map_version: number | null;
    }>(
      "SELECT run_id, status, map_version FROM map_jobs WHERE id = $1 FOR UPDATE",
      [jobId],
    );
    const job = jobResult.rows[0];
    if (!job) {
      throw new MapJobNotFoundError("Map job not found");
    }
    if (job.status !== "running") {
      throw new MapJobStateConflictError(
        `Map job cannot be completed from status '${job.status}'`,
      );
    }

    if (error) {
      await client.query(
        "UPDATE map_jobs SET status = 'failed', error = $2 WHERE id = $1",
        [jobId, error],
      );
      await client.query("COMMIT");
      return null;
    }
    if (!content?.length) throw new Error("PNG content is required");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [job.run_id],
    );
    const versionResult = await client.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(map_version), 0) + 1 AS next_version
       FROM map_artifacts WHERE run_id = $1`,
      [job.run_id],
    );
    const mapVersion = Number(versionResult.rows[0].next_version);
    await client.query(
      `INSERT INTO map_artifacts (run_id, map_version, content)
       VALUES ($1, $2, $3)`,
      [job.run_id, mapVersion, content],
    );
    await client.query(
      `UPDATE map_jobs
       SET status = 'ready', map_version = $2, error = NULL
       WHERE id = $1`,
      [jobId, mapVersion],
    );
    await client.query("COMMIT");
    return mapVersion;
  } catch (error) {
    await client.query("ROLLBACK");
    const pgCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    if (pgCode === "23505") {
      await client.query(
        `UPDATE map_jobs
         SET status = 'failed', error = $2
         WHERE id = $1 AND status = 'running'`,
        [jobId, "Map version conflict"],
      );
      throw new MapJobStateConflictError("Map version conflict");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getMapState(
  pool: Database,
  runId: string,
  userId: string,
) {
  const ownership = await pool.query(
    "SELECT 1 FROM saves WHERE run_id = $1 AND user_id = $2",
    [runId, userId],
  );
  if (ownership.rowCount !== 1) {
    throw new MapJobOwnershipError("Run belongs to another user");
  }

  const jobResult = await pool.query<{
    status: string;
    map_version: number | null;
    error: string | null;
  }>(
    `SELECT status, map_version, error FROM map_jobs
     WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [runId],
  );
  const job = jobResult.rows[0];
  if (!job) return null;
  if (job.status !== "ready" || job.map_version === null) {
    return {
      status: job.status,
      mapVersion: job.map_version,
      error: job.error,
      content: null,
    };
  }

  const artifact = await pool.query<{ content: Buffer }>(
    `SELECT content FROM map_artifacts
     WHERE run_id = $1 AND map_version = $2`,
    [runId, job.map_version],
  );
  return {
    status: artifact.rows[0] ? "ready" : "failed",
    mapVersion: job.map_version,
    error: artifact.rows[0] ? null : "Map artifact is missing",
    content: artifact.rows[0]?.content ?? null,
  };
}
