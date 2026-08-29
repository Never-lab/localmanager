import type { GameState, NewGameOptions, StaffRole } from "@localmanager/shared";
import {
  INITIAL_PEOPLE_REP,
  INITIAL_POLITICAL_REP,
  INITIAL_RIVAL_HEAT,
  MANDATE_MONTHS,
  STAFF_COSTS,
} from "./config.js";
import { drawMonthlyEvent } from "./events.js";
import { loadComune } from "./loadComune.js";

const STAFF_ROLES: StaffRole[] = ["secretary", "technician", "communicator"];

export function createInitialGameState(options: NewGameOptions): GameState {
  const fixture = loadComune();
  const seeded = options.comuneSeed;
  const drawn = drawMonthlyEvent(options.seed ?? Date.now(), false);

  const comuneId = seeded?.comuneId ?? fixture.meta.comuneId;
  const comuneName = seeded?.name ?? fixture.meta.name;
  const projects = seeded?.projects ?? fixture.projects;
  const monthlyBaseIncome =
    seeded?.monthlyBaseIncome ?? fixture.budget.monthlyBaseIncome;
  const monthlyMaintenance =
    seeded?.monthlyMaintenance ?? fixture.budget.monthlyMaintenance;

  return {
    comuneId,
    comuneName,
    mayorName: options.mayorName,
    month: 1,
    mandateMonths: MANDATE_MONTHS,
    cash: seeded?.openingCash ?? fixture.budget.openingCash,
    population: seeded?.population ?? fixture.demographics.population,
    meanAge: seeded?.meanAge ?? fixture.demographics.meanAge,
    peopleRep: INITIAL_PEOPLE_REP,
    politicalRep: INITIAL_POLITICAL_REP,
    staff: STAFF_ROLES.map((role) => ({
      role,
      hired: role === "secretary",
      monthlyCost: STAFF_COSTS[role],
    })),
    activeProjects: [],
    completedProjects: [],
    provinceRequest: null,
    pendingEvents: [drawn.event],
    rival: {
      heat: INITIAL_RIVAL_HEAT,
      lastMoveMonth: null,
    },
    overlay: {
      activeSlots: [],
      dirty: false,
      mapVersion: 0,
    },
    log: [],
    status: "playing",
    seed: drawn.seed,
    comune: {
      comuneId,
      name: comuneName,
      province: seeded?.province ?? fixture.meta.province ?? null,
      region: seeded?.region ?? fixture.meta.region ?? null,
      monthlyBaseIncome,
      monthlyMaintenance,
      projects,
      sourceYear: seeded?.sourceYear ?? null,
      sources: seeded?.sources ?? ["data/comuni/santa-maria-imbaro"],
      map: seeded?.map ?? fixture.map,
    },
  };
}
