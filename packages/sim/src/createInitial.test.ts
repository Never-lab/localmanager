import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./createInitial.js";

describe("createInitialGameState map geo", () => {
  it("copies map geo from comuneSeed into state.comune.map", () => {
    const map = {
      osmQuery: "Santa Maria Imbaro, Abruzzo, Italy",
      center: { lat: 42.2167, lon: 14.45 },
      radiusM: 1200,
      basemapRevision: "2026-08-29",
      mapSlots: [
        {
          id: "centro" as const,
          labelIt: "Centro",
          lat: 42.2167,
          lon: 14.45,
          radiusM: 120,
        },
      ],
    };
    const state = createInitialGameState({
      mayorName: "Ada",
      comuneSeed: {
        comuneId: "069084",
        name: "Santa Maria Imbaro",
        province: "CH",
        region: "Abruzzo",
        population: 2022,
        meanAge: 43,
        openingCash: 1,
        monthlyBaseIncome: 1,
        monthlyMaintenance: 1,
        sourceYear: 2023,
        sources: [],
        projects: [],
        map,
      },
    });
    expect(state.comune.map).toEqual(map);
  });

  it("uses fixture map when comuneSeed is omitted", () => {
    const state = createInitialGameState({ mayorName: "Ada" });
    expect(state.comune.map.osmQuery).toContain("Santa Maria Imbaro");
    expect(state.comune.map.mapSlots.length).toBeGreaterThan(0);
  });
});
