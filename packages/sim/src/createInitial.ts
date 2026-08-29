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
  const comune = loadComune();
  const drawn = drawMonthlyEvent(options.seed ?? Date.now(), false);

  return {
    comuneId: comune.meta.comuneId,
    mayorName: options.mayorName,
    month: 1,
    mandateMonths: MANDATE_MONTHS,
    cash: comune.budget.openingCash,
    population: comune.demographics.population,
    meanAge: comune.demographics.meanAge,
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
  };
}
