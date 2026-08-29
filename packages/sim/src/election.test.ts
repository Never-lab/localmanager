import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./createInitial.js";
import { electionForecast, resolveElection } from "./election.js";

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

describe("electionForecast", () => {
  it("reports ahead when the margin is clearly positive", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      peopleRep: 60,
      politicalRep: 60,
      rival: { heat: 40, lastMoveMonth: null },
    };

    expect(electionForecast(state)).toMatchObject({
      avg: 60,
      rivalHeat: 40,
      margin: 20,
      band: "ahead",
    });
  });

  it("reports toss_up near the election threshold", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      peopleRep: 52,
      politicalRep: 52,
      rival: { heat: 50, lastMoveMonth: null },
    };

    expect(electionForecast(state).band).toBe("toss_up");
  });

  it("reports behind when the margin is clearly negative", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      peopleRep: 40,
      politicalRep: 40,
      rival: { heat: 55, lastMoveMonth: null },
    };

    expect(electionForecast(state).band).toBe("behind");
  });

  it("aligns band outcome with resolveElection at the threshold", () => {
    const ahead = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      peopleRep: 60,
      politicalRep: 60,
      rival: { heat: 50, lastMoveMonth: null },
    };
    const behind = {
      ...ahead,
      peopleRep: 40,
      politicalRep: 40,
    };

    expect(electionForecast(ahead).margin >= 0).toBe(
      resolveElection(ahead).status === "won",
    );
    expect(electionForecast(behind).margin >= 0).toBe(
      resolveElection(behind).status === "won",
    );
  });
});
