import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import {
  MEAN_AGE_MONTHLY_DRIFT,
  RIVAL_HEAT_GAIN,
  STAFF_COSTS,
} from "./config.js";
import { createInitialGameState } from "./createInitial.js";
import { loadComune } from "./loadComune.js";

describe("advanceMonth", () => {
  it("increments month and applies income, maintenance, and staff costs", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const before = state.cash;
    const { budget } = loadComune();

    state = advanceMonth(state);

    expect(state.month).toBe(2);
    expect(state.cash).toBe(
      before +
        budget.monthlyBaseIncome -
        budget.monthlyMaintenance -
        STAFF_COSTS.secretary,
    );
  });

  it("sets overlay.dirty when a project completes", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    state = {
      ...state,
      cash: 1_000_000,
      activeProjects: [
        { templateId: "youth_space", monthsRemaining: 1, slotId: "centro" },
      ],
    };

    state = advanceMonth(state);

    expect(state.completedProjects.some((project) => project.slotId === "centro")).toBe(true);
    expect(state.overlay.dirty).toBe(true);
    expect(state.overlay.activeSlots).toContain("centro");
  });

  it("runs rival move on month 6", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const initialHeat = state.rival.heat;

    for (let index = 0; index < 5; index += 1) {
      state = advanceMonth(state);
    }

    expect(state.month).toBe(6);
    expect(state.rival.heat).toBe(initialHeat + RIVAL_HEAT_GAIN);
    expect(state.rival.pendingEvent).not.toBeNull();
  });

  it("resolves a pending province request", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const requestedAmount = 25_000;

    const nextState = advanceMonth({
      ...state,
      provinceRequest: { amount: requestedAmount, resolveMonth: 2 },
    });

    expect(nextState.provinceRequest).toBeNull();
    expect(nextState.cash).toBe(
      state.cash +
        loadComune().budget.monthlyBaseIncome -
        loadComune().budget.monthlyMaintenance -
        STAFF_COSTS.secretary +
        requestedAmount,
    );
    expect(nextState.log).toContainEqual({
      month: 2,
      textIt: `La Provincia ha approvato un contributo di €${requestedAmount}.`,
    });
  });

  it("applies demographic drift each month", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const nextState = advanceMonth(state);

    expect(nextState.meanAge).toBe(state.meanAge + MEAN_AGE_MONTHLY_DRIFT);
  });

  it("appends the Italian monthly close log", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const nextState = advanceMonth(state);

    expect(nextState.log.at(-1)).toEqual({
      month: 2,
      textIt: "Chiuso il mese 2: aggiornati bilancio e servizi comunali.",
    });
  });

  it("returns a won state unchanged", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      status: "won" as const,
    };

    expect(advanceMonth(state)).toBe(state);
  });

  it("resolves the election at month 48 without advancing to 49", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      month: 47,
    };

    const nextState = advanceMonth(state);

    expect(nextState.month).toBe(48);
    expect(nextState.status).not.toBe("playing");
    expect(advanceMonth(nextState)).toBe(nextState);
  });
});
