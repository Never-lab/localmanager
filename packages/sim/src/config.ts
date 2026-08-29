import type { StaffRole } from "@localmanager/shared";

export const MANDATE_MONTHS = 48 as const;
export const RIVAL_INTERVAL_MONTHS = 6;
export const RIVAL_HEAT_GAIN = 8;
export const PROVINCE_SUCCESS_CHANCE = 0.55;
export const MEAN_AGE_MONTHLY_DRIFT = 0.01;
export const POPULATION_NOISE_RANGE = 1;
export const INITIAL_PEOPLE_REP = 50;
export const INITIAL_POLITICAL_REP = 50;
export const INITIAL_RIVAL_HEAT = 35;
export const RNG_MULTIPLIER = 1664525;
export const RNG_INCREMENT = 1013904223;
export const RNG_MODULUS = 0x1_0000_0000;

export const CLAMP = (value: number, low = 0, high = 100): number =>
  Math.max(low, Math.min(high, value));

export const STAFF_COSTS: Record<StaffRole, number> = {
  secretary: 2800,
  technician: 3200,
  communicator: 2600,
};
