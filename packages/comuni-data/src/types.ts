import type { MapSlotId, ProjectTemplateId } from "@localmanager/shared";

export interface CatalogComune {
  id: string;
  name: string;
  province: string | null;
  provinceName: string | null;
  region: string | null;
}

export interface CatalogFile {
  source: string;
  snapshotDate: string;
  count: number;
  comuni: CatalogComune[];
}

export interface ComuneBudgetSeed {
  openingCash: number;
  monthlyBaseIncome: number;
  monthlyMaintenance: number;
  sourceYear: number;
  sourceUrls: string[];
}

export interface ComuneProjectSeed {
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
  sourceCup?: string;
}

export interface ComuneSeed {
  comuneId: string;
  name: string;
  province: string | null;
  region: string | null;
  population: number;
  meanAge: number;
  budget: ComuneBudgetSeed;
  projects: ComuneProjectSeed[];
  fetchedAt: string;
  sources: string[];
}

export type HydrateStatus =
  | "queued"
  | "downloading"
  | "filtering"
  | "mapping"
  | "ready"
  | "failed";

export interface HydrateResult {
  status: HydrateStatus;
  seed?: ComuneSeed;
  errorIt?: string;
}
