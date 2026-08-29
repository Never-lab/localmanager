import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { useGameStore } from "./store/gameStore";

describe("desk interface", () => {
  beforeEach(() => useGameStore.getState().reset());
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
});
