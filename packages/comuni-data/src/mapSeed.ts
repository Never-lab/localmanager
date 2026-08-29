import type { MapSlotId } from "@localmanager/shared";
import { parseNumber } from "./csv.js";
import type { ComuneBudgetSeed, ComuneProjectSeed } from "./types.js";

const SLOTS: MapSlotId[] = ["centro", "zona_nord", "viabilita_est"];

type Category = "youth_space" | "road_fix" | "school_wing";

const CATEGORY_EFFECTS: Record<Category, ComuneProjectSeed["effects"]> = {
  youth_space: { population: 15, meanAge: -0.2, peopleRep: 4, politicalRep: 1 },
  road_fix: { population: 8, meanAge: 0, peopleRep: 3, politicalRep: 3 },
  school_wing: { population: 25, meanAge: -0.4, peopleRep: 5, politicalRep: 2 },
};

const NATURA_MONTHS: Record<string, number> = {
  scuola: 8,
  istruzione: 8,
  viabilit: 5,
  strada: 5,
  giovane: 4,
  sport: 4,
  culturale: 6,
  default: 6,
};

function pickCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/scuol|istruz|asilo|infanzia/.test(t)) return "school_wing";
  if (/viabilit|strada|pont|mobil/.test(t)) return "road_fix";
  return "youth_space";
}

function monthsFor(text: string): number {
  const t = text.toLowerCase();
  for (const [key, months] of Object.entries(NATURA_MONTHS)) {
    if (key !== "default" && t.includes(key)) return months;
  }
  return NATURA_MONTHS.default;
}

function field(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    if (found && row[found]) return row[found];
  }
  return "";
}

/** Educational floor so hydrated comuni stay playable. */
export const MIN_MONTHLY_SURPLUS = 5_000;
/** Cap financing debt stock at N months of base income. */
export const DEBT_CAP_MONTHS = 36;

export function capOpeningDebt(
  rawDebt: number,
  monthlyBaseIncome: number,
): number {
  const cap = Math.max(0, monthlyBaseIncome) * DEBT_CAP_MONTHS;
  return Math.min(Math.max(0, rawDebt), cap);
}

/**
 * Map BDAP-style entrate/spese rows for one ente into game budget fields.
 * Expects competency totals (or sums all numeric measure columns).
 */
export function mapBdapToBudget(
  entrateRows: Record<string, string>[],
  speseRows: Record<string, string>[],
  sourceUrls: string[],
): ComuneBudgetSeed | null {
  const sumCol = (rows: Record<string, string>[], candidates: string[]) => {
    let total = 0;
    let hit = false;
    for (const row of rows) {
      for (const c of candidates) {
        const raw = field(row, [c]);
        const n = parseNumber(raw);
        if (n !== null) {
          total += n;
          hit = true;
          break;
        }
      }
    }
    return hit ? total : null;
  };

  const entrate =
    sumCol(entrateRows, [
      "Accertamento in CC",
      "Accertamenti",
      "accertamenti",
      "Importo",
      "Valore",
      "competenza",
    ]) ?? sumAllNumeric(entrateRows);
  const spese =
    sumCol(speseRows, [
      "Impegno totale",
      "Impegni",
      "impegni",
      "Importo",
      "Valore",
      "competenza",
    ]) ?? sumAllNumeric(speseRows);

  if (entrate === null || spese === null || entrate <= 0 || spese <= 0) {
    return null;
  }

  const yearRaw = field(entrateRows[0] ?? speseRows[0] ?? {}, [
    "Esercizio finanziario",
    "Esercizio",
    "Anno",
    "anno",
  ]);
  const sourceYear = Number(yearRaw) || new Date().getFullYear() - 1;

  // ponytail: opening cash ≈ 2 months net buffer from yearly flows (no dedicated fondo-cassa column)
  const monthlyBaseIncome = Math.round(entrate / 12);
  let monthlyMaintenance = Math.round(spese / 12);
  if (monthlyBaseIncome - monthlyMaintenance < MIN_MONTHLY_SURPLUS) {
    monthlyMaintenance = Math.max(0, monthlyBaseIncome - MIN_MONTHLY_SURPLUS);
  }
  const openingCash = Math.max(
    0,
    Math.round((entrate - spese) / 6 + monthlyBaseIncome * 2),
  );

  return {
    openingCash,
    openingDebt: 0,
    monthlyBaseIncome,
    monthlyMaintenance,
    sourceYear,
    sourceUrls,
  };
}

/**
 * Stock mutui/prestiti from Conto del Patrimonio (Passivo → DEBITI → DI FINANZIAMENTO).
 * Missing rows → 0 (hydrate must not fail).
 */
