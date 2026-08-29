import type { MapSlotId, ProjectTemplateId } from "@localmanager/shared";
import budget from "../../../data/comuni/santa-maria-imbaro/budget.json" with {
  type: "json",
};
import demographics from "../../../data/comuni/santa-maria-imbaro/demographics.json" with {
  type: "json",
};
import meta from "../../../data/comuni/santa-maria-imbaro/meta.json" with {
  type: "json",
};
import projects from "../../../data/comuni/santa-maria-imbaro/projects.json" with {
  type: "json",
};

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

export function loadComune(): ComuneData {
  return {
    meta: meta as ComuneMeta,
    demographics: demographics as Demographics,
    budget: budget as Budget,
    projects: projects as ProjectTemplate[],
  };
}
