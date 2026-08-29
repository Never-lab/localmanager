/**
 * Build data/comuni/catalog/comuni.json from ISTAT Elenco comuni CSV.
 * Usage: node scripts/build-istat-catalog.mjs [path-to-csv]
 * Default CSV: %TEMP%/istat-comuni.csv or downloads from ISTAT.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "data/comuni/catalog/comuni.json");
const ISTAT_URL =
  "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ";") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((x) => x.trim())) rows.push(row);
  }
  return rows;
}

function norm(header) {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

async function loadCsv(pathOrUrl) {
  if (pathOrUrl.startsWith("http")) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) throw new Error(`ISTAT download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString("utf8");
  }
  return readFile(pathOrUrl, "utf8");
}

const arg = process.argv[2];
const csvPath =
  arg ??
  join(process.env.TEMP || "/tmp", "istat-comuni.csv");

let text;
try {
  text = await loadCsv(csvPath);
} catch {
  console.log("Local CSV missing, downloading from ISTAT…");
  text = await loadCsv(ISTAT_URL);
  await writeFile(csvPath, text);
}

const rows = parseCsv(text);
const headers = rows[0].map(norm);
const idx = (candidates) => {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
};

const iId = idx(["codice comune formato alfanumerico", "codice comune"]);
const iName = idx(["denominazione in italiano", "denominazione (italiana"]);
const iProv = idx(["sigla automobilistica"]);
const iRegion = idx(["denominazione regione"]);
const iProvName = idx(["denominazione dell'unità territoriale", "denominazione unità"]);

if (iId < 0 || iName < 0) {
  console.error("headers", headers);
  throw new Error("Could not find ISTAT id/name columns");
}

const comuni = [];
for (const row of rows.slice(1)) {
  const id = (row[iId] ?? "").trim().padStart(6, "0");
  const name = (row[iName] ?? "").trim();
  if (!/^\d{6}$/.test(id) || !name) continue;
  comuni.push({
    id,
    name,
    province: (row[iProv] ?? "").trim() || null,
    provinceName: iProvName >= 0 ? (row[iProvName] ?? "").trim() || null : null,
    region: iRegion >= 0 ? (row[iRegion] ?? "").trim() || null : null,
  });
}

comuni.sort((a, b) => a.name.localeCompare(b.name, "it"));
await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      source: ISTAT_URL,
      snapshotDate: new Date().toISOString().slice(0, 10),
      count: comuni.length,
      comuni,
    },
    null,
    0,
  ),
);
console.log(`Wrote ${comuni.length} comuni → ${outPath}`);
