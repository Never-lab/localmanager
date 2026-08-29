import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { hydrateComune } from "./hydrate.js";

describe("hydrateComune geo", () => {
  it("fails when fixture lacks map and nominatim is empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lm-hydrate-"));
    const seed = {
      comuneId: "069084",
      name: "Santa Maria Imbaro",
      province: "CH",
      region: "Abruzzo",
      population: 2022,
      meanAge: 43,
      budget: {
        openingCash: 1,
        openingDebt: 0,
        monthlyBaseIncome: 1,
        monthlyMaintenance: 1,
        sourceYear: 2023,
        sourceUrls: [],
      },
      projects: [
        {
          templateId: "cup_x",
          nameIt: "x",
          cost: 1,
          months: 1,
          slotId: "centro",
          effects: {
            population: 0,
            meanAge: 0,
            peopleRep: 0,
            politicalRep: 0,
          },
        },
      ],
      fetchedAt: "2026-08-29T00:00:00.000Z",
      sources: [],
    };
    await writeFile(join(dir, "069084.json"), JSON.stringify(seed), "utf8");

    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));

    const result = await hydrateComune("069084", {
      cacheDir: join(dir, "cache"),
      bulkDir: join(dir, "bulk"),
      fixtureDir: dir,
      fetchImpl,
    });

    expect(result.status).toBe("failed");
    expect(result.errorIt).toMatch(/Geolocalizzazione/i);
  });
});