export function mapBdapOpeningDebt(patrimonioRows: Record<string, string>[]): number {
  let total = 0;
  for (const row of patrimonioRows) {
    const tipologia = field(row, ["Tipologia Voce"]).toLowerCase();
    const l1 = field(row, ["Codice Voce I livello"]).toLowerCase();
    const l2 = field(row, ["Codice Voce II livello"]).toLowerCase();
    if (tipologia !== "passivo" || l1 !== "debiti") continue;
    if (!l2.includes("di finanziamento")) continue;
    const n = parseNumber(
      field(row, ["Consistenza Finale Patrimonio", "Consistenza Finale"]),
    );
    if (n !== null && n > 0) total += n;
  }
  return Math.round(total);
}

function sumAllNumeric(rows: Record<string, string>[]): number | null {
  let total = 0;
  let hit = false;
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const n = parseNumber(value);
      if (n !== null && Math.abs(n) > 0) {
        total += n;
        hit = true;
      }
    }
  }
  return hit ? total : null;
}

export function mapCupToProjects(
  rows: Record<string, string>[],
  max = 4,
): ComuneProjectSeed[] {
  const scored = rows
    .map((row) => {
      const title = field(row, [
        "NOME_INTERVENTO",
        "Nome Intervento",
        "DESCRIZIONE",
        "Descrizione",
        "titolo",
      ]);
      const cost =
        parseNumber(
          field(row, [
            "COSTO_PROGETTO",
            "Costo progetto",
            "IMPORTO",
            "Importo",
            "FINANZIAMENTO",
          ]),
        ) ?? 0;
      const cup = field(row, ["CUP", "Codice CUP", "cup"]);
      const natura = field(row, ["NATURA", "Natura", "SETTORI", "Settore"]);
      return { title, cost, cup, natura };
    })
    .filter((p) => p.title && p.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, max);

  return scored.map((p, index) => {
    const blob = `${p.title} ${p.natura}`;
    const category = pickCategory(blob);
    const templateId = p.cup
      ? `cup_${p.cup}`
      : `${category}_${index}`;
    return {
      templateId,
      nameIt: p.title.slice(0, 80),
      cost: Math.round(p.cost),
      months: monthsFor(blob),
      slotId: SLOTS[index % SLOTS.length],
      effects: CATEGORY_EFFECTS[category],
      sourceCup: p.cup || undefined,
    };
  });
}

export function filterRowsByIstat(
  rows: Record<string, string>[],
  istatId: string,
): Record<string, string>[] {
  const id = istatId.padStart(6, "0");
  const prov = id.slice(0, 3);
  const com = id.slice(3);
  return rows.filter((row) => {
    const rowProv = field(row, [
      "Codice istat provincia",
      "Codice Istat Provincia",
    ]).replace(/\D/g, "");
    const rowCom = field(row, [
      "Codice istat comune",
      "Codice Istat Comune",
    ]).replace(/\D/g, "");
    if (rowProv && rowCom && rowProv.padStart(3, "0") + rowCom.padStart(3, "0") === id) {
      return true;
    }
    if (rowProv === prov && rowCom.padStart(3, "0") === com) {
      return true;
    }
    for (const [key, value] of Object.entries(row)) {
      const k = key.toLowerCase();
      const digits = value.replace(/\D/g, "");
      if (
        (k.includes("comune") || k.includes("istat") || k.includes("ente")) &&
        digits.padStart(6, "0") === id &&
        digits.length >= 5
      ) {
        return true;
      }
      if (digits.padStart(6, "0") === id && /^\d{5,6}$/.test(digits)) {
        return true;
      }
    }
    return false;
  });
}

/** Prefer OpenCUP; when missing, map BDAP conto-capitale interventi (real impegni). */
export function mapBdapToProjects(
  speseRows: Record<string, string>[],
  max = 4,
): ComuneProjectSeed[] {
  const capitale = speseRows.filter((row) => {
    const titolo = field(row, [
      "Descrizione Titolo Spese",
      "Descrizione Titolo",
      "Titolo",
    ]).toLowerCase();
    return titolo.includes("capitale");
  });
  const scored = capitale
    .map((row) => {
      const intervento = field(row, [
        "Descrizione Intervento",
        "Descrizione Funzione",
        "Descrizione",
      ]);
      const funzione = field(row, ["Descrizione Funzione", "Funzione"]);
      const cost =
        parseNumber(
          field(row, ["Impegno totale", "Impegni", "Importo", "Valore"]),
        ) ?? 0;
      const title = [intervento, funzione].filter(Boolean).join(" — ") || intervento;
      return { title, cost, natura: funzione || intervento };
    })
    .filter((p) => p.title && p.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  // Dedupe identical titles keeping highest cost
  const seen = new Set<string>();
  const unique = scored.filter((p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max);

  return unique.map((p, index) => {
    const blob = `${p.title} ${p.natura}`;
    const category = pickCategory(blob);
    return {
      templateId: `bdap_cap_${index}_${category}`,
      nameIt: p.title.slice(0, 80),
      cost: Math.round(p.cost),
      months: monthsFor(blob),
      slotId: SLOTS[index % SLOTS.length],
      effects: CATEGORY_EFFECTS[category],
    };
  });
}
