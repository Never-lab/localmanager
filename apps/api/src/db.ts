import { readFile } from "node:fs/promises";

import pg from "pg";

const { Pool } = pg;

export type Database = pg.Pool;

export function createPool(connectionString = process.env.DATABASE_URL): Database {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({ connectionString });
}

export async function initializeDatabase(pool: Database): Promise<void> {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}
