import type { GameState } from "@localmanager/shared";

export type FirstWinStepId =
  | "resolve_event"
  | "start_project"
  | "close_month";

export type FirstWinStep = {
  id: FirstWinStepId;
  labelIt: string;
  done: boolean;
};

export type FirstWinProgress = {
  steps: FirstWinStep[];
  complete: boolean;
};

const LABELS: Record<FirstWinStepId, string> = {
  resolve_event: "Risolvi l'evento del mese",
  start_project: "Avvia un'opera in fascicolo",
  close_month: "Chiudi il mese",
};

export function firstWinProgress(state: GameState): FirstWinProgress {
  const resolveDone = state.month > 1 || state.pendingEvents.length === 0;
  const projectDone =
    state.activeProjects.length + state.completedProjects.length > 0;
  const closeDone = state.month > 1;

  const steps: FirstWinStep[] = (
    ["resolve_event", "start_project", "close_month"] as const
  ).map((id) => ({
    id,
    labelIt: LABELS[id],
    done:
      id === "resolve_event"
        ? resolveDone
        : id === "start_project"
          ? projectDone
          : closeDone,
  }));

  return {
    steps,
    complete: steps.every((step) => step.done),
  };
}
