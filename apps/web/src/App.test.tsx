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
import { useGameStore, type ComuneSeedPayload } from "./store/gameStore";

function fixtureSeed(): ComuneSeedPayload {
  const state = createInitialGameState({ mayorName: "_" });
  return {
    comuneId: state.comuneId,
    name: state.comuneName,
    province: state.comune.province,
    region: state.comune.region,
    population: state.population,
    meanAge: state.meanAge,
    openingCash: state.cash,
    monthlyBaseIncome: state.comune.monthlyBaseIncome,
    monthlyMaintenance: state.comune.monthlyMaintenance,
    sourceYear: state.comune.sourceYear,
    sources: state.comune.sources,
    projects: state.comune.projects,
    map: state.comune.map,
  };
}

describe("desk interface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    URL.revokeObjectURL = vi.fn();
    useGameStore.getState().reset();
  });
  afterEach(cleanup);

  it("lets a guest begin a mandate from the Italian entry flow", async () => {
    const seed = fixtureSeed();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/comuni?") && !url.includes("hydrate")) {
        return new Response(
          JSON.stringify({
            count: 1,
            items: [
              {
                id: seed.comuneId,
                name: seed.name,
                province: seed.province,
                region: seed.region,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/hydrate") && !url.includes("/api/comuni/hydrate/")) {
        return new Response(
          JSON.stringify({
            jobId: "job-1",
            status: "ready",
            seed: {
              comuneId: seed.comuneId,
              name: seed.name,
              province: seed.province,
              region: seed.region,
              population: seed.population,
              meanAge: seed.meanAge,
              budget: {
                openingCash: seed.openingCash,
                monthlyBaseIncome: seed.monthlyBaseIncome,
                monthlyMaintenance: seed.monthlyMaintenance,
                sourceYear: seed.sourceYear ?? 2023,
              },
              projects: seed.projects,
              sources: seed.sources,
              map: seed.map,
            },
          }),
          { status: 202 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    render(<App />);

    expect(screen.getByText("Entra in municipio")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continua come ospite" }));
    fireEvent.click(screen.getByRole("button", { name: "Nuovo mandato" }));
    fireEvent.change(screen.getByLabelText("Nome del sindaco"), {
      target: { value: "Ada Rossi" },
    });
    fireEvent.change(screen.getByLabelText("Cerca comune"), {
      target: { value: "Santa Maria" },
    });
    await waitFor(() => {
      expect(screen.getByText("Santa Maria Imbaro")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText(/Santa Maria Imbaro/));
    fireEvent.click(
      screen.getByRole("button", { name: "Carica dati ufficiali" }),
    );
    await waitFor(() => {
      expect(screen.getByText(/Pronto: bilancio/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Apri il municipio" }));

    expect(screen.getByText("Scrivania del sindaco")).toBeTruthy();
    expect(screen.getByText("Mappa degli interventi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chiudi mese" })).toBeTruthy();
  });

  it("explains why an unaffordable project is disabled", () => {
    useGameStore.getState().startGame("Ada Rossi", fixtureSeed());
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

  it("shows an election forecast chip on the desk", () => {
    useGameStore.getState().startGame("Ada Rossi", fixtureSeed());
    render(<App />);
    expect(screen.getByText(/in vantaggio|in bilico|in ritardo/)).toBeTruthy();
  });
});
