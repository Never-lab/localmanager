import type { MapGeo } from "@localmanager/shared";
import type { CatalogComune } from "./types.js";
import { buildDefaultMapSlots } from "./mapSlots.js";

const NOMINATIM =
  process.env.COMUNI_NOMINATIM_URL ??
  "https://nominatim.openstreetmap.org/search";

export interface NominatimOptions {
  fetchImpl?: typeof fetch;
  nominatimUrl?: string;
  /** Override revision stamp (tests). */
  basemapRevision?: string;
}

function buildOsmQuery(meta: CatalogComune): string {
  const parts = [
    meta.name,
    meta.provinceName ?? meta.province,
    meta.region,
    "Italy",
  ].filter(Boolean);
  return parts.join(", ");
}

function radiusFromBbox(bbox: string[] | undefined): number {
  if (!bbox || bbox.length < 4) return 1500;
  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  if (![south, north, west, east].every(Number.isFinite)) return 1500;
  const latM = Math.abs(north - south) * 111_320;
  const lonM =
    Math.abs(east - west) *
    111_320 *
    Math.cos((((north + south) / 2) * Math.PI) / 180);
  const half = Math.max(latM, lonM) / 2;
  return Math.round(Math.min(5000, Math.max(800, half)));
}

/** Risolve centro/raggio OSM del comune via Nominatim (nessun seed senza geo). */
export async function resolveComuneGeo(
  meta: CatalogComune,
  options: NominatimOptions = {},
): Promise<MapGeo | { errorIt: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const osmQuery = buildOsmQuery(meta);
  const url = new URL(options.nominatimUrl ?? NOMINATIM);
  url.searchParams.set("q", osmQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LocalManager/0.1 (educational; contact: localmanager)",
      },
    });
  } catch {
    return {
      errorIt:
        "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
    };
  }
  if (res.status === 429 || !res.ok) {
    return {
      errorIt:
        "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
    };
  }
  const rows = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    boundingbox?: string[];
  }>;
  const hit = rows[0];
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      errorIt:
        "Geolocalizzazione non disponibile per questo comune. Scegline un altro o riprova.",
    };
  }
  const center = { lat, lon };
  const revision =
    options.basemapRevision ?? new Date().toISOString().slice(0, 10);
  return {
    osmQuery,
    center,
    radiusM: radiusFromBbox(hit.boundingbox),
    basemapRevision: revision,
    mapSlots: buildDefaultMapSlots(center),
  };
}
