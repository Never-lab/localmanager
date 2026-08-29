import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialGameState } from "@localmanager/sim";
import { useGameStore } from "./gameStore";

describe("game store", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("starts a mandate for the named mayor", () => {
    useGameStore.getState().startGame("  Ada Rossi  ");

    const store = useGameStore.getState();
    expect(store.screen).toBe("game");
    expect(store.state?.mayorName).toBe("Ada Rossi");
    expect(store.state?.month).toBe(1);
  });

  it("applies simulation actions to the current game", () => {
    useGameStore.getState().startGame("Ada Rossi");
    const openingCash = useGameStore.getState().state!.cash;

    useGameStore.getState().startProject("road_fix");

    expect(useGameStore.getState().state!.cash).toBeLessThan(openingCash);
    expect(useGameStore.getState().state!.activeProjects[0]?.templateId).toBe(
      "road_fix",
    );
  });

  it("advances a guest game without contacting the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    useGameStore.getState().startGame("Ada Rossi");

    await useGameStore.getState().closeMonth();

    expect(useGameStore.getState().state?.month).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests and installs a fresh server map after a dirty month", async () => {
    const state = createInitialGameState({ mayorName: "Ada Rossi", seed: 1 });
    state.activeProjects = [
      { templateId: "road_fix", monthsRemaining: 1, slotId: "viabilita_est" },
    ];
    useGameStore.setState({
      screen: "game",
      state,
      token: "token",
      runId: "run-1",
    });
    URL.createObjectURL = vi.fn(() => "blob:mappa");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(
        new Response(new Blob(["png"]), {
          status: 200,
          headers: { "x-map-version": "1", "content-type": "image/png" },
        }),
      );

    await useGameStore.getState().closeMonth();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(useGameStore.getState().mapUrl).toBe("blob:mappa");
    expect(useGameStore.getState().state?.overlay).toMatchObject({
      dirty: false,
      mapVersion: 1,
      activeSlots: ["viabilita_est"],
    });
  });
});
