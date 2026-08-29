import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import { STAFF_COSTS } from "./config.js";
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

    for (let index = 0; index < 5; index += 1) {
      state = advanceMonth(state);
    }

    expect(state.month).toBe(6);
    expect(state.rival.pendingEvent).not.toBeNull();
  });
});
