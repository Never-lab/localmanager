import type { GameState } from "@localmanager/shared";
import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import { DEBT_HORIZON_MONTHS, STAFF_COSTS } from "./config.js";
import { createInitialGameState } from "./createInitial.js";
import { forecastMonthCash } from "./forecastMonthCash.js";

function withEmptyQueue(state: GameState): GameState {
  return { ...state, pendingEvents: [] satisfies GameState["pendingEvents"] };
}

describe("forecastMonthCash", () => {
  it("matches structural cash delta of advanceMonth (no province)", () => {
    let state = withEmptyQueue(
      createInitialGameState({ mayorName: "Test", seed: 1 }),
    );
    state = {
      ...state,
      debt: 240_000,
      staff: state.staff.map((m) =>
        m.role === "secretary" ? { ...m, hired: true } : { ...m, hired: false },
      ),
    };
    const forecast = forecastMonthCash(state);
    expect(forecast.debtService).toBe(Math.ceil(240_000 / DEBT_HORIZON_MONTHS));
    expect(forecast.staffCost).toBe(STAFF_COSTS.secretary);
    expect(forecast.net).toBe(
      forecast.income -
        forecast.maintenance -
        forecast.staffCost -
        forecast.debtService,
    );

    const before = state.cash;
    const next = advanceMonth(state);
    expect(next.cash - before).toBe(forecast.net);
  });
});
