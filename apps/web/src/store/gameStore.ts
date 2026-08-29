import type {
  GameState,
  MapGeo,
  ProjectTemplateId,
  StaffRole,
} from "@localmanager/shared";
import {
  advanceMonth,
  canCloseMonth,
  createInitialGameState,
  fireStaff as fireStaffAction,
  hireStaff as hireStaffAction,
  issuePressRelease as issuePressReleaseAction,
  requestProvinceFunds as requestProvinceFundsAction,
  resolveEvent as resolveEventAction,
  startProject as startProjectAction,
  type ActionResult,
} from "@localmanager/sim";
import { create } from "zustand";

export type Screen = "auth" | "menu" | "setup" | "game" | "gameover";

export interface ComuneSeedPayload {
  comuneId: string;
  name: string;
  province: string | null;
  region: string | null;
  population: number;
  meanAge: number;
  openingCash: number;
  monthlyBaseIncome: number;
  monthlyMaintenance: number;
  sourceYear: number | null;
  sources: string[];
  projects: GameState["comune"]["projects"];
  map: MapGeo;
}

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
  startGame: (mayorName: string, comuneSeed?: ComuneSeedPayload) => void;
  startProject: (templateId: ProjectTemplateId) => void;
  hireStaff: (role: StaffRole) => void;
  fireStaff: (role: StaffRole) => void;
  requestProvinceFunds: (amount: number) => void;
  issuePressRelease: (tone: "people" | "political") => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  closeMonth: () => Promise<void>;
  retryMap: () => Promise<void>;
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

/** Corpo job mappa con geo stabile dalla seed della run. */
export function buildMapJobBody(state: GameState, runId: string) {
  const { map } = state.comune;
  return {
    comuneId: state.comuneId,
    runId,
    overlaySlots: state.overlay.activeSlots,
    basemapRevision: map.basemapRevision,
    osmQuery: map.osmQuery,
    center: map.center,
    radiusM: map.radiusM,
    mapSlots: map.mapSlots,
  };
}

async function pollMapUntilReady(runId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const mapResponse = await fetch(
      `/api/runs/${encodeURIComponent(runId)}/map`,
      { headers: authorization(token) },
    );
    if (mapResponse.status === 200) {
      const mapVersion = Number(
        mapResponse.headers.get("x-map-version") ?? 0,
      );
      const oldUrl = useGameStore.getState().mapUrl;
      const mapUrl = URL.createObjectURL(await mapResponse.blob());
      if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
      useGameStore.setState((store) => ({
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
}

async function enqueueMapJob(
  state: GameState,
  runId: string,
  token: string,
): Promise<void> {
  const jobResponse = await fetch(
    `/api/runs/${encodeURIComponent(runId)}/map-jobs`,
    {
      method: "POST",
      headers: authorization(token),
      body: JSON.stringify(buildMapJobBody(state, runId)),
    },
  );
  if (!jobResponse.ok && jobResponse.status !== 409) {
    throw new Error("Aggiornamento della mappa non avviato.");
  }
  await pollMapUntilReady(runId, token);
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

    startGame: (mayorName, comuneSeed) => {
      const name = mayorName.trim();
      if (!name) {
        set({ errorIt: "Inserisci il nome del sindaco." });
        return;
      }
      if (!comuneSeed) {
        set({
          errorIt:
            "Carica prima i dati ufficiali del comune (bilancio e progetti).",
        });
        return;
      }
      if (!comuneSeed.map) {
        set({
          errorIt:
            "Manca la geolocalizzazione del comune. Ricarica i dati e riprova.",
        });
        return;
      }
      const state = createInitialGameState({ mayorName: name, comuneSeed });
      const token = get().token;
      const runId = token ? crypto.randomUUID() : null;
      set({
        screen: "game",
        state,
        runId,
        mapUrl: null,
        errorIt: null,
      });

      // Account online: salva run e genera basemap subito alla scelta comune.
      if (!token || !runId) return;
      void (async () => {
        set({ mapJobPending: true });
        try {
          const saveResponse = await fetch(
            `/api/saves/${encodeURIComponent(runId)}`,
            {
              method: "PUT",
              headers: authorization(token),
              body: JSON.stringify(state),
            },
          );
          if (!saveResponse.ok) throw new Error("Salvataggio non riuscito.");
          localStorage.setItem(LAST_RUN_ID_KEY, runId);
          await enqueueMapJob(state, runId, token);
        } catch (error) {
          set({
            errorIt:
              error instanceof Error
                ? error.message
                : "Generazione della mappa non riuscita.",
          });
        } finally {
          set({ mapJobPending: false });
        }
      })();
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
    resolveEvent: (eventId, choiceId) => {
      const state = get().state;
      if (state) apply(resolveEventAction(state, eventId, choiceId));
    },

    closeMonth: async () => {
      const current = get().state;
      if (!current || get().mapJobPending) return;
      if (!canCloseMonth(current)) {
        set({
          errorIt: "Risolvi prima gli eventi in coda.",
        });
        return;
      }
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

        await enqueueMapJob(next, runId, token);
      } catch (error) {
        set({
          errorIt:
            error instanceof Error ? error.message : "Operazione non riuscita.",
        });
      } finally {
        set({ mapJobPending: false });
      }
    },

    retryMap: async () => {
      const { state, token, runId, mapJobPending } = get();
      if (!state || !token || !runId || mapJobPending) return;
      set({ mapJobPending: true, errorIt: null });
      try {
        await enqueueMapJob(state, runId, token);
      } catch (error) {
        set({
          errorIt:
            error instanceof Error
              ? error.message
              : "Generazione della mappa non riuscita.",
        });
      } finally {
        set({ mapJobPending: false });
      }
    },

    resumeGame: async () => {
      const token = get().token;
      const runId = localStorage.getItem(LAST_RUN_ID_KEY);
      if (!token || !runId) {
        set({
          errorIt: token
            ? "Nessun salvataggio online su questo dispositivo."
            : "Accedi per riprendere una partita online.",
        });
        return;
      }
      try {
        const response = await fetch(`/api/saves/${encodeURIComponent(runId)}`, {
          headers: authorization(token),
        });
        if (!response.ok) throw new Error("Salvataggio non trovato.");
        const payload = (await response.json()) as {
          runId: string;
          state: GameState;
        };
        set({
          screen: "game",
          runId: payload.runId,
          state: payload.state,
          mapUrl: null,
          errorIt: null,
        });
      } catch (error) {
        set({
          errorIt:
            error instanceof Error
              ? error.message
              : "Impossibile riprendere la partita.",
        });
      }
    },

    returnToMenu: () => {
      const mapUrl = get().mapUrl;
      if (mapUrl?.startsWith("blob:")) URL.revokeObjectURL(mapUrl);
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
      const mapUrl = get().mapUrl;
      if (mapUrl?.startsWith("blob:")) URL.revokeObjectURL(mapUrl);
      set({ ...initialState });
    },
  };
});
