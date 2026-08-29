import { describe, expect, it } from "vitest";
import {
  buildSeedFromRows,
  filterRowsByIstat,
  mapBdapOpeningDebt,
  mapBdapToBudget,
  mapBdapToProjects,
  mapCupToProjects,
  parseNumber,
} from "./index.js";

describe("parseNumber", () => {
  it("reads BDAP dump decimals with a single dot", () => {
    expect(parseNumber("65168.41")).toBeCloseTo(65168.41);
  });

  it("still reads Italian thousands", () => {
    expect(parseNumber("1.200.000")).toBe(1_200_000);
    expect(parseNumber("1.200.000,50")).toBeCloseTo(1_200_000.5);
  });
});

describe("filterRowsByIstat", () => {
  it("matches BDAP split provincia+comune codes", () => {
    const rows = filterRowsByIstat(
      [
        {
          "Codice istat provincia": "069",
          "Codice istat comune": "084",
          "Denominazione Ente": "COMUNE DI SANTA MARIA IMBARO",
          "Accertamento in CC": "100",
        },
        {
          "Codice istat provincia": "069",
          "Codice istat comune": "001",
          "Accertamento in CC": "50",
        },
      ],
      "069084",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]["Denominazione Ente"]).toContain("SANTA MARIA");
  });
});

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
    expect(budget!.openingDebt).toBe(0);
    expect(budget!.sourceYear).toBe(2023);
    expect(budget!.openingCash).toBeGreaterThan(0);
  });

  it("maps real BDAP column names Accertamento in CC / Impegno totale", () => {
    const budget = mapBdapToBudget(
      [
        {
          "Codice istat provincia": "069",
          "Codice istat comune": "084",
          "Esercizio Finanziario": "2015",
          "Accertamento in CC": "1200000.00",
        },
      ],
      [
        {
          "Codice istat provincia": "069",
          "Codice istat comune": "084",
          "Impegno totale": "960000.00",
        },
      ],
      ["https://example.test/entrate", "https://example.test/spese"],
    );
    expect(budget).not.toBeNull();
    expect(budget!.monthlyBaseIncome).toBe(100_000);
    expect(budget!.monthlyMaintenance).toBe(80_000);
    expect(budget!.sourceYear).toBe(2015);
  });
});

describe("mapBdapOpeningDebt", () => {
  it("sums Passivo DEBITI di finanziamento", () => {
    const debt = mapBdapOpeningDebt([
      {
        "Tipologia Voce": "Passivo",
        "Codice Voce I livello": "DEBITI",
        "Codice Voce II livello": "DI FINANZIAMENTO",
        "Consistenza Finale Patrimonio": "879292.48",
      },
      {
        "Tipologia Voce": "Passivo",
        "Codice Voce I livello": "DEBITI",
        "Codice Voce II livello": "DI FUNZIONAMENTO",
        "Consistenza Finale Patrimonio": "576465.04",
      },
      {
        "Tipologia Voce": "Attivo",
        "Codice Voce I livello": "IMMOBILIZZAZIONI",
        "Codice Voce II livello": "MATERIALI",
        "Consistenza Finale Patrimonio": "1000000.00",
      },
    ]);
    expect(debt).toBe(879_292);
  });

  it("returns 0 when financing debt rows are missing", () => {
    expect(mapBdapOpeningDebt([])).toBe(0);
  });
});

describe("mapBdapToProjects", () => {
  it("builds projects from conto capitale interventi", () => {
    const projects = mapBdapToProjects([
      {
        "Descrizione Titolo Spese": "SPESE IN CONTO CAPITALE",
        "Descrizione Intervento": "ACQUISIZIONE DI BENI IMMOBILI",
        "Descrizione Funzione": "ISTRUZIONE PUBBLICA",
        "Impegno totale": "280000.00",
      },
      {
        "Descrizione Titolo Spese": "SPESE IN CONTO CAPITALE",
        "Descrizione Intervento": "ACQUISIZIONE DI BENI MOBILI",
        "Descrizione Funzione": "VIABILITA",
        "Impegno totale": "200000.00",
      },
      {
        "Descrizione Titolo Spese": "SPESE CORRENTI",
        "Descrizione Intervento": "PERSONALE",
        "Impegno totale": "500000.00",
      },
    ]);
    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects[0].cost).toBe(280_000);
    expect(projects[0].nameIt.toLowerCase()).toMatch(/immobili|istruzione/);
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
