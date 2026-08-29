import type { Database } from "./db.js";

export async function putSave(
  pool: Database,
  runId: string,
  userId: string,
  state: unknown,
): Promise<boolean> {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Game state must be a JSON object");
  }

  const result = await pool.query(
    `INSERT INTO saves (run_id, user_id, state_json)
     VALUES ($1, $2, $3)
     ON CONFLICT (run_id) DO UPDATE
     SET state_json = EXCLUDED.state_json, updated_at = NOW()
     WHERE saves.user_id = EXCLUDED.user_id
     RETURNING run_id`,
    [runId, userId, state],
  );
  return result.rowCount === 1;
}

export async function getSave(
  pool: Database,
  runId: string,
  userId: string,
) {
  const result = await pool.query<{
    run_id: string;
    state_json: unknown;
    updated_at: Date;
  }>(
    `SELECT run_id, state_json, updated_at FROM saves
     WHERE run_id = $1 AND user_id = $2`,
    [runId, userId],
  );
  const save = result.rows[0];
  return save
    ? {
        runId: save.run_id,
        state: save.state_json,
        updatedAt: save.updated_at.toISOString(),
      }
    : null;
}
