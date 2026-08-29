import type {
  ActiveProject,
  CompletedProject,
  GameState,
  LogEntry,
} from "@localmanager/shared";
import {
  CLAMP,
  MEAN_AGE_MONTHLY_DRIFT,
  POPULATION_NOISE_RANGE,
  PROVINCE_SUCCESS_CHANCE,
  RIVAL_HEAT_GAIN,
  RIVAL_INTERVAL_MONTHS,
} from "./config.js";
import { resolveElection } from "./election.js";
import { drawMonthlyEvent } from "./events.js";
import { loadComune } from "./loadComune.js";
import { nextRandom } from "./rng.js";

const comune = loadComune();

export function canCloseMonth(state: GameState): boolean {
  return state.status === "playing" && state.pendingEvents.length === 0;
}

export function advanceMonth(state: GameState): GameState {
  if (state.status !== "playing") {
    return state;
  }

  const month = state.month + 1;
  if (month > state.mandateMonths) {
    return state;
  }

  const staffCosts = state.staff
    .filter((member) => member.hired)
    .reduce((total, member) => total + member.monthlyCost, 0);
  let cash =
    state.cash +
    comune.budget.monthlyBaseIncome -
    comune.budget.monthlyMaintenance -
    staffCosts;
  let population = state.population;
  let meanAge = state.meanAge;
  let peopleRep = state.peopleRep;
  let politicalRep = state.politicalRep;
  let seed = state.seed;
  let provinceRequest = state.provinceRequest;
  const log: LogEntry[] = [...state.log];
  const activeProjects: ActiveProject[] = [];
  const completedProjects: CompletedProject[] = [...state.completedProjects];
  const activeSlots = [...state.overlay.activeSlots];
  let overlayDirty = state.overlay.dirty;
  let pendingEvents = [...state.pendingEvents];

  for (const project of state.activeProjects) {
    const monthsRemaining = project.monthsRemaining - 1;
    if (monthsRemaining > 0) {
      activeProjects.push({ ...project, monthsRemaining });
      continue;
    }

    const template = comune.projects.find(
      (candidate) => candidate.templateId === project.templateId,
    );
    if (!template) {
      throw new Error(`Progetto sconosciuto: ${project.templateId}`);
    }

    completedProjects.push({
      templateId: project.templateId,
      slotId: project.slotId,
      completedMonth: month,
    });
    if (!activeSlots.includes(project.slotId)) {
      activeSlots.push(project.slotId);
    }
    overlayDirty = true;
    population += template.effects.population;
    meanAge += template.effects.meanAge;
    peopleRep = CLAMP(peopleRep + template.effects.peopleRep);
    politicalRep = CLAMP(politicalRep + template.effects.politicalRep);
  }

  if (provinceRequest?.resolveMonth === month) {
    const fundingRoll = nextRandom(seed);
    seed = fundingRoll.seed;
    if (fundingRoll.value < PROVINCE_SUCCESS_CHANCE) {
      cash += provinceRequest.amount;
      log.push({
        month,
        textIt: `La Provincia ha approvato un contributo di €${provinceRequest.amount}.`,
      });
    } else {
      log.push({
        month,
        textIt: "La Provincia ha respinto la richiesta di finanziamento.",
      });
    }
    provinceRequest = null;
  }

  const populationRoll = nextRandom(seed);
  seed = populationRoll.seed;
  const populationNoise =
    Math.floor(
      populationRoll.value * (POPULATION_NOISE_RANGE * 2 + 1),
    ) - POPULATION_NOISE_RANGE;
  population += populationNoise;
  meanAge += MEAN_AGE_MONTHLY_DRIFT;

  const rivalMove = month % RIVAL_INTERVAL_MONTHS === 0;
  const rival = rivalMove
    ? {
        heat: CLAMP(state.rival.heat + RIVAL_HEAT_GAIN),
        lastMoveMonth: month,
      }
    : state.rival;

  if (pendingEvents.length === 0) {
    const drawn = drawMonthlyEvent(seed, rivalMove);
    pendingEvents = [drawn.event];
    seed = drawn.seed;
  }

  log.push({
    month,
    textIt: `Chiuso il mese ${month}: aggiornati bilancio e servizi comunali.`,
  });

  const nextState: GameState = {
    ...state,
    month,
    cash,
    population,
    meanAge,
    peopleRep,
    politicalRep,
    activeProjects,
    completedProjects,
    provinceRequest,
    pendingEvents,
    rival,
    overlay: {
      ...state.overlay,
      activeSlots,
      dirty: overlayDirty,
    },
    log,
    seed,
  };

  return month >= state.mandateMonths
    ? resolveElection(nextState)
    : nextState;
}
