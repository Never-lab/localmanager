import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MapSlotId, ProjectTemplateId } from "@localmanager/shared";

interface ComuneMeta {
  comuneId: "069084";
  name: string;
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
}

const comuneDirectory = new URL(
  "../../../data/comuni/santa-maria-imbaro/",
  import.meta.url,
);

function readJson<T>(filename: string): T {
  const path = fileURLToPath(new URL(filename, comuneDirectory));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadComune(): ComuneData {
  return {
    meta: readJson<ComuneMeta>("meta.json"),
    demographics: readJson<Demographics>("demographics.json"),
    budget: readJson<Budget>("budget.json"),
    projects: readJson<ProjectTemplate[]>("projects.json"),
  };
}
