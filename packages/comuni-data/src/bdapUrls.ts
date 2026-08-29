/**
 * Resolve BDAP Open Data dump URLs for a region via SpodCkanApi.
 * Datasets are yearly per-region (latest typically 2015 for pre-armonizzazione dumps).
 */

const CKAN_SEARCH =
  process.env.COMUNI_BDAP_CKAN_SEARCH_URL ??
  "https://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/action/package_search";

export interface BdapDumpUrls {
  entrateUrl: string;
  speseUrl: string;
  year: number;
}

export interface BdapPatrimonioDump {
  patrimonioUrl: string;
  year: number;
}

function httpsDump(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

function yearFromTitle(title: string): number {
  const m = title.match(/^(\d{4})\b/);
  return m ? Number(m[1]) : 0;
}

function regionMatches(title: string, region: string): boolean {
  const t = title.toLowerCase();
  const r = region.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.includes(r)) return true;
  // Catalog vs CKAN naming quirks
  const aliases: Record<string, string[]> = {
    "valle d'aosta/vallée d'aoste": ["valle d'aosta", "valle d aosta"],
    "trentino-alto adige/südtirol": ["trentino-alto adige", "trentino"],
    "friuli-venezia giulia": ["friuli-venezia giulia", "friuli venezia giulia"],
  };
  for (const [canon, list] of Object.entries(aliases)) {
    if (r === canon || list.some((a) => r.includes(a))) {
      return list.some((a) => t.includes(a)) || t.includes(canon);
    }
  }
  return false;
}

async function searchPackages(
  q: string,
  fetchImpl: typeof fetch,
): Promise<
  Array<{ title: string; id: string; resources: Array<{ format?: string; url?: string }> }>
> {
  const url = `${CKAN_SEARCH}?${new URLSearchParams({ q, rows: "50" })}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`CKAN search fallita (${res.status})`);
  const body = (await res.json()) as {
    success?: boolean;
    result?: {
      results?: Array<{
        title?: string;
        id?: string;
        resources?: Array<{ format?: string; url?: string }>;
      }>;
    };
  };
  return (body.result?.results ?? [])
    .filter((r) => r.title && r.id)
    .map((r) => ({
      title: r.title!,
      id: r.id!,
      resources: r.resources ?? [],
    }));
}

function dumpUrlFromPackage(pkg: {
  id: string;
  resources: Array<{ format?: string; url?: string }>;
}): string | null {
  const fromResource = pkg.resources.find(
    (r) =>
      (r.url ?? "").includes("/datastore/dump/") ||
      (r.format ?? "").toLowerCase() === "csv",
  )?.url;
  if (fromResource?.includes("/datastore/dump/")) {
    return httpsDump(fromResource);
  }
  return httpsDump(
    `https://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/3/datastore/dump/${pkg.id}.csv`,
  );
}

export async function resolveBdapDumpUrls(
  region: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<BdapDumpUrls | null> {
  if (!region.trim()) return null;
  const fetchImpl = options.fetchImpl ?? fetch;

  const [entratePkgs, spesePkgs] = await Promise.all([
    searchPackages(
      `Gestione finanziaria Entrate Enti Locali ${region}`,
      fetchImpl,
    ),
    searchPackages(
      `Gestione finanziaria Spese Enti Locali ${region}`,
      fetchImpl,
    ),
  ]);

  const pick = (
    pkgs: Array<{ title: string; id: string; resources: Array<{ format?: string; url?: string }> }>,
    kind: "Entrate" | "Spese",
  ) => {
    const matched = pkgs
      .filter(
        (p) =>
          regionMatches(p.title, region) &&
          p.title.includes(kind) &&
          p.title.includes("Gestione finanziaria"),
      )
      .sort((a, b) => yearFromTitle(b.title) - yearFromTitle(a.title));
    return matched[0] ?? null;
  };

  const entrate = pick(entratePkgs, "Entrate");
  const spese = pick(spesePkgs, "Spese");
  if (!entrate || !spese) return null;

  const entrateUrl = dumpUrlFromPackage(entrate);
  const speseUrl = dumpUrlFromPackage(spese);
  if (!entrateUrl || !speseUrl) return null;

  return {
    entrateUrl,
    speseUrl,
    year: Math.max(yearFromTitle(entrate.title), yearFromTitle(spese.title)),
  };
}

/** National Conto del Patrimonio dump (latest year). */
export async function resolveBdapPatrimonioDumpUrl(
  options: { fetchImpl?: typeof fetch } = {},
): Promise<BdapPatrimonioDump | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pkgs = await searchPackages(
    "Gestione Patrimoniale Conto del Patrimonio Enti Locali",
    fetchImpl,
  );
  const matched = pkgs
    .filter((p) =>
      p.title.includes("Gestione Patrimoniale Conto del Patrimonio Enti Locali"),
    )
    .sort((a, b) => yearFromTitle(b.title) - yearFromTitle(a.title));
  const pkg = matched[0];
  if (!pkg) return null;
  const patrimonioUrl = dumpUrlFromPackage(pkg);
  if (!patrimonioUrl) return null;
  return { patrimonioUrl, year: yearFromTitle(pkg.title) };
}
