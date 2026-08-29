import type { GameState } from "@localmanager/shared";
import { CLAMP, ELECTION_TOSS_UP_MARGIN } from "./config.js";

export type ElectionBand = "ahead" | "toss_up" | "behind";

export interface ElectionForecast {
  avg: number;
  rivalHeat: number;
  margin: number;
  band: ElectionBand;
}

export function electionForecast(state: GameState): ElectionForecast {
  const avg = (state.peopleRep + state.politicalRep) / 2;
  const rivalHeat = state.rival.heat;
  const margin = avg - rivalHeat;
  let band: ElectionBand = "toss_up";
  if (margin >= ELECTION_TOSS_UP_MARGIN) band = "ahead";
  else if (margin <= -ELECTION_TOSS_UP_MARGIN) band = "behind";

  return { avg, rivalHeat, margin, band };
}

export function resolveElection(state: GameState): GameState {
  const averageReputation = (state.peopleRep + state.politicalRep) / 2;

  return {
    ...state,
    status: averageReputation >= state.rival.heat ? "won" : "lost",
  };
}
