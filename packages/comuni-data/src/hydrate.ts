import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findComune, loadCatalog } from "./catalog.js";
import { parseCsv, rowsToObjects } from "./csv.js";
import {
  filterRowsByIstat,
  mapBdapToBudget,
  mapCupToProjects,
} from "./mapSeed.js";
import type { CatalogComune, ComuneSeed, HydrateResult } from "./types.js";

export interface HydrateOptions {
  cacheDir: string;
  bulkDir: string;
  /** Optional pre-filtered seed JSON for tests / offline. */
  fixtureDir?: string;
  entrateUrl?: string;
  speseUrl?: string;
  cupUrl?: string;
  fetchImpl?: typeof fetch;
  onStatus?: (status: HydrateResult["status"]) => void;
}

const DEFAULT_ENTRATE =
  process.env.COMUNI_BDAP_ENTRATE_URL ??
  "https://bdap-opendata.rgs.mef.gov.it/download/entrate-enti-locali.csv";
const DEFAULT_SPESE =
  process.env.COMUNI_BDAP_SPESE_URL ??
  "https://bdap-opendata.rgs.mef.gov.it/download/spese-enti-locali.csv";
const DEFAULT_CUP =
  process.env.COMUNI_CUP_URL ??
  "https://www.opencup.gov.it/portale/documents/d/guest/progetti_open.csv";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Download URL to dest if missing. Supports plain CSV bodies. */
