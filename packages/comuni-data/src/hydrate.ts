import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MapGeo } from "@localmanager/shared";
import { resolveBdapDumpUrls } from "./bdapUrls.js";
import { findComune, loadCatalog } from "./catalog.js";
import { parseCsv, rowsToObjects } from "./csv.js";
import {
  filterRowsByIstat,
  mapBdapToBudget,
  mapBdapToProjects,
  mapCupToProjects,
} from "./mapSeed.js";
import { resolveComuneGeo } from "./nominatim.js";
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
  nominatimUrl?: string;
  basemapRevision?: string;
  onStatus?: (status: HydrateResult["status"]) => void;
}

/** Optional; OpenCUP national dumps are hundreds of MB — prefer bulk file or BDAP capitale. */
const DEFAULT_CUP = process.env.COMUNI_CUP_URL;

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
  const buf = await readFile(path);
  // BDAP dumps are often latin-1; UTF-8 fixtures stay valid as latin-1 round-trip for ASCII headers
  const text = buf.toString("latin1");
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

function hasMap(seed: ComuneSeed): seed is ComuneSeed & { map: MapGeo } {
  return Boolean(seed.map?.osmQuery && seed.map?.center);
}

async function ensureSeedMap(
  seed: ComuneSeed,
  meta: CatalogComune,
  options: HydrateOptions,
): Promise<HydrateResult> {
  if (hasMap(seed)) {
    return { status: "ready", seed };
  }
  const geo = await resolveComuneGeo(meta, {
    fetchImpl: options.fetchImpl,
    nominatimUrl: options.nominatimUrl,
    basemapRevision: options.basemapRevision,
  });
  if ("errorIt" in geo) {
    return { status: "failed", errorIt: geo.errorIt };
  }
  return { status: "ready", seed: { ...seed, map: geo } };
}

function regionSlug(region: string): string {
  return region
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
        const catalog = await loadCatalog();
        const meta = findComune(catalog, id) ?? {
          id,
          name: seeded.name,
          province: seeded.province,
          provinceName: null,
          region: seeded.region,
        };
        const withMap = await ensureSeedMap(seeded, meta, options);
        if (withMap.status === "ready") notify("ready");
        return withMap;
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
      const withMap = await ensureSeedMap(seed, meta, options);
      if (withMap.status === "ready") {
        if (!hasMap(seed) && withMap.seed) {
          await writeFile(diskCache, JSON.stringify(withMap.seed, null, 0), "utf8");
        }
        notify("ready");
      }
      return withMap;
    }

    notify("downloading");
    await mkdir(options.bulkDir, { recursive: true });

    const slug = regionSlug(meta.region ?? "italia");
    let entrateUrl = options.entrateUrl;
    let speseUrl = options.speseUrl;
    if (!entrateUrl || !speseUrl) {
      const resolved = await resolveBdapDumpUrls(meta.region ?? "", {
        fetchImpl,
      });
      if (!resolved) {
        return {
          status: "failed",
          errorIt:
            "Dataset BDAP non trovato per questa regione. Riprova o scegli un altro comune.",
        };
      }
      entrateUrl = entrateUrl ?? resolved.entrateUrl;
      speseUrl = speseUrl ?? resolved.speseUrl;
    }

    const entratePath = join(options.bulkDir, `bdap-entrate-${slug}.csv`);
    const spesePath = join(options.bulkDir, `bdap-spese-${slug}.csv`);
    const cupPath = join(options.bulkDir, "opencup-progetti.csv");
    const cupUrl = options.cupUrl ?? DEFAULT_CUP;

    try {
      await downloadIfMissing(entrateUrl, entratePath, fetchImpl);
      await downloadIfMissing(speseUrl, spesePath, fetchImpl);
      if (cupUrl) {
        await downloadIfMissing(cupUrl, cupPath, fetchImpl);
      }
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
    const entrate = filterRowsByIstat(entrateAll, id);
    const spese = filterRowsByIstat(speseAll, id);

    let cup: Record<string, string>[] = [];
    if (await exists(cupPath)) {
      cup = filterRowsByIstat(await loadCsvObjects(cupPath), id);
    }

    notify("mapping");
    const budget = mapBdapToBudget(entrate, spese, [entrateUrl, speseUrl]);
    if (!budget) {
      return {
        status: "failed",
        errorIt:
          "Bilancio BDAP non disponibile o incompleto per questo comune. Scegline un altro o riprova più tardi.",
      };
    }
    const cupProjects = mapCupToProjects(cup, 4);
    const projects =
      cupProjects.length > 0 ? cupProjects : mapBdapToProjects(spese, 4);
    if (projects.length === 0) {
      return {
        status: "failed",
        errorIt:
          "Nessun progetto utilizzabile (OpenCUP o spese in conto capitale BDAP) per questo comune. Scegline un altro o riprova più tardi.",
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

    const geo = await resolveComuneGeo(meta, {
      fetchImpl,
      nominatimUrl: options.nominatimUrl,
      basemapRevision: options.basemapRevision,
    });
    if ("errorIt" in geo) {
      return { status: "failed", errorIt: geo.errorIt };
    }

    const sources = [entrateUrl, speseUrl, catalog.source];
    if (cupUrl) sources.splice(2, 0, cupUrl);

    const seed = buildSeed(
      meta,
      budget,
      projects,
      population,
      sources,
      geo,
    );

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
        const parsed = parseFloat(value.replace(",", "."));
        if (Number.isFinite(parsed) && parsed > 0 && parsed < 10_000_000) {
          return Math.round(parsed);
        }
        const n = Number(value.replace(/\D/g, ""));
        if (Number.isFinite(n) && n > 0 && n < 10_000_000) return n;
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
  map: MapGeo,
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
    map,
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
  map: MapGeo,
): HydrateResult {
  const budget = mapBdapToBudget(entrate, spese, sourceUrls);
  if (!budget) {
    return {
      status: "failed",
      errorIt: "Bilancio BDAP non disponibile o incompleto per questo comune.",
    };
  }
  const cupProjects = mapCupToProjects(cup, 4);
  const projects =
    cupProjects.length > 0 ? cupProjects : mapBdapToProjects(spese, 4);
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
    seed: buildSeed(meta, budget, projects, population, sourceUrls, map),
  };
}
