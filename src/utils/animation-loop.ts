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
 *   // time ≈ performance.now() at frame start
 *   // delta ≈ ms since last frame (~16 at 60fps)
 *   updateMyAnimation(time, delta);
 * });
 *
 * // later, to stop:
 * unregister();
 * ```
 */

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
  for (const e of entries) {
    e.fn(now, delta);
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
