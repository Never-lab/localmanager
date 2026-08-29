import type { GameState } from "@localmanager/shared";

export function resolveElection(state: GameState): GameState {
  const averageReputation = (state.peopleRep + state.politicalRep) / 2;

  return {
    ...state,
    status: averageReputation >= state.rival.heat ? "won" : "lost",
  };
}
