/**
 * Perspective — shared 1-point perspective math for the entire room.
 *
 * All objects (window sill, desk, sea horizon) should converge toward
 * the same vanishing point. That vanishing point is derived from the
 * window sill's known overhang ratio (1936/1786), then everything else
 * is computed from it.
 *
 * ## Usage
 *
 * ```ts
 * import { getStageGeom, narrowFrac, vpYtoWindowView } from '../utils/perspective';
 *
 * const g = getStageGeom();
 * const nf = narrowFrac(g.y17 - g.vpY, g.eltTop - g.vpY);
 * const seaTop = vpYtoWindowView(g.vpY, g);
 * ```
 */

/* ──────── Hard-coded geometry constants (from OpenWindow SVG) ──────── */
const SILL_BACK_W = 1936;  /* sill upper back edge width in viewBox */
const SILL_FRONT_W = 1786; /* sill upper front edge width in viewBox */
const SILL_RATIO = SILL_BACK_W / SILL_FRONT_W; /* ≈ 1.0840 */

/* Window glass mapping (OpenWindow viewBox 1786 × 964) */
const GLASS_TOP_VB = 45;
const GLASS_BOT_VB = 880;
const GLASS_H_VB = GLASS_BOT_VB - GLASS_TOP_VB; /* 835 */

/* Character geometry (Character_Standing.svg viewBox 453 × 1380) */
const CHAR_WRIST_FROM_BOTTOM = 0.4975; /* 1 − 693.478/1380 */

/* ──────── Derived VP formula ────────
   Sill derivation:
     SILL_RATIO = (sillBackY − vp) / (sillFrontY − vp)
                 = (winTop + winH × 939/964 − vp) /
                   (winTop + winH × 918/964 − vp)
   Solving for vp:
     vp = winTop + winH × (939 − 918 × SILL_RATIO) / (964 × (1 − SILL_RATIO))
         ≈ winTop + winH × 668.03 / 964

   But we express it in stage (viewport) coords as:
     vpY = innerH − charH × CHAR_WRIST_FROM_BOTTOM − winW × 295.97 / 1786
   (The 295.97 appears after expanding winTop = innerH − charH × 0.4975 − winH
    and winH = winW × 964/1786.)
*/
const VP_WIN_W_COEFF = 295.97; /* constant in the expanded VP formula */

/* ──────── Desk geometry ──────── */
const DESK_HEIGHT_FRAC = 0.42;     /* desk element height as fraction of charH */
const VB_Y17 = 17;                 /* viewBox y for upper-top front edge */
const VB_Y33 = 33;                 /* viewBox y for lower-middle front edge */
const VB_Y49 = 49;                 /* viewBox y for extension front edge (same depth as lower-mid) */

/* ──────── Types ──────── */
export interface StageGeom {
  /** Viewport inner height in px */
  innerH: number;
  /** Character element height in px */
  charH: number;
  /** Window element width in px */
  winW: number;
  /** Window element height in px */
  winH: number;
  /** Window element top in viewport coords */
  winTop: number;

  /** Vanishing point Y in viewport coords */
  vpY: number;
  /** Desk element top in viewport coords */
  deskTopY: number;
  /** Desk viewBox y=17 in viewport coords */
  deskY17: number;
  /** Desk viewBox y=33 in viewport coords */
  deskY33: number;
  /** Desk viewBox y=49 in viewport coords */
  deskY49: number;
}

/* ──────── API ──────── */

/**
 * Read the current stage geometry from DOM elements.
 * Throws if a required element is missing.
 */
export function getStageGeom(): StageGeom {
  const char = document.querySelector<HTMLElement>('.obj--character');
  const win  = document.querySelector<HTMLElement>('.obj--window');
  if (!char || !win) {
    throw new Error('perspective: stage elements not found');
  }

  const innerH = window.innerHeight;
  const charH  = char.offsetHeight;
  const winW   = win.offsetWidth;
  const winH   = win.offsetHeight;
  const winTop = win.getBoundingClientRect().top;

  /* Vanishing point */
  const vpY = innerH - charH * CHAR_WRIST_FROM_BOTTOM - winW * VP_WIN_W_COEFF / 1786;

  /* Desk element y-positions in viewport coords */
  const deskTopY = innerH - charH * DESK_HEIGHT_FRAC;
  const deskY17  = deskTopY + charH * DESK_HEIGHT_FRAC * VB_Y17 / 100;
  const deskY33  = deskTopY + charH * DESK_HEIGHT_FRAC * VB_Y33 / 100;
  const deskY49  = deskTopY + charH * DESK_HEIGHT_FRAC * VB_Y49 / 100;

  return { innerH, charH, winW, winH, winTop, vpY, deskTopY, deskY17, deskY33, deskY49 };
}

/**
 * Perspective narrowing factor between two distances from the VP.
 *
 * If an object at distance `dFront` (from VP) has width W, the same
 * object at distance `dBack` has width W × (dBack / dFront).
 * Returns the narrowing fraction: 1 − dBack/dFront.
 *
 * Usage: backWidth = frontWidth × (1 − narrowFrac(dFront, dBack))
 */
export function narrowFrac(dFront: number, dBack: number): number {
  return 1 - dBack / dFront;
}

/**
 * Map a viewport Y coordinate into the WindowView viewBox (1698 × 835).
 *
 * The window glass occupies OpenWindow viewBox y=45..880 (835 units),
 * which maps to a physical glass rect in the viewport. This function
 * converts a viewport Y into the corresponding WindowView viewBox Y.
 */
export function vpYtoWindowViewY(stageY: number, geom: StageGeom): number {
  const glassTopY = geom.winTop + geom.winH * GLASS_TOP_VB / 964;
  const glassH    = geom.winH * GLASS_H_VB / 964;
  return (stageY - glassTopY) / glassH * 835;
}
