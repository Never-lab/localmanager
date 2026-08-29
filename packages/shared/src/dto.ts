export interface MapJobInput {
  comuneId: "069084";
  runId: string;
  overlaySlots: string[];
  basemapRevision: string;
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
