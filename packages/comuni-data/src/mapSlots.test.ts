import { describe, expect, it } from "vitest";
import { buildDefaultMapSlots } from "./mapSlots.js";

describe("buildDefaultMapSlots", () => {
  it("places slots with fixed degree offsets from center", () => {
    const slots = buildDefaultMapSlots({ lat: 42.2167, lon: 14.45 });
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({
      id: "centro",
      lat: 42.2167,
      lon: 14.45,
      radiusM: 120,
    });
    expect(slots[1]).toMatchObject({
      id: "zona_nord",
      lat: 42.2207,
      lon: 14.45,
    });
    expect(slots[2]).toMatchObject({
      id: "viabilita_est",
      lat: 42.2167,
      lon: 14.455,
    });
  });
});
