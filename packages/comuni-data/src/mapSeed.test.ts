import { describe, expect, it } from "vitest";
import { buildSeedFromRows, mapBdapToBudget, mapCupToProjects } from "./index.js";

describe("mapBdapToBudget", () => {
  it("maps entrate/spese totals into monthly game fields", () => {
    const budget = mapBdapToBudget(
      [
        {
          "Codice Comune": "069084",
          "Esercizio finanziario": "2023",
          Accertamenti: "1.200.000",
          "Popolazione ISTAT": "2022",
        },
      ],
      [
        {
          "Codice Comune": "069084",
          Impegni: "960.000",
        },
      ],
      ["https://example.test/entrate", "https://example.test/spese"],
    );
    expect(budget).not.toBeNull();
    expect(budget!.monthlyBaseIncome).toBe(100_000);
    expect(budget!.monthlyMaintenance).toBe(80_000);
    expect(budget!.sourceYear).toBe(2023);
    expect(budget!.openingCash).toBeGreaterThan(0);
  });
});

describe("mapCupToProjects", () => {
  it("keeps up to 4 real projects with official titles/costs", () => {
    const projects = mapCupToProjects([
      {
        CUP: "A1",
        NOME_INTERVENTO: "Riqualificazione scuola primaria",
        COSTO_PROGETTO: "280000",
        NATURA: "Istruzione",
        CODI_CODICE_COMUNE: "069084",
      },
      {
        CUP: "A2",
        NOME_INTERVENTO: "Sistemazione viabilità est",
        COSTO_PROGETTO: "200000",
        NATURA: "Viabilità",
        CODI_CODICE_COMUNE: "069084",
      },
      {
        CUP: "A3",
        NOME_INTERVENTO: "Centro giovani comunale",
        COSTO_PROGETTO: "120000",
        NATURA: "Giovani",
        CODI_CODICE_COMUNE: "069084",
      },
    ]);
    expect(projects).toHaveLength(3);
    expect(projects[0].templateId).toBe("cup_A1");
    expect(projects[0].nameIt).toContain("scuola");
    expect(projects[0].cost).toBe(280_000);
  });
});

describe("buildSeedFromRows", () => {
  it("fails when projects are missing", () => {
    const result = buildSeedFromRows(
      {
        id: "069084",
        name: "Santa Maria Imbaro",
        province: "CH",
        provinceName: null,
        region: "Abruzzo",
      },
      [
        {
          "Codice Comune": "069084",
          Accertamenti: "1000",
          "Popolazione ISTAT": "2022",
        },
      ],
      [{ "Codice Comune": "069084", Impegni: "800" }],
      [],
      ["https://example.test"],
      {
        osmQuery: "Santa Maria Imbaro, Abruzzo, Italy",
        center: { lat: 42.2167, lon: 14.45 },
        radiusM: 1200,
        basemapRevision: "2026-08-29",
        mapSlots: [],
      },
    );
    expect(result.status).toBe("failed");
  });
});
