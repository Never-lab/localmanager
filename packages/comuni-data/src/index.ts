export type { CatalogComune, CatalogFile, ComuneSeed, HydrateResult, HydrateStatus, ComuneBudgetSeed, ComuneProjectSeed } from "./types.js";
export { loadCatalog, searchCatalog, findComune } from "./catalog.js";
export { parseCsv, rowsToObjects, parseNumber } from "./csv.js";
export {
  mapBdapToBudget,
  mapCupToProjects,
  filterRowsByIstat,
} from "./mapSeed.js";
export {
  hydrateComune,
  downloadIfMissing,
  buildSeedFromRows,
  type HydrateOptions,
} from "./hydrate.js";
export { buildDefaultMapSlots } from "./mapSlots.js";
export { resolveComuneGeo } from "./nominatim.js";
