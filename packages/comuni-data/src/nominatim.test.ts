import { describe, expect, it, vi } from "vitest";
import { resolveComuneGeo } from "./nominatim.js";

describe("resolveComuneGeo", () => {
  it("maps nominatim hit to MapGeo + default slots", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "42.2167",
            lon: "14.45",
            boundingbox: ["42.20", "42.23", "14.43", "14.47"],
            display_name: "Santa Maria Imbaro, Abruzzo, Italy",
          },
        ]),
        { status: 200 },
      ),
    );
    const geo = await resolveComuneGeo(
      {
        id: "069084",
        name: "Santa Maria Imbaro",
        province: "CH",
        provinceName: null,
        region: "Abruzzo",
      },
      { fetchImpl, basemapRevision: "2026-08-29" },
    );
    expect("errorIt" in geo).toBe(false);
    if ("errorIt" in geo) return;
    expect(geo.osmQuery).toContain("Santa Maria Imbaro");
    expect(geo.center).toEqual({ lat: 42.2167, lon: 14.45 });
    expect(geo.mapSlots).toHaveLength(3);
    expect(geo.basemapRevision).toBe("2026-08-29");
  });

  it("returns Italian error when empty", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    const geo = await resolveComuneGeo(
      {
        id: "000000",
        name: "NessunDove",
        province: null,
        provinceName: null,
        region: "Lazio",
      },
      { fetchImpl },
    );
    expect(geo).toMatchObject({
      errorIt: expect.stringMatching(/Geolocalizzazione/i),
    });
  });
});
