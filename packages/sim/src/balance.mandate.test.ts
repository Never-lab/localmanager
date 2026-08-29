import { describe, expect, it } from "vitest";
import {
  advanceMonth,
  canCloseMonth,
} from "./advanceMonth.js";
import {
  resolveEvent,
  startProject,
} from "./actions.js";
import { createInitialGameState } from "./createInitial.js";
import { electionForecast } from "./election.js";
import type { GameState } from "@localmanager/shared";

function resolveCheap(state: GameState): GameState {
  let next = state;
  while (next.pendingEvents.length > 0) {
    const event = next.pendingEvents[0]!;
    const choice =
      event.choices.find(
        (candidate) =>
          candidate.requiresCash === undefined ||
          next.cash >= candidate.requiresCash,
      ) ?? event.choices[0]!;
    const result = resolveEvent(next, event.id, choice.id);
    if (!result.ok) break;
    next = result.state;
  }
  return next;
}

function runMandate(
  strategy: (state: GameState) => GameState,
  seed = 42,
): GameState {
  let state = createInitialGameState({ mayorName: "Probe", seed });
  for (let index = 0; index < 48; index += 1) {
    state = strategy(state);
    state = resolveCheap(state);
    if (!canCloseMonth(state)) break;
    state = advanceMonth(state);
    if (state.status !== "playing") break;
  }
  return state;
}

describe("mandate balance P1-A", () => {
  it("idle play loses the election", () => {
    const end = runMandate((state) => state);
    expect(end.status).toBe("lost");
    expect(electionForecast(end).margin).toBeLessThan(0);
  });

  it("building the full project catalog can win", () => {
    const end = runMandate((state) => {
      let next = state;
      for (const project of next.comune.projects) {
        if (
          next.activeProjects.some(
            (active) => active.templateId === project.templateId,
          ) ||
          next.completedProjects.some(
            (done) => done.templateId === project.templateId,
          )
        ) {
          continue;
        }
        const result = startProject(next, project.templateId);
        if (result.ok) next = result.state;
      }
      return next;
    });
    expect(end.status).toBe("won");
    expect(end.completedProjects).toHaveLength(3);
  });
});
