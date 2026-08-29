import type { GameState } from "@localmanager/shared";
import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./createInitial.js";
import { firstWinProgress } from "./firstWin.js";

function patchState(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch };
}

describe("firstWinProgress", () => {
  it("starts with only the event step incomplete", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const progress = firstWinProgress(state);

    expect(progress.complete).toBe(false);
    expect(progress.steps.map((step) => [step.id, step.done])).toEqual([
      ["resolve_event", false],
      ["start_project", false],
      ["close_month", false],
    ]);
  });

  it("marks event done when the queue is cleared in month 1", () => {
    const state = patchState(
      createInitialGameState({ mayorName: "Test", seed: 1 }),
      { pendingEvents: [] },
    );
    const progress = firstWinProgress(state);

    expect(progress.steps.find((step) => step.id === "resolve_event")?.done).toBe(
      true,
    );
    expect(progress.complete).toBe(false);
  });

  it("marks project and close steps from active work and month advance", () => {
    const state = patchState(
      createInitialGameState({ mayorName: "Test", seed: 1 }),
      {
        pendingEvents: [],
        month: 2,
        activeProjects: [
          { templateId: "youth_space", monthsRemaining: 3, slotId: "centro" },
        ],
      },
    );
    const progress = firstWinProgress(state);

    expect(progress.complete).toBe(true);
    expect(progress.steps.every((step) => step.done)).toBe(true);
  });
});
