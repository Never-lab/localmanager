import type { MapSlotDef } from "./types.js";

export interface MapJobInput {
  comuneId: string;
  runId: string;
  overlaySlots: string[];
  basemapRevision: string;
  osmQuery: string;
  center: { lat: number; lon: number };
  radiusM: number;
  mapSlots: MapSlotDef[];
}

export type MapJobStatus = "pending" | "running" | "ready" | "failed";

export interface MapJobRecord {
  id: string;
  runId: string;
  status: MapJobStatus;
  input: MapJobInput;
  artifactPath: string | null;
  mapVersion: number | null;
  error: string | null;
  attempts: number;
}

export interface SavePayload {
  runId: string;
  state: unknown; // GameState JSON
  updatedAt: string;
}

export interface HealthResponse {
  ok: true;
  storage: "postgres";
  maps?: "ok" | "down" | "unconfigured";
}
