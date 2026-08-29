import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialGameState } from "@localmanager/sim";
import { useGameStore } from "./gameStore";

describe("game store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useGameStore.getState().reset();
  });

  it("starts a mandate for the named mayor", () => {
    useGameStore.getState().startGame("  Ada Rossi  ");

    const store = useGameStore.getState();
    expect(store.screen).toBe("game");
    expect(store.state?.mayorName).toBe("Ada Rossi");
    expect(store.state?.month).toBe(1);
  });

  it("uses a UUID for authenticated run IDs", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    useGameStore.setState({ token: "token" });

    useGameStore.getState().startGame("Ada Rossi");

    expect(useGameStore.getState().runId).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
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

  it("ignores a second close while the first close is saving", async () => {
    let finishSave!: (response: Response) => void;
    const savePending = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(savePending);
    useGameStore.setState({
      screen: "game",
      state: createInitialGameState({ mayorName: "Ada Rossi" }),
      token: "token",
      runId: "run-1",
    });

    const firstClose = useGameStore.getState().closeMonth();
    const secondClose = useGameStore.getState().closeMonth();

    expect(useGameStore.getState().mapJobPending).toBe(true);
    finishSave(new Response(null, { status: 200 }));
    await Promise.all([firstClose, secondClose]);
    expect(useGameStore.getState().state?.month).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().mapJobPending).toBe(false);
  });

  it("resumes the cloud run remembered after a save", async () => {
    const savedState = createInitialGameState({ mayorName: "Ada Rossi" });
    savedState.month = 7;
    localStorage.setItem("localmanager:lastRunId", "run-7");
    useGameStore.setState({ screen: "menu", token: "token" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ runId: "run-7", state: savedState, updatedAt: "" }),
        { status: 200 },
      ),
    );

    await useGameStore.getState().resumeGame();

    expect(fetchSpy).toHaveBeenCalledWith("/api/saves/run-7", {
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    expect(useGameStore.getState()).toMatchObject({
      screen: "game",
      runId: "run-7",
      state: { month: 7 },
    });
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get(name: string) {
            const key = name.toLowerCase();
            if (key === "x-map-version") return "1";
            if (key === "content-type") return "image/png";
            return null;
          },
        },
        // Avoid Response(Blob).blob() — jsdom on CI throws "object.stream is not a function".
        async blob() {
          return new Blob([Uint8Array.from([137, 80, 78, 71])], {
            type: "image/png",
          });
        },
      } as Response);

    await useGameStore.getState().closeMonth();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenNthCalledWith(3, "/api/runs/run-1/map", {
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    expect(useGameStore.getState().mapUrl).toBe("blob:mappa");
    expect(localStorage.getItem("localmanager:lastRunId")).toBe("run-1");
    expect(useGameStore.getState().state?.overlay).toMatchObject({
      dirty: false,
      mapVersion: 1,
      activeSlots: ["viabilita_est"],
    });
  });
});
