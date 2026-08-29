import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import {
  fireStaff,
  hireStaff,
  issuePressRelease,
  requestProvinceFunds,
  resolveEvent,
  startProject,
} from "./actions.js";
import { createInitialGameState } from "./createInitial.js";
import { RIVAL_PRESS_TEMPLATE_ID, getTemplate, instantiateEvent } from "./events.js";
import { loadComune } from "./loadComune.js";

describe("desk actions", () => {
  it("rejects a project when cash is insufficient", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      cash: 0,
    };

    expect(startProject(state, "youth_space")).toEqual({
      ok: false,
      errorIt: "Cassa insufficiente.",
    });
  });

  it("starts a project and pays its cost", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const template = loadComune().projects.find(
      (candidate) => candidate.templateId === "youth_space",
    )!;

    const result = startProject(state, template.templateId);

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        cash: state.cash - template.cost,
        activeProjects: [
          {
            templateId: template.templateId,
            monthsRemaining: template.months,
            slotId: template.slotId,
          },
        ],
      },
    });
  });

  it("hiring a communicator increases next month's staff burn", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [],
    };
    const result = hireStaff(state, "communicator");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const baseline = advanceMonth(state);
    const afterHire = advanceMonth(result.state);
    const communicator = state.staff.find(
      (member) => member.role === "communicator",
    )!;

    expect(afterHire.cash).toBe(baseline.cash - communicator.monthlyCost);
  });

  it("rejects hiring an already hired staff member", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    expect(hireStaff(state, "secretary")).toEqual({
      ok: false,
      errorIt: "Questa figura professionale è già in servizio.",
    });
  });

  it("fires a hired staff member", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const result = fireStaff(state, "secretary");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.state.staff.find((member) => member.role === "secretary")?.hired,
    ).toBe(false);
  });

  it("rejects firing a staff member who is not hired", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    expect(fireStaff(state, "technician")).toEqual({
      ok: false,
      errorIt: "Questa figura professionale non è in servizio.",
    });
  });

  it("creates one province request resolving in two months", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const result = requestProvinceFunds(state, 25_000);

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        provinceRequest: { amount: 25_000, resolveMonth: state.month + 2 },
      },
    });
  });

  it("rejects a second pending province request", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      provinceRequest: { amount: 25_000, resolveMonth: 3 },
    };

    expect(requestProvinceFunds(state, 10_000)).toEqual({
      ok: false,
      errorIt: "C'è già una richiesta in attesa dalla Provincia.",
    });
  });

  it("a people press release raises people reputation and lowers political reputation", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const result = issuePressRelease(state, "people");

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        pressUsedThisMonth: true,
        peopleRep: state.peopleRep + 3,
        politicalRep: state.politicalRep - 2,
      },
    });
  });

  it("a political press release raises political reputation and lowers people reputation", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    const result = issuePressRelease(state, "political");

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        pressUsedThisMonth: true,
        peopleRep: state.peopleRep - 2,
        politicalRep: state.politicalRep + 3,
      },
    });
  });

  it("seeds one pending event on a new game", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    expect(state.pendingEvents).toHaveLength(1);
  });

  it("resolveEvent applies effects, clears the event, and logs deltas", () => {
    const template = getTemplate("youth_petition")!;
    const event = instantiateEvent(template, "evt-1");
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [event],
    };

    const result = resolveEvent(state, "evt-1", "commit");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingEvents).toEqual([]);
    expect(result.state.peopleRep).toBe(state.peopleRep + 4);
    expect(result.state.politicalRep).toBe(state.politicalRep - 2);
    expect(result.state.log.at(-1)?.textIt).toContain("Popolo +4");
  });

  it("ignoring a rival event clears it and costs people reputation", () => {
    const event = instantiateEvent(
      getTemplate(RIVAL_PRESS_TEMPLATE_ID)!,
      "rival-1",
    );
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [event],
    };

    const result = resolveEvent(state, "rival-1", "ignore");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingEvents).toEqual([]);
    expect(result.state.peopleRep).toBe(state.peopleRep - 2);
  });

  it("countering a rival event pays cash and improves political standing", () => {
    const event = instantiateEvent(
      getTemplate(RIVAL_PRESS_TEMPLATE_ID)!,
      "rival-1",
    );
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [event],
    };

    const result = resolveEvent(state, "rival-1", "counter");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cash).toBe(state.cash - 5_000);
    expect(result.state.politicalRep).toBe(state.politicalRep + 2);
    expect(result.state.rival.heat).toBe(state.rival.heat - 3);
    expect(result.state.pendingEvents).toEqual([]);
  });

  it("rejects resolveEvent when the event is missing", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [],
    };

    expect(resolveEvent(state, "missing", "ignore")).toEqual({
      ok: false,
      errorIt: "Nessun evento da gestire.",
    });
  });

  it("rejects a paid choice when cash is insufficient", () => {
    const event = instantiateEvent(
      getTemplate(RIVAL_PRESS_TEMPLATE_ID)!,
      "rival-1",
    );
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      cash: 4_999,
      pendingEvents: [event],
    };

    expect(resolveEvent(state, "rival-1", "counter")).toEqual({
      ok: false,
      errorIt: "Cassa insufficiente.",
    });
  });
});
