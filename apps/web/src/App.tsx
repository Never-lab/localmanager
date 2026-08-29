import { useState, type FormEvent, type ReactNode } from "react";
import type {
  MapSlotId,
  StaffRole,
} from "@localmanager/shared";
import { LAST_RUN_ID_KEY, useGameStore, type ComuneSeedPayload } from "./store/gameStore";
import { canCloseMonth, electionForecast, firstWinProgress, forecastMonthCash, nextObjectives, TECHNICIAN_MONTH_CUT } from "@localmanager/sim";
import { Icon, type IconName } from "./ui/Icon";
import {
  loadThemePref,
  saveThemePref,
  type Theme,
} from "./ui/theme";
import "./styles.css";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const roleNames: Record<StaffRole, string> = {
  secretary: "Segretario comunale",
  technician: "Tecnico",
  communicator: "Addetto stampa",
};

const roleHints: Record<StaffRole, string> = {
  secretary: "Coordina l'ufficio",
  technician: "Nuove opere −1 mese",
  communicator: "Comunicati più efficaci",
};

const forecastLabels = {
  ahead: "in vantaggio",
  toss_up: "in bilico",
  behind: "in ritardo",
} as const;

const slotPositions: Record<MapSlotId, [number, number]> = {
  centro: [47, 53],
  zona_nord: [44, 28],
  viabilita_est: [69, 58],
};

const THEME_CYCLE: Theme[] = ["system", "light", "dark"];
const THEME_LABELS: Record<Theme, string> = {
  light: "Chiaro",
  dark: "Scuro",
  system: "Sistema",
};

function ThemeToggle() {
  const [pref, setPref] = useState<Theme>(loadThemePref);
  const cycle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(pref) + 1) % THEME_CYCLE.length];
    saveThemePref(next);
    setPref(next);
  };
  const resolved =
    pref === "dark" ||
    (pref === "system" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button type="button" className="theme-toggle" onClick={cycle}>
      <Icon name={resolved ? "sun" : "moon"} size={18} />
      {THEME_LABELS[pref]}
    </button>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell">
      {children}
      <footer>
        Modello educativo semplificato: dati e risultati non rappresentano
        previsioni ufficiali del Comune.
      </footer>
    </main>
  );
}

function PanelTitle({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <h2 className="panel-title">
      <Icon name={icon} size={16} />
      {children}
    </h2>
  );
}

function AuthScreen() {
  const authenticate = useGameStore((store) => store.authenticate);
  const continueAsGuest = useGameStore((store) => store.continueAsGuest);
  const error = useGameStore((store) => store.errorIt);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void authenticate(mode, email, password);
  };

  return (
    <Frame>
      <section className="shell-entry">
        <div className="theme-row">
          <ThemeToggle />
        </div>
        <p className="brand-mark">LocalManager</p>
        <p className="eyebrow">Simulatore di amministrazione comunale</p>
        <h1>Entra in municipio</h1>
        <p className="lead">
          Quarantotto mesi per amministrare risorse, consenso e territorio.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="error-note">{error}</p>}
          <button className="primary" type="submit">
            <Icon name="login" weight="bold" size={18} />
            {mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>
        <button
          className="ghost"
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Non hai un account? Registrati"
            : "Hai già un account? Accedi"}
        </button>
        <div className="or-rule">oppure</div>
        <div className="cta-stack">
          <button className="secondary" type="button" onClick={continueAsGuest}>
            <Icon name="guest" weight="bold" size={18} />
            Continua come ospite
          </button>
        </div>
        <p className="small-note">
          In modalità ospite la partita resta su questo dispositivo.
        </p>
      </section>
    </Frame>
  );
}

