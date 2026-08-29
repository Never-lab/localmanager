import type {
  GameState,
  ProjectTemplateId,
  StaffRole,
} from "@localmanager/shared";
import { CLAMP } from "./config.js";
import { loadComune } from "./loadComune.js";

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; errorIt: string };

export function startProject(
  state: GameState,
  templateId: ProjectTemplateId,
): ActionResult {
  const template = loadComune().projects.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!template) {
    return { ok: false, errorIt: "Progetto non trovato." };
  }
  if (state.cash < template.cost) {
    return { ok: false, errorIt: "Cassa insufficiente." };
  }

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash - template.cost,
      activeProjects: [
        ...state.activeProjects,
        {
          templateId,
          monthsRemaining: template.months,
          slotId: template.slotId,
        },
      ],
    },
  };
}

export function hireStaff(state: GameState, role: StaffRole): ActionResult {
  const member = state.staff.find((candidate) => candidate.role === role);
  if (member?.hired) {
    return {
      ok: false,
      errorIt: "Questa figura professionale è già in servizio.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      staff: state.staff.map((candidate) =>
        candidate.role === role ? { ...candidate, hired: true } : candidate,
      ),
    },
  };
}

export function fireStaff(state: GameState, role: StaffRole): ActionResult {
  const member = state.staff.find((candidate) => candidate.role === role);
  if (!member?.hired) {
    return {
      ok: false,
      errorIt: "Questa figura professionale non è in servizio.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      staff: state.staff.map((candidate) =>
        candidate.role === role ? { ...candidate, hired: false } : candidate,
      ),
    },
  };
}

export function requestProvinceFunds(
  state: GameState,
  amount: number,
): ActionResult {
  if (state.provinceRequest) {
    return {
      ok: false,
      errorIt: "C'è già una richiesta in attesa dalla Provincia.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      provinceRequest: {
        amount,
        resolveMonth: state.month + 2,
      },
    },
  };
}

export function issuePressRelease(
  state: GameState,
  tone: "people" | "political",
): ActionResult {
  return {
    ok: true,
    state: {
      ...state,
      peopleRep: CLAMP(state.peopleRep + (tone === "people" ? 3 : -2)),
      politicalRep: CLAMP(
        state.politicalRep + (tone === "political" ? 3 : -2),
      ),
    },
  };
}

export function respondToRival(
  state: GameState,
  choice: "ignore" | "counter",
): ActionResult {
  if (!state.rival.pendingEvent) {
    return { ok: false, errorIt: "Nessun evento rivale da gestire." };
  }
  if (choice === "counter" && state.cash < 5_000) {
    return { ok: false, errorIt: "Cassa insufficiente." };
  }

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash - (choice === "counter" ? 5_000 : 0),
      peopleRep: CLAMP(state.peopleRep - (choice === "ignore" ? 2 : 0)),
      politicalRep: CLAMP(
        state.politicalRep + (choice === "counter" ? 2 : 0),
      ),
      rival: {
        ...state.rival,
        heat: CLAMP(
          state.rival.heat - (choice === "counter" ? 3 : 0),
        ),
        pendingEvent: null,
      },
    },
  };
}
