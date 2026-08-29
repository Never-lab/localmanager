import { describe, expect, it } from "vitest";
import {
  fireStaff,
  hireStaff,
  issuePressRelease,
  startProject,
} from "./actions.js";
import { advanceMonth } from "./advanceMonth.js";
import { createInitialGameState } from "./createInitial.js";

describe("press cooldown and staff levers", () => {
  it("allows only one press release per month", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const first = issuePressRelease(state, "people");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = issuePressRelease(first.state, "political");
    expect(second).toEqual({
      ok: false,
      errorIt: "Hai già emesso un comunicato questo mese. Chiudi il mese per ripubblicare.",
    });
  });

  it("resets press allowance on month close", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const pressed = issuePressRelease(state, "people");
    expect(pressed.ok).toBe(true);
    if (!pressed.ok) return;
    state = { ...pressed.state, pendingEvents: [] };
    state = advanceMonth(state);

    const again = issuePressRelease(state, "political");
    expect(again.ok).toBe(true);
  });

  it("communicator boosts press deltas", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const hired = hireStaff(state, "communicator");
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    state = hired.state;

    const result = issuePressRelease(state, "people");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.peopleRep).toBe(state.peopleRep + 5);
    expect(result.state.politicalRep).toBe(state.politicalRep - 1);
  });

  it("technician shortens new project duration by one month", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const hired = hireStaff(state, "technician");
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    state = hired.state;

    const template = state.comune.projects.find(
      (project) => project.templateId === "youth_space",
    )!;
    const result = startProject(state, "youth_space");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activeProjects[0]?.monthsRemaining).toBe(
      template.months - 1,
    );
  });

  it("firing the technician does not change already queued projects", () => {
    let state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const hired = hireStaff(state, "technician");
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    const started = startProject(hired.state, "youth_space");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const remaining = started.state.activeProjects[0]!.monthsRemaining;
    const fired = fireStaff(started.state, "technician");
    expect(fired.ok).toBe(true);
    if (!fired.ok) return;
    expect(fired.state.activeProjects[0]?.monthsRemaining).toBe(remaining);
  });
});
