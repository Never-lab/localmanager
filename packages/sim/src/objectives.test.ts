import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./createInitial.js";
import { nextObjectives } from "./objectives.js";

describe("nextObjectives", () => {
  it("returns the first three incomplete soft goals", () => {
    const state = createInitialGameState({ mayorName: "Test", seed: 1 });
    const next = nextObjectives(state, 3);

    expect(next.map((goal) => goal.id)).toEqual([
      "resolve_event",
      "start_project",
      "close_month",
    ]);
    expect(next.every((goal) => !goal.done)).toBe(true);
  });

  it("skips completed early goals and surfaces mid-mandate ones", () => {
    const state = {
      ...createInitialGameState({ mayorName: "Test", seed: 1 }),
      pendingEvents: [],
      month: 2,
      activeProjects: [
        { templateId: "youth_space" as const, monthsRemaining: 2, slotId: "centro" as const },
      ],
      completedProjects: [
        {
          templateId: "road_fix" as const,
          slotId: "viabilita_est" as const,
          completedMonth: 2,
        },
      ],
      staff: createInitialGameState({ mayorName: "Test", seed: 1 }).staff.map(
        (member) =>
          member.role === "technician" || member.role === "communicator"
            ? { ...member, hired: true }
            : member,
      ),
    };

    const next = nextObjectives(state, 3);
    expect(next.map((goal) => goal.id)).toEqual([
      "survive_12",
      "map_updated",
    ]);
  });
});
