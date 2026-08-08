/**
 * world — deterministic world clock + seeded PRNG.
 *
 * The scene simulates a PERSISTENT world. Every moving object's
 * position/shape is a pure function of the wall-clock time since a
 * fixed epoch — NOT of per-frame accumulated state. Refreshing the
 * page (or reopening it days later on another device) yields the
 * exact same world state at the same instant.
 *
 * ## Model
 *
 * ```
 * worldT = Date.now() - WORLD_EPOCH      // ms since epoch, monotonic
 * x(t)   = wrap(x0 + speed · t)          // position = pure fn of t
 * shape  = seededRng(SEED, generation)   // wrap cycles vary shape
 * ```
 *
 * Everything random is drawn from `seededRng` (deterministic per
 * seed + salt), never from `Math.random()`.
 */

/* ════════════ World clock ════════════ */

/** Fixed epoch — never change, or the whole world restarts. */
export const WORLD_EPOCH = Date.UTC(2026, 0, 1); // 2026-01-01T00:00:00Z

/** Current world time in milliseconds since the epoch. */
export function worldNow(): number {
  return Date.now() - WORLD_EPOCH;
}

/* ════════════ Deterministic PRNG ════════════ */

/** mulberry32 — tiny, fast, good-enough deterministic PRNG.
 *  Returns a function that yields floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → uint32. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Create a fresh seeded rng from a string seed + numeric salt.
 *
 * `seededRng('sea-world', k)` always returns the same sequence for
 * the same k — use the salt to give each entity an independent
 * deterministic stream (cloud 0, cloud 1, generation 0, gen 1, …).
 */
export function seededRng(seed: string, salt = 0): () => number {
  return mulberry32(hashString(`${seed}:${salt}`));
}

/** Deterministic integer in [0, n) from a hash, for time-bucket hashing. */
export function hashMod(str: string, n: number): number {
  return hashString(str) % n;
}

/* ════════════ Deterministic helpers ════════════ */

/** Wrap x into [0, span) — used for looping trajectories. */
export function wrap(x: number, span: number): number {
  const r = x % span;
  return r < 0 ? r + span : r;
}

/** Floor division — generation counter for looping entities. */
export function generation(x: number, span: number): number {
  return Math.floor(x / span);
}

/** Range helper on a seeded rng: float in [min, max). */
export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Int helper on a seeded rng: int in [min, max] inclusive. */
export function intRange(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
