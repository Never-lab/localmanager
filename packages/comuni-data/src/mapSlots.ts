import type { MapSlotDef } from "@localmanager/shared";

const OFFSETS: Array<{
  id: MapSlotDef["id"];
  labelIt: string;
  dLon: number;
  dLat: number;
  radiusM: number;
}> = [
  { id: "centro", labelIt: "Centro", dLon: 0, dLat: 0, radiusM: 120 },
  { id: "zona_nord", labelIt: "Zona nord", dLon: 0, dLat: 0.004, radiusM: 100 },
  {
    id: "viabilita_est",
    labelIt: "Viabilità est",
    dLon: 0.005,
    dLat: 0,
    radiusM: 140,
  },
];

/** Slot geografici deterministici intorno al centro del comune (stesso layout relativo ovunque). */
export function buildDefaultMapSlots(center: {
  lat: number;
  lon: number;
}): MapSlotDef[] {
  return OFFSETS.map((o) => ({
    id: o.id,
    labelIt: o.labelIt,
    lat: center.lat + o.dLat,
    lon: center.lon + o.dLon,
    radiusM: o.radiusM,
  }));
}
