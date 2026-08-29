import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogComune, CatalogFile } from "./types.js";

const defaultCatalogPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/comuni/catalog/comuni.json",
);

let cached: CatalogFile | null = null;

export async function loadCatalog(
  path = process.env.COMUNI_CATALOG_PATH ?? defaultCatalogPath,
): Promise<CatalogFile> {
  if (cached && path === defaultCatalogPath) return cached;
  const file = JSON.parse(await readFile(path, "utf8")) as CatalogFile;
  if (path === defaultCatalogPath) cached = file;
  return file;
}

export function searchCatalog(
  catalog: CatalogFile,
  opts: { q?: string; region?: string; province?: string; limit?: number },
): CatalogComune[] {
  const q = opts.q?.trim().toLowerCase() ?? "";
  const region = opts.region?.trim().toLowerCase() ?? "";
  const province = opts.province?.trim().toUpperCase() ?? "";
  const limit = opts.limit ?? 50;
  const out: CatalogComune[] = [];
  for (const c of catalog.comuni) {
    if (region && (c.region ?? "").toLowerCase() !== region) continue;
    if (province && (c.province ?? "").toUpperCase() !== province) continue;
    if (
      q &&
      !c.name.toLowerCase().includes(q) &&
      !c.id.includes(q) &&
      !(c.province ?? "").toLowerCase().includes(q)
    ) {
      continue;
    }
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

export function findComune(
  catalog: CatalogFile,
  istatId: string,
): CatalogComune | undefined {
  const id = istatId.padStart(6, "0");
  return catalog.comuni.find((c) => c.id === id);
}
