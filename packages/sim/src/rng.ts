import { RNG_INCREMENT, RNG_MODULUS, RNG_MULTIPLIER } from "./config.js";

export interface RandomResult {
  value: number;
  seed: number;
}

export function nextRandom(seed: number): RandomResult {
  const nextSeed = (Math.imul(seed, RNG_MULTIPLIER) + RNG_INCREMENT) >>> 0;
  return {
    value: nextSeed / RNG_MODULUS,
    seed: nextSeed,
  };
}
