/**
 * Shared animation loop — single `requestAnimationFrame` that any
 * module can register into, avoiding multiple independent rAF /
 * setInterval calls.
 *
 * Usage:
 * ```ts
 * import { register } from '../utils/animation-loop';
 *
 * const unregister = register((time, delta) => {
 *   // time ≈ world time (ms since WORLD_EPOCH) at frame start
 *   // delta ≈ ms since last frame (~16 at 60fps)
 *   updateMyAnimation(time, delta);
 * });
 *
 * // later, to stop:
 * unregister();
 * ```
 *
 * ## Time source
 *
 * The `time` argument is the WORLD CLOCK (see utils/world.ts), not
 * performance.now(). Every callback therefore receives a deterministic
 * value: refresh the page and the world resumes exactly where it was,
 * even across the idle-gate pauses below.
 */

import { worldNow } from './world';

/* ──────── Types ──────── */
type TickFn = (time: number, delta: number) => void;

interface Entry {
  fn: TickFn;
  id: symbol;
}

/* ──────── Internal state ──────── */
let entries: Entry[] = [];
let running = false;
let lastTime = 0;

/* ──────── Frame driver ──────── */
function frame(now: number): void {
  if (!running) return;
  const delta = lastTime ? now - lastTime : 16;
  lastTime = now;
  const w = worldNow();
  for (const e of entries) {
    e.fn(w, delta);
  }
  requestAnimationFrame(frame);
}

/* ──────── Public API ──────── */

/**
 * Register a function to be called every animation frame.
 * Returns an unregister function.
 */
export function register(fn: TickFn): () => void {
  const id = Symbol('anim-loop-entry');
  entries.push({ fn, id });
  if (!running) {
    running = true;
    lastTime = 0;
    requestAnimationFrame(frame);
  }
  return () => {
    entries = entries.filter(e => e.id !== id);
    if (entries.length === 0) {
      running = false;
    }
  };
}
