import type { PendingEvent, PendingEventChoice } from "@localmanager/shared";
import { nextRandom } from "./rng.js";

export const RIVAL_PRESS_TEMPLATE_ID = "rival_press_attack";

export interface EventTemplate {
  id: string;
  titleIt: string;
  bodyIt: string;
  weight: number;
  choices: PendingEventChoice[];
}

export const EVENT_DECK: EventTemplate[] = [
  {
    id: "pothole_complaints",
    titleIt: "Buche in via Roma",
    bodyIt: "I residenti chiedono un intervento urgente sulla viabilità locale.",
    weight: 2,
    choices: [
      {
        id: "patch",
        labelIt: "Ripara subito (−€3.000)",
        requiresCash: 3_000,
        effects: { cash: -3_000, peopleRep: 4, politicalRep: 1 },
      },
      {
        id: "defer",
        labelIt: "Rimanda al prossimo bilancio",
        effects: { peopleRep: -3 },
      },
    ],
  },
  {
    id: "festa_patronale",
    titleIt: "Festa patronale",
    bodyIt: "Il comitato chiede il patrocinio del Comune per la festa del paese.",
    weight: 2,
    choices: [
      {
        id: "sponsor",
        labelIt: "Patrocina (−€2.000)",
        requiresCash: 2_000,
        effects: { cash: -2_000, peopleRep: 5, politicalRep: -1 },
      },
      {
        id: "decline",
        labelIt: "Limita il supporto",
        effects: { peopleRep: -2, politicalRep: 2 },
      },
    ],
  },
  {
    id: "school_bus_delay",
    titleIt: "Ritardi dello scuolabus",
    bodyIt: "Genitori segnalano ritardi ripetuti sulla tratta mattutina.",
    weight: 2,
    choices: [
      {
        id: "reinforce",
        labelIt: "Rafforza il servizio (−€4.000)",
        requiresCash: 4_000,
        effects: { cash: -4_000, peopleRep: 3, politicalRep: 2 },
      },
      {
        id: "explain",
        labelIt: "Spiega i vincoli di bilancio",
        effects: { peopleRep: -2, politicalRep: 1 },
      },
    ],
  },
  {
    id: "volunteer_group",
    titleIt: "Associazione di volontariato",
    bodyIt: "Un gruppo propone giornate di cura degli spazi pubblici.",
    weight: 2,
    choices: [
      {
        id: "support",
        labelIt: "Sostieni con materiale (−€1.500)",
        requiresCash: 1_500,
        effects: { cash: -1_500, peopleRep: 3 },
      },
      {
        id: "thanks",
        labelIt: "Ringrazia senza fondi",
        effects: { peopleRep: 1, politicalRep: -1 },
      },
    ],
  },
  {
    id: "budget_audit_rumor",
    titleIt: "Voci sul bilancio",
    bodyIt: "Circolano voci imprecise sui conti comunali.",
    weight: 1,
    choices: [
      {
        id: "transparency",
        labelIt: "Pubblica un riepilogo chiaro",
        effects: { peopleRep: 2, politicalRep: 2 },
      },
      {
        id: "quiet",
        labelIt: "Non alimentare la polemica",
        effects: { peopleRep: -1, politicalRep: -2, rivalHeat: 2 },
      },
    ],
  },
  {
    id: "youth_petition",
    titleIt: "Petizione dei giovani",
    bodyIt: "Una petizione chiede più spazi serali in centro.",
    weight: 2,
    choices: [
      {
        id: "commit",
        labelIt: "Prendi un impegno pubblico",
        effects: { peopleRep: 4, politicalRep: -2 },
      },
      {
        id: "study",
        labelIt: "Apri un tavolo tecnico",
        effects: { peopleRep: 1, politicalRep: 2 },
      },
    ],
  },
  {
    id: RIVAL_PRESS_TEMPLATE_ID,
    titleIt: "Attacco del rivale",
    bodyIt: "Il rivale attacca la gestione del Comune sulla stampa.",
    weight: 0,
    choices: [
      {
        id: "ignore",
        labelIt: "Ignora",
        effects: { peopleRep: -2 },
      },
      {
        id: "counter",
        labelIt: "Replica (−€5.000)",
        requiresCash: 5_000,
        effects: { cash: -5_000, politicalRep: 2, rivalHeat: -3 },
      },
    ],
  },
];

export function instantiateEvent(
  template: EventTemplate,
  instanceId: string,
): PendingEvent {
  return {
    id: instanceId,
    templateId: template.id,
    titleIt: template.titleIt,
    bodyIt: template.bodyIt,
    choices: template.choices,
  };
}

export function getTemplate(templateId: string): EventTemplate | undefined {
  return EVENT_DECK.find((template) => template.id === templateId);
}

export function drawMonthlyEvent(
  seed: number,
  preferRival: boolean,
): { event: PendingEvent; seed: number } {
  if (preferRival) {
    const rival = getTemplate(RIVAL_PRESS_TEMPLATE_ID)!;
    const roll = nextRandom(seed);
    return {
      event: instantiateEvent(rival, `e-${roll.seed}`),
      seed: roll.seed,
    };
  }

  const pool = EVENT_DECK.filter((template) => template.weight > 0);
  const totalWeight = pool.reduce((sum, template) => sum + template.weight, 0);
  const roll = nextRandom(seed);
  let cursor = roll.value * totalWeight;
  let picked = pool[pool.length - 1]!;
  for (const template of pool) {
    cursor -= template.weight;
    if (cursor <= 0) {
      picked = template;
      break;
    }
  }

  return {
    event: instantiateEvent(picked, `e-${roll.seed}`),
    seed: roll.seed,
  };
}