function MenuScreen() {
  const token = useGameStore((store) => store.token);
  const goToSetup = useGameStore((store) => store.goToSetup);
  const resumeGame = useGameStore((store) => store.resumeGame);
  const reset = useGameStore((store) => store.reset);
  const error = useGameStore((store) => store.errorIt);
  const savedRunId = token ? localStorage.getItem(LAST_RUN_ID_KEY) : null;
  return (
    <Frame>
      <section className="shell-entry">
        <div className="theme-row">
          <ThemeToggle />
        </div>
        <p className="brand-mark">LocalManager</p>
        <p className="eyebrow">Palazzo comunale</p>
        <h1>Governa un Comune italiano</h1>
        <p className="lead">un mese alla volta.</p>
        <div className="cta-stack">
          <button className="primary large" type="button" onClick={goToSetup}>
            <Icon name="play" weight="bold" size={18} />
            Nuovo mandato
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!token || !savedRunId}
            title={
              !token
                ? "Accedi per usare i salvataggi online."
                : savedRunId
                  ? "Riprendi il salvataggio online."
                  : "Nessun salvataggio online disponibile su questo dispositivo."
            }
            onClick={() => void resumeGame()}
          >
            <Icon name="clipboard" weight="bold" size={18} />
            Riprendi partita
          </button>
        </div>
        {error && <p className="error-note">{error}</p>}
        <div className="nav-links">
          <button className="nav-link" type="button" onClick={reset}>
            <Icon name="logout" size={20} />
            {token ? "Esci dall'account" : "Torna all'accesso"}
          </button>
        </div>
      </section>
    </Frame>
  );
}

function SetupScreen() {
  const startGame = useGameStore((store) => store.startGame);
  const error = useGameStore((store) => store.errorIt);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("Santa Maria Imbaro");
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string;
      province: string | null;
      region: string | null;
    }>
  >([]);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    province: string | null;
    region: string | null;
  } | null>(null);
  const [hydrateStatus, setHydrateStatus] = useState<string | null>(null);
  const [seed, setSeed] = useState<ComuneSeedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/comuni?q=${encodeURIComponent(q.trim())}&limit=20`,
      );
      if (!response.ok) throw new Error("Catalogo non disponibile.");
      const data = (await response.json()) as {
        items: Array<{
          id: string;
          name: string;
          province: string | null;
          region: string | null;
        }>;
      };
      setResults(data.items);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Ricerca comuni fallita.",
      );
    }
  };

  const hydrate = async () => {
    if (!selected) {
      setLocalError("Seleziona un comune dalla lista.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    setSeed(null);
    setHydrateStatus("queued");
    try {
      const start = await fetch(
        `/api/comuni/${encodeURIComponent(selected.id)}/hydrate`,
        { method: "POST" },
      );
      if (!start.ok) throw new Error("Impossibile avviare il caricamento dati.");
      const started = (await start.json()) as {
        jobId: string;
        status: string;
        seed?: {
          comuneId: string;
          name: string;
          province: string | null;
          region: string | null;
          population: number;
          meanAge: number;
          budget: {
            openingCash: number;
            openingDebt?: number;
            monthlyBaseIncome: number;
            monthlyMaintenance: number;
            sourceYear: number;
          };
          projects: ComuneSeedPayload["projects"];
          sources: string[];
          map: ComuneSeedPayload["map"];
        };
      };
      if (started.status === "ready" && started.seed) {
        if (!started.seed.map) {
          throw new Error(
            "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
          );
        }
        setSeed(toPayload(started.seed));
        setHydrateStatus("ready");
        return;
      }
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const poll = await fetch(
          `/api/comuni/hydrate/${encodeURIComponent(started.jobId)}`,
        );
        if (!poll.ok) throw new Error("Stato caricamento non disponibile.");
        const job = (await poll.json()) as {
          status: string;
          errorIt?: string;
          seed?: typeof started.seed;
        };
        setHydrateStatus(job.status);
        if (job.status === "ready" && job.seed) {
          if (!job.seed.map) {
            throw new Error(
              "Geolocalizzazione non disponibile. Riprova o scegli un altro comune.",
            );
          }
          setSeed(toPayload(job.seed));
          return;
        }
        if (job.status === "failed") {
          throw new Error(
            job.errorIt ??
              "Dati ufficiali non disponibili per questo comune.",
          );
        }
      }
      throw new Error(
        "Il caricamento richiede troppo tempo. Riprova più tardi.",
      );
    } catch (err) {
      setHydrateStatus("failed");
      setLocalError(
        err instanceof Error ? err.message : "Caricamento dati fallito.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!seed) {
      setLocalError(
        "Carica prima i dati ufficiali del comune (bilancio e progetti).",
      );
      return;
    }
    startGame(name, seed);
  };

  return (
    <Frame>
      <section className="shell-entry">
        <div className="theme-row">
          <ThemeToggle />
        </div>
        <p className="eyebrow">Insediamento</p>
        <h1>Prepara la fascia tricolore</h1>
        <form onSubmit={submit}>
          <label>
            Nome del sindaco
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Ada Rossi"
            />
          </label>
          <label>
            Cerca comune
            <input
              value={query}
              onChange={(event) => void search(event.target.value)}
              placeholder="Nome o codice ISTAT"
            />
          </label>
          <fieldset>
            <legend>Comune</legend>
            {results.map((item) => (
              <label className="municipality-choice" key={item.id}>
                <input
                  type="radio"
                  name="comune"
                  checked={selected?.id === item.id}
                  onChange={() => {
                    setSelected(item);
                    setSeed(null);
                    setHydrateStatus(null);
                  }}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {[item.province, item.region, `ISTAT ${item.id}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </label>
            ))}
            {!results.length && (
              <p className="close-hint">
                Digita almeno 2 caratteri per cercare tra i comuni ISTAT.
              </p>
            )}
          </fieldset>
          <button
            className="secondary"
            type="button"
            disabled={!selected || busy}
            title={
              !selected
                ? "Seleziona un comune prima di caricare i dati."
                : "Scarica bilancio BDAP (e progetti OpenCUP se configurato) per questo comune."
            }
            onClick={() => void hydrate()}
          >
            <Icon name="document" weight="bold" size={18} />
            {busy
              ? `Caricamento… (${hydrateStatus ?? "queued"})`
              : "Carica dati ufficiali"}
          </button>
          {seed && (
            <p className="close-hint">
              Pronto: bilancio {seed.sourceYear ?? "n/d"}, {seed.projects.length}{" "}
              progetti · pop. {seed.population.toLocaleString("it-IT")}
            </p>
          )}
          {(localError || error) && (
            <p className="error-note">{localError ?? error}</p>
          )}
          <button className="primary" type="submit" disabled={!seed || busy}>
            <Icon name="building" weight="bold" size={18} />
            Apri il municipio
          </button>
        </form>
      </section>
    </Frame>
  );
}

