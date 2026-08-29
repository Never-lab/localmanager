import { useState, type FormEvent, type ReactNode } from "react";
import type {
  MapSlotId,
  ProjectTemplateId,
  StaffRole,
} from "@localmanager/shared";
import { LAST_RUN_ID_KEY, useGameStore } from "./store/gameStore";
import { canCloseMonth, electionForecast } from "@localmanager/sim";
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

const projects: Array<{
  id: ProjectTemplateId;
  name: string;
  cost: number;
  months: number;
}> = [
  { id: "youth_space", name: "Spazio giovani", cost: 120_000, months: 4 },
  { id: "road_fix", name: "Sistemazione viabilità", cost: 200_000, months: 5 },
  { id: "school_wing", name: "Ala scolastica", cost: 280_000, months: 8 },
];

const roleNames: Record<StaffRole, string> = {
  secretary: "Segretario comunale",
  technician: "Tecnico",
  communicator: "Addetto stampa",
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
        <p className="eyebrow">Comune di Santa Maria Imbaro</p>
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
        <h1>Governa un piccolo Comune abruzzese</h1>
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    startGame(name);
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
          <fieldset>
            <legend>Comune assegnato</legend>
            <label className="municipality-choice">
              <input type="radio" checked readOnly />
              <span>
                <strong>Santa Maria Imbaro</strong>
                <small>Provincia di Chieti · codice ISTAT 069084</small>
              </span>
            </label>
          </fieldset>
          {error && <p className="error-note">{error}</p>}
          <button className="primary" type="submit">
            <Icon name="building" weight="bold" size={18} />
            Apri il municipio
          </button>
        </form>
      </section>
    </Frame>
  );
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
  const pending = useGameStore((store) => store.mapJobPending);
  return (
    <section className="panel">
      <header className="panel-head">
        <PanelTitle icon="map">Mappa degli interventi</PanelTitle>
        <span className={`map-status ${pending ? "pending" : ""}`}>
          {pending
            ? "Aggiornamento in corso"
            : state.overlay.dirty
              ? "Aggiornamento mappa disponibile online"
              : `Mappa v${state.overlay.mapVersion}`}
        </span>
      </header>
      <div className="map-stage">
        <img
          src={mapUrl ?? "/maps/smi-basemap.png"}
          alt="Mappa di Santa Maria Imbaro"
        />
        {!mapUrl && (
          <svg viewBox="0 0 100 100" aria-label="Interventi completati">
            {state.overlay.activeSlots.map((slot) => {
              const [cx, cy] = slotPositions[slot];
              return (
                <g key={slot}>
                  <circle className="map-pulse" cx={cx} cy={cy} r="5.5" />
                  <circle className="map-dot" cx={cx} cy={cy} r="2.5" />
                </g>
              );
            })}
          </svg>
        )}
        <div className="map-legend">
          <span />
          Intervento completato
        </div>
      </div>
    </section>
  );
}

function GameScreen() {
  const state = useGameStore((store) => store.state)!;
  const pending = useGameStore((store) => store.mapJobPending);
  const error = useGameStore((store) => store.errorIt);
  const {
    startProject,
    hireStaff,
    fireStaff,
    requestProvinceFunds,
    issuePressRelease,
    resolveEvent,
    closeMonth,
  } = useGameStore.getState();
  const forecast = electionForecast(state);
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
          <p className="eyebrow">Comune di Santa Maria Imbaro</p>
          <h1>Scrivania del sindaco</h1>
        </div>
        <div className="sticky-actions">
          <div className="sticky-meta">
            <span>Mandato di {state.mayorName}</span>
            <p className="cash">{money.format(state.cash)}</p>
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

          {error && <p className="error-banner">{error}</p>}

          <div className="work-grid">
            <section className="panel projects">
              <div className="panel-head">
                <PanelTitle icon="document">Fascicoli dei progetti</PanelTitle>
                <span className="panel-head-meta">
                  {state.activeProjects.length} in corso
                </span>
              </div>
              {projects.map((project) => {
                const disabled = state.cash < project.cost;
                return (
                  <div className="deal-row" key={project.id}>
                    <div>
                      <strong>{project.name}</strong>
                      <span>
                        {money.format(project.cost)} · {project.months} mesi
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      title={
                        disabled
                          ? "Non c'è abbastanza cassa: attendi nuove entrate o chiedi fondi."
                          : `Avvia ${project.name}`
                      }
                      onClick={() => startProject(project.id)}
                    >
                      <Icon name="play" size={16} />
                      Avvia {project.name}
                    </button>
                  </div>
                );
              })}
              {state.activeProjects.map((project) => (
                <p
                  className="active-file"
                  key={`${project.templateId}-${project.slotId}`}
                >
                  {projects.find((item) => item.id === project.templateId)?.name}
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
                    <span>{money.format(member.monthlyCost)}/mese</span>
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
                  onClick={() => issuePressRelease("people")}
                >
                  <Icon name="megaphone" size={16} />
                  Comunicato ai cittadini
                </button>
                <button
                  type="button"
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
          <section className="panel">
            <div className="panel-head">
              <PanelTitle icon="wallet">Cassa</PanelTitle>
            </div>
            <p className="cash">{money.format(state.cash)}</p>
            <span className="eyebrow">Disponibile</span>
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
