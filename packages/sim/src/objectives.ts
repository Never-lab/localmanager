import type { GameState } from "@localmanager/shared";

export type ObjectiveId =
  | "resolve_event"
  | "start_project"
  | "close_month"
  | "complete_project"
  | "hire_technician"
  | "hire_communicator"
  | "survive_12"
  | "map_updated";

export type Objective = {
  id: ObjectiveId;
  labelIt: string;
  done: boolean;
};

const CATALOG: { id: ObjectiveId; labelIt: string; done: (s: GameState) => boolean }[] =
  [
    {
      id: "resolve_event",
      labelIt: "Risolvi l'evento del mese",
      done: (s) => s.month > 1 || s.pendingEvents.length === 0,
    },
    {
      id: "start_project",
      labelIt: "Avvia un'opera in fascicolo",
      done: (s) =>
        s.activeProjects.length + s.completedProjects.length > 0,
    },
    {
      id: "close_month",
      labelIt: "Chiudi il mese",
      done: (s) => s.month > 1,
    },
    {
      id: "complete_project",
      labelIt: "Porta a termine un'opera",
      done: (s) => s.completedProjects.length > 0,
    },
    {
      id: "hire_technician",
      labelIt: "Assumi un tecnico",
      done: (s) =>
        s.staff.some((member) => member.role === "technician" && member.hired),
    },
    {
      id: "hire_communicator",
      labelIt: "Assumi un addetto stampa",
      done: (s) =>
        s.staff.some(
          (member) => member.role === "communicator" && member.hired,
        ),
    },
    {
      id: "survive_12",
      labelIt: "Raggiungi il dodicesimo mese",
      done: (s) => s.month >= 12,
    },
    {
      id: "map_updated",
      labelIt: "Aggiorna la mappa del paese",
      done: (s) => s.overlay.mapVersion > 0,
    },
  ];

/** Next incomplete soft goals for HUD (default 3). */
export function nextObjectives(state: GameState, limit = 3): Objective[] {
  return CATALOG.filter((entry) => !entry.done(state))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      labelIt: entry.labelIt,
      done: false,
    }));
}
