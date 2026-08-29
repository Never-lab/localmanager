import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createInitialGameState } from "@localmanager/sim";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useGameStore } from "./store/gameStore";

describe("desk interface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useGameStore.getState().reset();
  });
  afterEach(cleanup);

  it("lets a guest begin a mandate from the Italian entry flow", () => {
    render(<App />);

    expect(screen.getByText("Entra in municipio")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continua come ospite" }));
    fireEvent.click(screen.getByRole("button", { name: "Nuovo mandato" }));
    fireEvent.change(screen.getByLabelText("Nome del sindaco"), {
      target: { value: "Ada Rossi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apri il municipio" }));

    expect(screen.getByText("Scrivania del sindaco")).toBeTruthy();
    expect(screen.getByText("Mappa degli interventi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chiudi mese" })).toBeTruthy();
  });

  it("explains why an unaffordable project is disabled", () => {
    useGameStore.getState().startGame("Ada Rossi");
    useGameStore.setState((store) => ({
      state: store.state ? { ...store.state, cash: 0 } : null,
    }));
    render(<App />);

    const project = screen.getByRole("button", {
      name: /Avvia Ala scolastica/,
    });
    expect(project).toHaveProperty("disabled", true);
    expect(project.getAttribute("title")).toContain("cassa");
  });

  it("disables cloud resume when no saved run is known", () => {
    useGameStore.setState({ screen: "menu", token: "token" });

    render(<App />);

    const resume = screen.getByRole("button", { name: "Riprendi partita" });
    expect(resume).toHaveProperty("disabled", true);
    expect(resume.getAttribute("title")).toContain("salvataggio");
  });

  it("loads the remembered cloud save from the menu", async () => {
    const savedState = createInitialGameState({ mayorName: "Ada Rossi" });
    savedState.month = 4;
    localStorage.setItem("localmanager:lastRunId", "run-4");
    useGameStore.setState({ screen: "menu", token: "token" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ runId: "run-4", state: savedState }), {
        status: 200,
      }),
    );
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Riprendi partita" }));

    await waitFor(() =>
      expect(screen.getByText("Mese 4 / 48")).toBeTruthy(),
    );
  });

  it("does not draw SVG markers over a server-rendered map", () => {
    const state = createInitialGameState({ mayorName: "Ada Rossi" });
    state.overlay.activeSlots = ["centro"];
    useGameStore.setState({ screen: "game", state, mapUrl: "blob:mappa" });
    const { rerender } = render(<App />);

    expect(screen.queryByLabelText("Interventi completati")).toBeNull();

    useGameStore.setState({ mapUrl: null });
    rerender(<App />);
    expect(screen.getByLabelText("Interventi completati")).toBeTruthy();
  });
});
