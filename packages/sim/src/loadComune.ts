import type { MapGeo, MapSlotId, ProjectTemplateId } from "@localmanager/shared";
import budget from "../../../data/comuni/santa-maria-imbaro/budget.json" with {
  type: "json",
};
import demographics from "../../../data/comuni/santa-maria-imbaro/demographics.json" with {
  type: "json",
};
import meta from "../../../data/comuni/santa-maria-imbaro/meta.json" with {
  type: "json",
};
import slots from "../../../data/comuni/santa-maria-imbaro/map/slots.json" with {
  type: "json",
};
import projects from "../../../data/comuni/santa-maria-imbaro/projects.json" with {
  type: "json",
};

interface ComuneMeta {
  comuneId: string;
  name: string;
  province?: string;
  region?: string;
  osmQuery?: string;
  center?: { lat: number; lon: number };
  basemapRevision?: string;
}

interface Demographics {
  population: number;
  meanAge: number;
}

interface Budget {
  openingCash: number;
  monthlyBaseIncome: number;
  monthlyMaintenance: number;
}

export interface ProjectTemplate {
  templateId: ProjectTemplateId;
  nameIt: string;
  cost: number;
  months: number;
  slotId: MapSlotId;
  effects: {
    population: number;
    meanAge: number;
    peopleRep: number;
    politicalRep: number;
  };
}

export interface ComuneData {
  meta: ComuneMeta;
  demographics: Demographics;
  budget: Budget;
  projects: ProjectTemplate[];
  map: MapGeo;
}

/** Costruisce MapGeo dal seed SMI (meta + slots.json). */
function buildFixtureMap(m: ComuneMeta): MapGeo {
  const center = m.center ?? { lat: 42.2167, lon: 14.45 };
  const slotRows = (
    slots as {
      slots: Array<{
        id: MapSlotId;
        labelIt: string;
        offset: [number, number];
        radiusM: number;
      }>;
    }
  ).slots;
  return {
    osmQuery: m.osmQuery ?? `${m.name}, Italy`,
    center,
    radiusM: 1200,
    basemapRevision: m.basemapRevision ?? "2026-08-29",
    mapSlots: slotRows.map((s) => ({
      id: s.id,
      labelIt: s.labelIt,
      lon: center.lon + s.offset[0],
      lat: center.lat + s.offset[1],
      radiusM: s.radiusM,
    })),
  };
}

/** Default fixture for sim unit tests only — not a claim of real bilancio. */
export function loadComune(): ComuneData {
  const typedMeta = meta as ComuneMeta;
  return {
    meta: typedMeta,
    demographics: demographics as Demographics,
    budget: budget as Budget,
    projects: projects as ProjectTemplate[],
    map: buildFixtureMap(typedMeta),
  };
}
