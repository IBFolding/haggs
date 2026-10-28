/**
 * A seeded random source (mulberry32). The seed is the whole state, so a game
 * state that carries it can be replayed exactly, and tests are deterministic.
 */

export type Rng = { seed: number };

export function nextRandom(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A float in [lo, hi). */
export const between = (rng: Rng, lo: number, hi: number) => lo + nextRandom(rng) * (hi - lo);

/** A whole number in [0, n). */
export const pick = (rng: Rng, n: number) => Math.floor(nextRandom(rng) * n);
