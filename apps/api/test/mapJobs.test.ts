import assert from "node:assert/strict";
import test from "node:test";

import type { Database } from "../src/db.js";
import { createApiServer } from "../src/index.js";
import { sessionTokenHash } from "../src/auth.js";
import {
  completeMapJob,
  decodeMapContent,
  extractOverlaySlots,
  MapJobStateConflictError,
} from "../src/mapJobs.js";

test("map jobs accept overlay slots directly", () => {
  assert.deepEqual(
    extractOverlaySlots({ overlaySlots: ["centro", "zona_nord"] }),
    ["centro", "zona_nord"],
  );
});

test("map jobs accept slots from a game-state overlay", () => {
  assert.deepEqual(
    extractOverlaySlots({ overlay: { activeSlots: ["viabilita_est"] } }),
    ["viabilita_est"],
  );
});

test("map jobs reject malformed overlay slots", () => {
  assert.throws(() => extractOverlaySlots({ overlaySlots: [42] }), /overlaySlots/);
});

test("map completion decodes base64 PNG content", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  assert.deepEqual(decodeMapContent({ contentBase64: png.toString("base64") }), png);
});

test("map completion rejects jobs that are not running", async () => {
  for (const status of ["pending", "ready", "failed"]) {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("SELECT run_id")) {
          return {
            rows: [{ run_id: "run-1", status, map_version: status === "ready" ? 3 : null }],
          };
        }
        return { rows: [], rowCount: 0 };
      },
      release() {},
    };
    const pool = { connect: async () => client } as unknown as Database;

    await assert.rejects(
      () => completeMapJob(pool, "job-1", Buffer.from("png"), null),
      MapJobStateConflictError,
    );
    assert.equal(queries.some((sql) => sql.includes("INSERT INTO map_artifacts")), false);
  }
});

async function withMapServer(
  pool: Database,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createApiServer(pool, { secret: "secret" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("map status requires authentication and save ownership", async () => {
  const pool = {
    async query(sql: string, values?: unknown[]) {
      if (sql.includes("FROM sessions")) {
        assert.equal(values?.[0], sessionTokenHash("token", "secret"));
        return {
          rows: [{
            user_id: "user-1",
            created_at: new Date(),
            last_seen_at: new Date(),
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM saves")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Database;

  await withMapServer(pool, async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/runs/run-1/map`);
    assert.equal(anonymous.status, 401);

    const otherUsersRun = await fetch(`${baseUrl}/api/runs/run-1/map`, {
      headers: { authorization: "Bearer token" },
    });
    assert.equal(otherUsersRun.status, 403);
  });
});

test("map PNG responses are private and never cached", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const pool = {
    async query(sql: string) {
      if (sql.includes("FROM sessions")) {
        return {
          rows: [{
            user_id: "user-1",
            created_at: new Date(),
            last_seen_at: new Date(),
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM saves")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("FROM map_jobs")) {
        return {
          rows: [{ status: "ready", map_version: 2, error: null }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM map_artifacts")) {
        return { rows: [{ content: png }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Database;

  await withMapServer(pool, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/runs/run-1/map`, {
      headers: { authorization: "Bearer token" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  });
});

test("health reports maps configured when a worker key is present", async () => {
  const pool = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Database;
  const server = createApiServer(pool, {
    secret: "secret",
    workerKey: "worker",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health`,
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).maps, "ok");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("completing an unknown map job returns 404", async () => {
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT run_id")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const pool = { connect: async () => client } as unknown as Database;
  const server = createApiServer(pool, { secret: "secret", workerKey: "worker" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/internal/map-jobs/missing/complete`,
      {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "x-maps-worker-key": "worker",
        },
        body: Buffer.from("png"),
      },
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Map job not found" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