function toPayload(seed: {
  comuneId: string;
  name: string;
  province: string | null;
  region: string | null;
  population: number;
  meanAge: number;
  budget: {
    openingCash: number;
    openingDebt?: number;
    monthlyBaseIncome: number;
    monthlyMaintenance: number;
    sourceYear: number;
  };
  projects: ComuneSeedPayload["projects"];
  sources: string[];
  map: ComuneSeedPayload["map"];
}): ComuneSeedPayload {
  return {
    comuneId: seed.comuneId,
    name: seed.name,
    province: seed.province,
    region: seed.region,
    population: seed.population,
    meanAge: seed.meanAge,
    openingCash: seed.budget.openingCash,
    openingDebt: seed.budget.openingDebt ?? 0,
    monthlyBaseIncome: seed.budget.monthlyBaseIncome,
    monthlyMaintenance: seed.budget.monthlyMaintenance,
    sourceYear: seed.budget.sourceYear,
    sources: seed.sources,
    projects: seed.projects,
    map: seed.map,
  };
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{Math.round(value)}/100</strong>
      </div>
      <progress max="100" value={value} aria-label={label} />
    </div>
  );
}

function MapPanel() {
  const state = useGameStore((store) => store.state)!;
  const mapUrl = useGameStore((store) => store.mapUrl);
  const token = useGameStore((store) => store.token);
  const pending = useGameStore((store) => store.mapJobPending);
  const error = useGameStore((store) => store.errorIt);
  const retryMap = useGameStore((store) => store.retryMap);
  const showRetry =
    Boolean(error) &&
    /mappa/i.test(error ?? "") &&
    !pending &&
    Boolean(token);
  // Account: niente fallback SMI (sarebbe il comune sbagliato). Guest: PNG statico.
  const imgSrc = mapUrl ?? (token ? null : "/maps/smi-basemap.png");
  return (
    <section className="panel">
      <header className="panel-head">
        <PanelTitle icon="map">Mappa degli interventi</PanelTitle>
        <span className={`map-status ${pending ? "pending" : ""}`}>
          {pending && !mapUrl
            ? "Generazione mappa del comune…"
            : pending
              ? "Aggiornamento in corso"
              : state.overlay.dirty
                ? "Aggiornamento mappa disponibile online"
                : `Mappa v${state.overlay.mapVersion}`}
        </span>
      </header>
      <div className="map-stage">
        {imgSrc ? (
          <img src={imgSrc} alt={`Mappa di ${state.comuneName}`} />
        ) : (
          <div
            className="map-placeholder"
            role="img"
            aria-label={`Mappa di ${state.comuneName} in caricamento`}
          />
        )}
        {!mapUrl && !token && (
          <svg viewBox="0 0 100 100" aria-label="Interventi completati">
            {state.overlay.activeSlots.map((slot) => {
              const [cx, cy] = slotPositions[slot];
              return (
                <g key={slot}>
                  <circle className="map-pulse" cx={cx} cy={cy} r="2.2" />
                  <circle className="map-dot" cx={cx} cy={cy} r="1.1" />
                </g>
              );
            })}
          </svg>
        )}
        <div className="map-legend">
          <span />
          Intervento completato
        </div>
        {showRetry && (
          <button type="button" className="ghost" onClick={() => void retryMap()}>
            Riprova mappa
          </button>
        )}
      </div>
    </section>
  );
}

