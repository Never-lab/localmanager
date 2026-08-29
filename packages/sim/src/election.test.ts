import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./createInitial.js";
import { resolveElection } from "./election.js";

describe("resolveElection", () => {
  it("wins when average reputation >= rival heat", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    state = {
      ...state,
      month: 48,
      peopleRep: 60,
      politicalRep: 60,
      rival: { ...state.rival, heat: 50 },
    };

    state = resolveElection(state);

    expect(state.status).toBe("won");
  });

  it("loses when average reputation < rival heat", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    state = {
      ...state,
      month: 48,
      peopleRep: 40,
      politicalRep: 40,
      rival: { ...state.rival, heat: 50 },
    };

    state = resolveElection(state);

    expect(state.status).toBe("lost");
  });
});
