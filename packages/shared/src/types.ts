export type StaffRole = "secretary" | "technician" | "communicator";

export type ProjectTemplateId = "youth_space" | "road_fix" | "school_wing";

export type MapSlotId = "centro" | "zona_nord" | "viabilita_est";

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

export interface GameState {
  comuneId: "069084";
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
}

export interface NewGameOptions {
  mayorName: string;
  seed?: number;
}
