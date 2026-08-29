import type {
  GameState,
  ProjectTemplateId,
  StaffRole,
} from "@localmanager/shared";
import {
  advanceMonth,
  createInitialGameState,
  fireStaff as fireStaffAction,
  hireStaff as hireStaffAction,
  issuePressRelease as issuePressReleaseAction,
  requestProvinceFunds as requestProvinceFundsAction,
  respondToRival as respondToRivalAction,
  startProject as startProjectAction,
  type ActionResult,
} from "@localmanager/sim";
import { create } from "zustand";

export type Screen = "auth" | "menu" | "setup" | "game" | "gameover";

interface GameStore {
  screen: Screen;
  state: GameState | null;
  token: string | null;
  runId: string | null;
  mapUrl: string | null;
  mapJobPending: boolean;
  errorIt: string | null;
  authenticate: (
    mode: "login" | "register",
    email: string,
    password: string,
  ) => Promise<void>;
  continueAsGuest: () => void;
  goToSetup: () => void;
  startGame: (mayorName: string) => void;
  startProject: (templateId: ProjectTemplateId) => void;
  hireStaff: (role: StaffRole) => void;
  fireStaff: (role: StaffRole) => void;
  requestProvinceFunds: (amount: number) => void;
  issuePressRelease: (tone: "people" | "political") => void;
  respondToRival: (choice: "ignore" | "counter") => void;
  closeMonth: () => Promise<void>;
  resumeGame: () => Promise<void>;
  returnToMenu: () => void;
  reset: () => void;
}

export const LAST_RUN_ID_KEY = "localmanager:lastRunId";

const initialState = {
  screen: "auth" as Screen,
  state: null,
  token: null,
  runId: null,
  mapUrl: null,
  mapJobPending: false,
  errorIt: null,
};

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function authorization(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

function revokeMapUrl(mapUrl: string | null) {
  if (mapUrl?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(mapUrl);
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  const apply = (result: ActionResult) => {
    if (result.ok) set({ state: result.state, errorIt: null });
    else set({ errorIt: result.errorIt });
  };

  return {
    ...initialState,

    authenticate: async (mode, email, password) => {
      set({ errorIt: null });
      try {
        const response = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          throw new Error(
            mode === "login"
              ? "Credenziali non valide."
              : "Impossibile creare l'account.",
          );
        }
        const { token } = (await response.json()) as { token: string };
        set({ token, screen: "menu", errorIt: null });
      } catch (error) {
        set({
          errorIt:
            error instanceof Error
              ? error.message
              : "Il servizio non è disponibile.",
        });
      }
    },

    continueAsGuest: () => set({ screen: "menu", token: null, errorIt: null }),
    goToSetup: () => set({ screen: "setup", errorIt: null }),

    startGame: (mayorName) => {
      const name = mayorName.trim();
      if (!name) {
        set({ errorIt: "Inserisci il nome del sindaco." });
        return;
      }
      set({
        screen: "game",
        state: createInitialGameState({ mayorName: name }),
        runId: get().token ? crypto.randomUUID() : null,
        mapUrl: null,
        errorIt: null,
      });
    },

    startProject: (templateId) => {
      const state = get().state;
      if (state) apply(startProjectAction(state, templateId));
    },
    hireStaff: (role) => {
      const state = get().state;
      if (state) apply(hireStaffAction(state, role));
    },
    fireStaff: (role) => {
      const state = get().state;
      if (state) apply(fireStaffAction(state, role));
    },
    requestProvinceFunds: (amount) => {
      const state = get().state;
      if (state) apply(requestProvinceFundsAction(state, amount));
    },
    issuePressRelease: (tone) => {
      const state = get().state;
      if (state) apply(issuePressReleaseAction(state, tone));
    },
    respondToRival: (choice) => {
      const state = get().state;
      if (state) apply(respondToRivalAction(state, choice));
    },

    closeMonth: async () => {
      const current = get().state;
      if (!current || get().mapJobPending) return;
      set({ mapJobPending: true });
      try {
        const next = advanceMonth(current);
        set({
          state: next,
          screen: next.status === "playing" ? "game" : "gameover",
          errorIt: null,
        });

        const { token, runId } = get();
        if (!token || !runId) return;

        const saveResponse = await fetch(
          `/api/saves/${encodeURIComponent(runId)}`,
          {
            method: "PUT",
            headers: authorization(token),
            body: JSON.stringify(next),
          },
        );
        if (!saveResponse.ok) throw new Error("Salvataggio non riuscito.");
        localStorage.setItem(LAST_RUN_ID_KEY, runId);
        if (!next.overlay.dirty) return;

        const jobResponse = await fetch(
          `/api/runs/${encodeURIComponent(runId)}/map-jobs`,
          {
            method: "POST",
            headers: authorization(token),
            body: JSON.stringify({
              comuneId: next.comuneId,
              runId,
              overlaySlots: next.overlay.activeSlots,
              basemapRevision: "v0",
            }),
          },
        );
        if (!jobResponse.ok && jobResponse.status !== 409) {
          throw new Error("Aggiornamento della mappa non avviato.");
        }

        for (let attempt = 0; attempt < 20; attempt += 1) {
          const mapResponse = await fetch(
            `/api/runs/${encodeURIComponent(runId)}/map`,
            { headers: authorization(token) },
          );
          if (mapResponse.status === 200) {
            const mapVersion = Number(
              mapResponse.headers.get("x-map-version") ?? 0,
            );
            const oldUrl = get().mapUrl;
            const mapUrl = URL.createObjectURL(await mapResponse.blob());
            if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
            set((store) => ({
              mapUrl,
              state:
                store.state && mapVersion > store.state.overlay.mapVersion
                  ? {
                      ...store.state,
                      overlay: {
                        ...store.state.overlay,
                        dirty: false,
                        mapVersion,
                      },
                    }
                  : store.state,
            }));
            return;
          }
          if (mapResponse.status !== 202) {
            throw new Error("Mappa non disponibile.");
          }
          const status = (await mapResponse.json()) as { status?: string };
          if (status.status === "failed") {
            throw new Error("Generazione della mappa non riuscita.");
          }
          await pause(750);
        }
        throw new Error("La mappa richiede più tempo del previsto.");
      } catch (error) {
        set({
          errorIt:
            error instanceof Error ? error.message : "Operazione non riuscita.",
        });
      } finally {
        set({ mapJobPending: false });
      }
    },

    resumeGame: async () => {
      const { token } = get();
      const runId = localStorage.getItem(LAST_RUN_ID_KEY);
      if (!token || !runId) return;
      set({ errorIt: null });
      try {
        const response = await fetch(
          `/api/saves/${encodeURIComponent(runId)}`,
          { headers: authorization(token) },
        );
        if (!response.ok) throw new Error("Salvataggio non disponibile.");
        const saved = (await response.json()) as {
          runId: string;
          state: GameState;
        };
        revokeMapUrl(get().mapUrl);
        set({
          screen: saved.state.status === "playing" ? "game" : "gameover",
          state: saved.state,
          runId: saved.runId,
          mapUrl: null,
          errorIt: null,
        });
      } catch (error) {
        set({
          errorIt:
            error instanceof Error ? error.message : "Operazione non riuscita.",
        });
      }
    },

    returnToMenu: () => {
      revokeMapUrl(get().mapUrl);
      set({
        screen: "menu",
        state: null,
        runId: null,
        mapUrl: null,
        mapJobPending: false,
        errorIt: null,
      });
    },
    reset: () => {
      revokeMapUrl(get().mapUrl);
      set(initialState);
    },
  };
});
