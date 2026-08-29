export type StaffRole = "secretary" | "technician" | "communicator";

export type ProjectTemplateId = string;

export type MapSlotId = "centro" | "zona_nord" | "viabilita_est";

/** Slot geografico sul basemap (lat/lon assoluti). */
export interface MapSlotDef {
  id: MapSlotId;
  labelIt: string;
  lat: number;
  lon: number;
  radiusM: number;
}

/** Inquadramento stabile della mappa per una run. */
export interface MapGeo {
  osmQuery: string;
  center: { lat: number; lon: number };
  radiusM: number;
  basemapRevision: string;
  mapSlots: MapSlotDef[];
}

export interface StaffMember {
  role: StaffRole;
  hired: boolean;
  monthlyCost: number;
}

export interface ActiveProject {
  templateId: ProjectTemplateId;
  monthsRemaining: number;
  slotId: MapSlotId;
}

export interface CompletedProject {
  templateId: ProjectTemplateId;
  slotId: MapSlotId;
  completedMonth: number;
}

export interface RivalState {
  heat: number; // 0..100
  lastMoveMonth: number | null;
}

export interface EventEffects {
  cash?: number;
  peopleRep?: number;
  politicalRep?: number;
  rivalHeat?: number;
}

export interface PendingEventChoice {
  id: string;
  labelIt: string;
  effects: EventEffects;
  requiresCash?: number;
}

export interface PendingEvent {
  id: string;
  templateId: string;
  titleIt: string;
  bodyIt: string;
  choices: PendingEventChoice[];
}

export interface LogEntry {
  month: number;
  textIt: string;
}

export interface MapOverlay {
  activeSlots: MapSlotId[];
  dirty: boolean;
  mapVersion: number;
}

export interface ProvinceFundingRequest {
  amount: number;
  resolveMonth: number;
}

export interface ProjectTemplate {
  templateId: ProjectTemplateId;
  nameIt: string;
  cost: number;
  months: number;
  slotId: MapSlotId;
  effects: {
    population: number;
    meanAge: number;
    peopleRep: number;
    politicalRep: number;
  };
}

/** Snapshot of real open-data seed used for this run. */
export interface ComuneSeedSnapshot {
  comuneId: string;
  name: string;
  province: string | null;
  region: string | null;
  monthlyBaseIncome: number;
  monthlyMaintenance: number;
  projects: ProjectTemplate[];
  sourceYear: number | null;
  sources: string[];
  map: MapGeo;
}

export interface GameState {
  comuneId: string;
  comuneName: string;
  mayorName: string;
  month: number; // 1..48
  mandateMonths: 48;
  cash: number;
  population: number;
  meanAge: number;
  peopleRep: number; // 0..100
  politicalRep: number; // 0..100
  staff: StaffMember[];
  activeProjects: ActiveProject[];
  completedProjects: CompletedProject[];
  provinceRequest: ProvinceFundingRequest | null;
  pendingEvents: PendingEvent[];
  rival: RivalState;
  overlay: MapOverlay;
  log: LogEntry[];
  status: "playing" | "won" | "lost";
  seed: number;
  /** Real seed rates + project catalog for this mandate. */
  comune: ComuneSeedSnapshot;
}

export interface NewGameOptions {
  mayorName: string;
  seed?: number;
  /** Required for play outside sim unit tests; defaults to Santa Maria Imbaro fixture via loadComune(). */
  comuneSeed?: {
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
    projects: ProjectTemplate[];
    map: MapGeo;
  };
}