export async function downloadIfMissing(
  url: string,
  destPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"cached" | "downloaded"> {
  if (await exists(destPath)) return "cached";
  await mkdir(join(destPath, ".."), { recursive: true });
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download fallito (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = `${destPath}.part`;
  await writeFile(tmp, buf);
  await rename(tmp, destPath);
  return "downloaded";
}

async function loadCsvObjects(path: string): Promise<Record<string, string>[]> {
  const text = await readFile(path, "utf8");
  const sep = text.includes(";") ? ";" : ",";
  return rowsToObjects(parseCsv(text, sep));
}

async function tryFixture(
  fixtureDir: string,
  istatId: string,
): Promise<ComuneSeed | null> {
  const path = join(fixtureDir, `${istatId}.json`);
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf8")) as ComuneSeed;
}

function meanAgeFallback(population: number): number {
  // ponytail: BDAP rarely ships mean age; use national-ish default until a demo source exists
  void population;
  return 45;
}

export async function hydrateComune(
  istatId: string,
  options: HydrateOptions,
): Promise<HydrateResult> {
  const id = istatId.padStart(6, "0");
  const fetchImpl = options.fetchImpl ?? fetch;
  const notify = (status: HydrateResult["status"]) => options.onStatus?.(status);

  try {
    if (options.fixtureDir) {
      const seeded = await tryFixture(options.fixtureDir, id);
      if (seeded) {
        notify("ready");
        return { status: "ready", seed: seeded };
      }
    }

    const catalog = await loadCatalog();
    const meta = findComune(catalog, id);
    if (!meta) {
      return {
        status: "failed",
        errorIt: "Comune non trovato nel catalogo ISTAT.",
      };
    }

    const diskCache = join(options.cacheDir, `${id}.json`);
    if (await exists(diskCache)) {
      const seed = JSON.parse(await readFile(diskCache, "utf8")) as ComuneSeed;
      notify("ready");
      return { status: "ready", seed };
    }

    notify("downloading");
    await mkdir(options.bulkDir, { recursive: true });
    const entratePath = join(options.bulkDir, "bdap-entrate.csv");
    const spesePath = join(options.bulkDir, "bdap-spese.csv");
    const cupPath = join(options.bulkDir, "opencup-progetti.csv");

    const entrateUrl = options.entrateUrl ?? DEFAULT_ENTRATE;
    const speseUrl = options.speseUrl ?? DEFAULT_SPESE;
    const cupUrl = options.cupUrl ?? DEFAULT_CUP;

    try {
      await downloadIfMissing(entrateUrl, entratePath, fetchImpl);
      await downloadIfMissing(speseUrl, spesePath, fetchImpl);
      await downloadIfMissing(cupUrl, cupPath, fetchImpl);
    } catch (error) {
      return {
        status: "failed",
        errorIt:
          error instanceof Error
            ? `Download open data fallito: ${error.message}. Riprova o scegli un altro comune.`
            : "Download open data fallito. Riprova.",
      };
    }

    notify("filtering");
    const entrateAll = await loadCsvObjects(entratePath);
    const speseAll = await loadCsvObjects(spesePath);
    const cupAll = await loadCsvObjects(cupPath);
    const entrate = filterRowsByIstat(entrateAll, id);
    const spese = filterRowsByIstat(speseAll, id);
    const cup = filterRowsByIstat(cupAll, id);

    notify("mapping");
    const budget = mapBdapToBudget(entrate, spese, [entrateUrl, speseUrl]);
    if (!budget) {
      return {
        status: "failed",
        errorIt:
          "Bilancio BDAP non disponibile o incompleto per questo comune. Scegline un altro o riprova più tardi.",
      };
    }
    const projects = mapCupToProjects(cup, 4);
    if (projects.length === 0) {
      return {
        status: "failed",
        errorIt:
          "Nessun progetto OpenCUP utilizzabile per questo comune. Scegline un altro o riprova più tardi.",
      };
    }

    const population =
      inferPopulation(entrate, spese) ??
      inferPopulation(cup) ??
      0;
    if (population <= 0) {
      return {
        status: "failed",
        errorIt:
          "Popolazione non ricavabile dai dati aperti per questo comune.",
      };
    }

    const seed = buildSeed(meta, budget, projects, population, [
      entrateUrl,
      speseUrl,
      cupUrl,
      catalog.source,
    ]);

    await mkdir(options.cacheDir, { recursive: true });
    await writeFile(
      join(options.cacheDir, `${id}.json`),
      JSON.stringify(seed, null, 0),
      "utf8",
    );

    notify("ready");
    return { status: "ready", seed };
  } catch (error) {
    return {
      status: "failed",
      errorIt:
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il caricamento dati.",
    };
  }
}

function inferPopulation(
  ...groups: Record<string, string>[][]
): number | null {
  for (const rows of groups) {
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (!/popol/i.test(key)) continue;
        const n = Number(value.replace(/\D/g, ""));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return null;
}

function buildSeed(
  meta: CatalogComune,
  budget: ComuneSeed["budget"],
  projects: ComuneSeed["projects"],
  population: number,
  sources: string[],
): ComuneSeed {
  return {
    comuneId: meta.id,
    name: meta.name,
    province: meta.province,
    region: meta.region,
    population,
    meanAge: meanAgeFallback(population),
    budget,
    projects,
    fetchedAt: new Date().toISOString(),
    sources,
  };
}

/** Build seed from already-filtered row objects (unit tests / local extracts). */
export function buildSeedFromRows(
  meta: CatalogComune,
  entrate: Record<string, string>[],
  spese: Record<string, string>[],
  cup: Record<string, string>[],
  sourceUrls: string[],
): HydrateResult {
  const budget = mapBdapToBudget(entrate, spese, sourceUrls);
  if (!budget) {
    return {
      status: "failed",
      errorIt: "Bilancio BDAP non disponibile o incompleto per questo comune.",
    };
  }
  const projects = mapCupToProjects(cup, 4);
  if (!projects.length) {
    return {
      status: "failed",
      errorIt: "Nessun progetto OpenCUP utilizzabile per questo comune.",
    };
  }
  const population = inferPopulation(entrate, spese, cup);
  if (!population) {
    return {
      status: "failed",
      errorIt: "Popolazione non ricavabile dai dati aperti per questo comune.",
    };
  }
  return {
    status: "ready",
    seed: buildSeed(meta, budget, projects, population, sourceUrls),
  };
}
