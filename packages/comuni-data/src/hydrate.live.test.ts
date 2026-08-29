import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hydrateComune } from "./hydrate.js";

const live = process.env.COMUNI_LIVE_OPENDATA === "1";

describe.skipIf(!live)("hydrateComune live BDAP", () => {
  it(
    "hydrates Santa Maria Imbaro from regional CKAN dumps",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "lm-bdap-live-"));
      try {
        const result = await hydrateComune("069084", {
          cacheDir: join(dir, "cache"),
          bulkDir: join(dir, "bulk"),
        });
        expect(result.status).toBe("ready");
        expect(result.seed?.name).toMatch(/Santa Maria Imbaro/i);
        expect(result.seed?.population).toBeGreaterThan(1000);
        expect(result.seed?.budget.monthlyBaseIncome).toBeGreaterThan(0);
        expect(result.seed?.projects.length).toBeGreaterThan(0);
        expect(result.seed?.map?.center).toBeTruthy();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
