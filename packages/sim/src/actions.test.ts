import { describe, expect, it } from "vitest";
import { advanceMonth } from "./advanceMonth.js";
import {
  fireStaff,
  hireStaff,
  issuePressRelease,
  requestProvinceFunds,
  respondToRival,
  startProject,
} from "./actions.js";
import { createInitialGameState } from "./createInitial.js";
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
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
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
        peopleRep: state.peopleRep - 2,
        politicalRep: state.politicalRep + 3,
      },
    });
  });

  it("ignoring a rival clears the event and costs people reputation", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      rival: {
        heat: 35,
        lastMoveMonth: 6,
        pendingEvent: {
          kind: "press_attack" as const,
          messageIt: "Attacco.",
        },
      },
    };

    const result = respondToRival(state, "ignore");

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        peopleRep: state.peopleRep - 2,
        rival: { ...state.rival, pendingEvent: null },
      },
    });
  });

  it("countering a rival clears the event, pays cash, and improves political standing", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      rival: {
        heat: 35,
        lastMoveMonth: 6,
        pendingEvent: {
          kind: "press_attack" as const,
          messageIt: "Attacco.",
        },
      },
    };

    const result = respondToRival(state, "counter");

    expect(result).toEqual({
      ok: true,
      state: {
        ...state,
        cash: state.cash - 5_000,
        politicalRep: state.politicalRep + 2,
        rival: {
          ...state.rival,
          heat: state.rival.heat - 3,
          pendingEvent: null,
        },
      },
    });
  });

  it("rejects a rival response when there is no pending event", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });

    expect(respondToRival(state, "ignore")).toEqual({
      ok: false,
      errorIt: "Nessun evento rivale da gestire.",
    });
  });

  it("rejects a rival counter when cash is insufficient", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      cash: 4_999,
      rival: {
        heat: 35,
        lastMoveMonth: 6,
        pendingEvent: {
          kind: "press_attack" as const,
          messageIt: "Attacco.",
        },
      },
    };

    expect(respondToRival(state, "counter")).toEqual({
      ok: false,
      errorIt: "Cassa insufficiente.",
    });
  });
});
