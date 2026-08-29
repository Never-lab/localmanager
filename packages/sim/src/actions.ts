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

export function resolveEvent(
  state: GameState,
  eventId: string,
  choiceId: string,
): ActionResult {
  const event = state.pendingEvents.find((candidate) => candidate.id === eventId);
  if (!event) {
    return { ok: false, errorIt: "Nessun evento da gestire." };
  }
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) {
    return { ok: false, errorIt: "Scelta non valida." };
  }
  if (
    choice.requiresCash !== undefined &&
    state.cash < choice.requiresCash
  ) {
    return { ok: false, errorIt: "Cassa insufficiente." };
  }

  const effects = choice.effects;
  const deltaParts: string[] = [];
  if (effects.peopleRep) deltaParts.push(`Popolo ${signed(effects.peopleRep)}`);
  if (effects.politicalRep) {
    deltaParts.push(`Politica ${signed(effects.politicalRep)}`);
  }
  if (effects.rivalHeat) {
    deltaParts.push(`Rivale ${signed(effects.rivalHeat)}`);
  }
  if (effects.cash) deltaParts.push(`Cassa ${signed(effects.cash)}`);

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash + (effects.cash ?? 0),
      peopleRep: CLAMP(state.peopleRep + (effects.peopleRep ?? 0)),
      politicalRep: CLAMP(state.politicalRep + (effects.politicalRep ?? 0)),
      rival: {
        ...state.rival,
        heat: CLAMP(state.rival.heat + (effects.rivalHeat ?? 0)),
      },
      pendingEvents: state.pendingEvents.filter(
        (candidate) => candidate.id !== eventId,
      ),
      log: [
        ...state.log,
        {
          month: state.month,
          textIt: deltaParts.length
            ? `${event.titleIt}: ${deltaParts.join(" · ")}`
            : `${event.titleIt}: scelta registrata.`,
        },
      ],
    },
  };
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
