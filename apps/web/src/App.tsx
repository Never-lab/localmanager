import { useState, type FormEvent, type ReactNode } from "react";
import type {
  MapSlotId,
  ProjectTemplateId,
  StaffRole,
} from "@localmanager/shared";
import { useGameStore } from "./store/gameStore";
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

const slotPositions: Record<MapSlotId, [number, number]> = {
  centro: [47, 53],
  zona_nord: [44, 28],
  viabilita_est: [69, 58],
};

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
      <section className="entry-card">
        <div className="civic-mark" aria-hidden="true">
          LM
        </div>
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
            {mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Non hai un account? Registrati"
            : "Hai già un account? Accedi"}
        </button>
        <div className="or-rule">oppure</div>
        <button className="secondary" onClick={continueAsGuest}>
          Continua come ospite
        </button>
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
  const reset = useGameStore((store) => store.reset);
  return (
    <Frame>
      <section className="menu-card">
        <p className="eyebrow">Palazzo comunale</p>
        <h1>LocalManager</h1>
        <p className="lead">
          Governa un piccolo Comune abruzzese, un mese alla volta.
        </p>
        <button className="primary large" onClick={goToSetup}>
          Nuovo mandato
        </button>
        <button
          className="secondary"
          disabled={!token}
          title={
            token
              ? "Riprendi un salvataggio online"
              : "Accedi per usare i salvataggi online."
          }
        >
          Riprendi partita
        </button>
        <button className="text-button" onClick={reset}>
          {token ? "Esci dall'account" : "Torna all'accesso"}
        </button>
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
      <section className="setup-card">
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
    <section className="map-card">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Territorio</p>
          <h2>Mappa degli interventi</h2>
        </div>
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
    respondToRival,
    closeMonth,
  } = useGameStore.getState();

  return (
    <Frame>
      <header className="game-header">
        <div>
          <p className="eyebrow">Comune di Santa Maria Imbaro</p>
          <h1>Scrivania del sindaco</h1>
        </div>
        <div className="term">
          <span>Mandato di {state.mayorName}</span>
          <strong>
            Mese {state.month} / {state.mandateMonths}
          </strong>
        </div>
      </header>

      <div className="desk-layout">
        <MapPanel />
        <aside className="dashboard">
          <section className="paper-card treasury">
            <p className="eyebrow">Ragioneria</p>
            <h2>{money.format(state.cash)}</h2>
            <span>Cassa disponibile</span>
          </section>
          <section className="paper-card">
            <h3>Clima del Comune</h3>
            <Meter label="Fiducia dei cittadini" value={state.peopleRep} />
            <Meter label="Sostegno politico" value={state.politicalRep} />
            <Meter label="Pressione del rivale" value={state.rival.heat} />
          </section>
          <section className="paper-card facts">
            <div>
              <span>Residenti</span>
              <strong>{state.population.toLocaleString("it-IT")}</strong>
            </div>
            <div>
              <span>Età media</span>
              <strong>{state.meanAge.toFixed(1)}</strong>
            </div>
          </section>
        </aside>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <div className="work-grid">
        <section className="paper-card projects">
          <div className="section-title">
            <h2>Fascicoli dei progetti</h2>
            <span>{state.activeProjects.length} in corso</span>
          </div>
          {projects.map((project) => {
            const disabled = state.cash < project.cost;
            return (
              <div className="project-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span>
                    {money.format(project.cost)} · {project.months} mesi
                  </span>
                </div>
                <button
                  disabled={disabled}
                  title={
                    disabled
                      ? "Non c'è abbastanza cassa: attendi nuove entrate o chiedi fondi."
                      : `Avvia ${project.name}`
                  }
                  onClick={() => startProject(project.id)}
                >
                  Avvia {project.name}
                </button>
              </div>
            );
          })}
          {state.activeProjects.map((project) => (
            <p className="active-file" key={`${project.templateId}-${project.slotId}`}>
              {projects.find((item) => item.id === project.templateId)?.name}:
              restano {project.monthsRemaining} mesi
            </p>
          ))}
        </section>

        <section className="paper-card">
          <h2>Personale</h2>
          {state.staff.map((member) => (
            <div className="staff-row" key={member.role}>
              <div>
                <strong>{roleNames[member.role]}</strong>
                <span>{money.format(member.monthlyCost)}/mese</span>
              </div>
              <button
                className={member.hired ? "quiet-danger" : ""}
                onClick={() =>
                  member.hired
                    ? fireStaff(member.role)
                    : hireStaff(member.role)
                }
              >
                {member.hired ? "Congeda" : "Assumi"}
              </button>
            </div>
          ))}
        </section>

        <section className="paper-card">
          <h2>Provincia e stampa</h2>
          <div className="button-stack">
            <button
              disabled={Boolean(state.provinceRequest)}
              title={
                state.provinceRequest
                  ? "Una richiesta è già in esame: attendi la risposta."
                  : "Richiedi un contributo di € 100.000 alla Provincia."
              }
              onClick={() => requestProvinceFunds(100_000)}
            >
              Chiedi fondi alla Provincia
            </button>
            <button onClick={() => issuePressRelease("people")}>
              Comunicato ai cittadini
            </button>
            <button onClick={() => issuePressRelease("political")}>
              Nota alla maggioranza
            </button>
          </div>
        </section>

        <section className="paper-card rival-card">
          <h2>Opposizione</h2>
          <p>
            {state.rival.pendingEvent?.messageIt ??
              "Nessuna iniziativa pubblica del rivale questo mese."}
          </p>
          <div className="button-pair">
            <button
              disabled={!state.rival.pendingEvent}
              title={
                state.rival.pendingEvent
                  ? "Non rispondere all'attacco."
                  : "Nessun attacco da gestire: chiudi altri mesi."
              }
              onClick={() => respondToRival("ignore")}
            >
              Ignora
            </button>
            <button
              disabled={!state.rival.pendingEvent || state.cash < 5_000}
              title={
                !state.rival.pendingEvent
                  ? "Nessun attacco da gestire: chiudi altri mesi."
                  : state.cash < 5_000
                    ? "Servono almeno € 5.000 in cassa."
                    : "Replica pubblicamente al costo di € 5.000."
              }
              onClick={() => respondToRival("counter")}
            >
              Replica
            </button>
          </div>
        </section>
      </div>

      <section className="paper-card log-card">
        <h2>Registro di giunta</h2>
        {state.log.length ? (
          <ol>
            {[...state.log].reverse().slice(0, 6).map((entry, index) => (
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

      <div className="month-close">
        <div>
          <strong>Pronto per deliberare?</strong>
          <span>Entrate, costi e progetti avanzeranno di un mese.</span>
        </div>
        <button
          className="primary large"
          disabled={pending}
          title={
            pending
              ? "Attendi il completamento della mappa prima di proseguire."
              : "Chiudi il mese corrente."
          }
          onClick={() => void closeMonth()}
        >
          {pending ? "Aggiorno la mappa…" : "Chiudi mese"}
        </button>
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
      <section className="result-card">
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
        <button className="primary" onClick={returnToMenu}>
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
