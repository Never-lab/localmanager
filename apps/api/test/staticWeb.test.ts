import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Database } from "../src/db.js";
import { createApiServer } from "../src/index.js";

async function withWebServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const webDist = await mkdtemp(join(tmpdir(), "localmanager-web-"));
  await writeFile(join(webDist, "index.html"), "<main>LocalManager</main>");
  await writeFile(join(webDist, "app.js"), "console.log('app')");
  const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Database;
  const server = createApiServer(pool, { secret: "secret", webDist });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(webDist, { recursive: true, force: true });
  }
}

test("serves built web assets", async () => {
  await withWebServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/app.js`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /javascript/);
    assert.equal(await response.text(), "console.log('app')");
  });
});

test("falls back to index.html for SPA routes", async () => {
  await withWebServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/games/run-1`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(await response.text(), "<main>LocalManager</main>");
  });
});

test("does not use the SPA fallback for unknown API routes", async () => {
  await withWebServer(async (baseUrl) => {
    for (const path of ["/api", "/api/missing"]) {
      const response = await fetch(`${baseUrl}${path}`);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Not found" });
    }
  });
});
