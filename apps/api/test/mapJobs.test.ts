import assert from "node:assert/strict";
import test from "node:test";

import type { Database } from "../src/db.js";
import { createApiServer } from "../src/index.js";
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