function GameScreen() {
  const state = useGameStore((store) => store.state)!;
  const pending = useGameStore((store) => store.mapJobPending);
  const error = useGameStore((store) => store.errorIt);
  const toast = useGameStore((store) => store.toastIt);
  const {
    startProject,
    hireStaff,
    fireStaff,
    requestProvinceFunds,
    issuePressRelease,
    resolveEvent,
    closeMonth,
    dismissToast,
  } = useGameStore.getState();
  const forecast = electionForecast(state);
  const cashForecast = forecastMonthCash(state);
  const firstWin = firstWinProgress(state);
  const objectives = nextObjectives(state, 3);
  const cashHint =
    cashForecast.net < 0
      ? state.staff.some((m) => m.hired)
        ? "Congeda personale o chiedi fondi alla Provincia"
        : "Chiedi fondi alla Provincia (esito in ~2 mesi)"
      : null;
  const monthClosable = canCloseMonth(state);
  const closeBlockedReason = pending
    ? "Attendi il completamento della mappa prima di proseguire."
    : !monthClosable
      ? "Risolvi prima gli eventi in coda."
      : "Chiudi il mese corrente.";

  return (
    <Frame>
      <header className="sticky">
        <div>
          <p className="eyebrow">Comune di {state.comuneName}</p>
          <h1>Scrivania del sindaco</h1>
        </div>
        <div className="sticky-actions">
          <div className="sticky-meta">
            <span>Mandato di {state.mayorName}</span>
            <p className="cash">{money.format(state.cash)}</p>
            {state.debt > 0 && (
              <span className="eyebrow">Debito {money.format(state.debt)}</span>
            )}
            <span>
              Mese {state.month} / {state.mandateMonths}
            </span>
            <span className="chip">
              <Icon name="calendar" size={12} />
              {forecastLabels[forecast.band]} (
              {forecast.margin > 0 ? "+" : ""}
              {Math.round(forecast.margin)})
            </span>
          </div>
          <ThemeToggle />
          <div className="close-stack">
            <button
              className="primary large"
              type="button"
              disabled={pending || !monthClosable}
              title={closeBlockedReason}
              onClick={() => void closeMonth()}
            >
              <Icon name="calendar" weight="bold" size={18} />
              {pending ? "Aggiorno la mappa…" : "Chiudi mese"}
            </button>
            {(pending || !monthClosable) && (
              <p className="close-hint">{closeBlockedReason}</p>
            )}
          </div>
        </div>
      </header>

      <div className="desk-body">
        <div className="desk-main">
          <MapPanel />

          {toast && (
            <p className="toast-banner" role="status">
              <span>{toast}</span>
              <button type="button" className="ghost" onClick={dismissToast}>
                Chiudi
              </button>
            </p>
          )}
          {error && <p className="error-banner">{error}</p>}

          <div className="work-grid">
            <section className="panel projects">
              <div className="panel-head">
                <PanelTitle icon="document">Fascicoli dei progetti</PanelTitle>
                <span className="panel-head-meta">
                  {state.activeProjects.length} in corso
                </span>
              </div>
              {state.comune.projects.map((project) => {
                const disabled = state.cash < project.cost;
                const hasTechnician = state.staff.some(
                  (member) => member.role === "technician" && member.hired,
                );
                const months = hasTechnician
                  ? Math.max(1, project.months - TECHNICIAN_MONTH_CUT)
                  : project.months;
                return (
                  <div className="deal-row" key={project.templateId}>
                    <div>
                      <strong>{project.nameIt}</strong>
                      <span>
                        {money.format(project.cost)} · {months} mesi
                        {hasTechnician ? " (tecnico)" : ""} · cittadini +
                        {project.effects.peopleRep} · politica +
                        {project.effects.politicalRep}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      title={
                        disabled
                          ? "Non c'è abbastanza cassa: attendi nuove entrate o chiedi fondi."
                          : `Avvia ${project.nameIt}`
                      }
                      onClick={() => startProject(project.templateId)}
                    >
                      <Icon name="play" size={16} />
                      Avvia {project.nameIt}
                    </button>
                  </div>
                );
              })}
              {state.activeProjects.map((project) => (
                <p
                  className="active-file"
                  key={`${project.templateId}-${project.slotId}`}
                >
                  {state.comune.projects.find(
                    (item) => item.templateId === project.templateId,
                  )?.nameIt}
                  : restano {project.monthsRemaining} mesi
                </p>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head">
                <PanelTitle icon="people">Personale</PanelTitle>
              </div>
              {state.staff.map((member) => (
                <div className="deal-row" key={member.role}>
                  <div>
                    <strong>{roleNames[member.role]}</strong>
                    <span>
                      {money.format(member.monthlyCost)}/mese ·{" "}
                      {roleHints[member.role]}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={member.hired ? "quiet-danger" : ""}
                    onClick={() =>
                      member.hired
                        ? fireStaff(member.role)
                        : hireStaff(member.role)
                    }
                  >
                    <Icon name={member.hired ? "guest" : "userPlus"} size={16} />
                    {member.hired ? "Congeda" : "Assumi"}
                  </button>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head">
                <PanelTitle icon="megaphone">Provincia e stampa</PanelTitle>
              </div>
              <div className="button-stack">
                <button
                  type="button"
                  disabled={Boolean(state.provinceRequest)}
                  title={
                    state.provinceRequest
                      ? "Una richiesta è già in esame: attendi la risposta."
                      : "Richiedi un contributo di € 100.000 alla Provincia."
                  }
                  onClick={() => requestProvinceFunds(100_000)}
                >
                  <Icon name="money" size={16} />
                  Chiedi fondi alla Provincia
                </button>
                <button
                  type="button"
                  disabled={state.pressUsedThisMonth}
                  title={
                    state.pressUsedThisMonth
                      ? "Hai già emesso un comunicato questo mese. Chiudi il mese per ripubblicare."
                      : "Un comunicato al mese: rafforza i cittadini (−politica)."
                  }
                  onClick={() => issuePressRelease("people")}
                >
                  <Icon name="megaphone" size={16} />
                  Comunicato ai cittadini
                </button>
                <button
                  type="button"
                  disabled={state.pressUsedThisMonth}
                  title={
                    state.pressUsedThisMonth
                      ? "Hai già emesso un comunicato questo mese. Chiudi il mese per ripubblicare."
                      : "Un comunicato al mese: rafforza la maggioranza (−cittadini)."
                  }
                  onClick={() => issuePressRelease("political")}
                >
                  <Icon name="document" size={16} />
                  Nota alla maggioranza
                </button>
              </div>
            </section>

            <section className="panel events-panel">
              <div className="panel-head">
                <PanelTitle icon="clipboard">Eventi</PanelTitle>
              </div>
              {state.pendingEvents.length === 0 ? (
                <p>Nessun evento da gestire — puoi chiudere il mese.</p>
              ) : (
                state.pendingEvents.map((event) => (
                  <div key={event.id} className="event-card">
                    <strong>{event.titleIt}</strong>
                    <p>{event.bodyIt}</p>
                    <div className="button-pair">
                      {event.choices.map((choice) => {
                        const needsCash =
                          choice.requiresCash !== undefined &&
                          state.cash < choice.requiresCash;
                        return (
                          <button
                            type="button"
                            key={choice.id}
                            disabled={needsCash}
                            title={
                              needsCash
                                ? `Servono almeno ${money.format(choice.requiresCash!)} in cassa.`
                                : choice.labelIt
                            }
                            onClick={() => resolveEvent(event.id, choice.id)}
                          >
                            {choice.labelIt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        </div>

        <aside className="desk-side">
          {objectives.length > 0 && (
            <section className="panel coach-panel">
              <div className="panel-head">
                <PanelTitle icon="clipboard">
                  {firstWin.complete ? "Obiettivi" : "Primi passi"}
                </PanelTitle>
              </div>
              <ol className="coach-list">
                {objectives.map((goal) => (
                  <li key={goal.id} data-done="0">
                    <span aria-hidden="true">○</span>
                    {goal.labelIt}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="panel">
            <div className="panel-head">
              <PanelTitle icon="wallet">Cassa</PanelTitle>
            </div>
            <p className="cash">{money.format(state.cash)}</p>
            <span className="eyebrow">Disponibile</span>
            {state.debt > 0 && (
              <>
                <p className="cash">{money.format(state.debt)}</p>
                <span className="eyebrow">Debito residuo</span>
              </>
            )}
            <div className="cash-forecast">
              <span className="eyebrow">Previsione mese</span>
              <ul>
                <li>
                  <span>Entrate base</span>
                  <strong>+{money.format(cashForecast.income)}</strong>
                </li>
                <li>
                  <span>Manutenzione</span>
                  <strong>−{money.format(cashForecast.maintenance)}</strong>
                </li>
                <li>
                  <span>Personale</span>
                  <strong>−{money.format(cashForecast.staffCost)}</strong>
                </li>
                <li>
                  <span>Rata mutuo</span>
                  <strong>−{money.format(cashForecast.debtService)}</strong>
                </li>
                <li className="cash-forecast-net">
                  <span>Netto previsto</span>
                  <strong>
                    {cashForecast.net >= 0 ? "+" : "−"}
                    {money.format(Math.abs(cashForecast.net))}
                  </strong>
                </li>
              </ul>
              {cashHint && <p className="close-hint">{cashHint}</p>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <PanelTitle icon="people">Clima del Comune</PanelTitle>
            </div>
            <Meter label="Fiducia dei cittadini" value={state.peopleRep} />
            <Meter label="Sostegno politico" value={state.politicalRep} />
            <Meter label="Pressione del rivale" value={state.rival.heat} />
          </section>
          <section className="panel facts">
            <div>
              <span>Residenti</span>
              <strong>{state.population.toLocaleString("it-IT")}</strong>
            </div>
            <div>
              <span>Età media</span>
              <strong>{state.meanAge.toFixed(1)}</strong>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <PanelTitle icon="clipboard">Registro di giunta</PanelTitle>
            </div>
            {state.log.length ? (
              <ol className="log-list">
                {[...state.log]
                  .reverse()
                  .slice(0, 6)
                  .map((entry, index) => (
                    <li key={`${entry.month}-${index}`}>
                      <span>Mese {entry.month}</span>
                      {entry.textIt}
                    </li>
                  ))}
              </ol>
            ) : (
              <p>Il registro è pronto per il primo mese di attività.</p>
            )}
          </section>
        </aside>
      </div>
    </Frame>
  );
}

function GameOverScreen() {
  const state = useGameStore((store) => store.state)!;
  const returnToMenu = useGameStore((store) => store.returnToMenu);
  const won = state.status === "won";
  return (
    <Frame>
      <section className="shell-entry">
        <p className="eyebrow">Elezioni comunali</p>
        <h1>{won ? "Mandato rinnovato" : "Il mandato termina qui"}</h1>
        <p className="lead">
          {won
            ? "La comunità conferma la fiducia nella tua amministrazione."
            : "Il rivale conquista il Comune. Ogni scelta ha lasciato una traccia."}
        </p>
        <div className="result-numbers">
          <span>Cittadini: {Math.round(state.peopleRep)}</span>
          <span>Politica: {Math.round(state.politicalRep)}</span>
          <span>Rivale: {Math.round(state.rival.heat)}</span>
        </div>
        <button className="primary" type="button" onClick={returnToMenu}>
          <Icon name="building" weight="bold" size={18} />
          Torna al municipio
        </button>
      </section>
    </Frame>
  );
}

export default function App() {
  const screen = useGameStore((store) => store.screen);
  if (screen === "auth") return <AuthScreen />;
  if (screen === "menu") return <MenuScreen />;
  if (screen === "setup") return <SetupScreen />;
  if (screen === "game") return <GameScreen />;
  return <GameOverScreen />;
}
