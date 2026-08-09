/**
 * Distant aircraft — a floatplane crossing the SKY, separate from ships.
 *
 * ## Why separate from ships.ts
 *
 * - Flight path: planes fly HIGH in the sky (Y well above the sea
 *   horizon), not along the waterline.
 * - Speed: much faster than ships (a crossing takes ~30s, not minutes).
 * - Propeller: the front blades SPIN, with side-view foreshortening.
 *
 * ## Propeller animation (side-front view)
 *
 * From a side-front viewpoint the propeller disk is an ELLIPSE on
 * screen: the vertical semi-axis is the full blade radius R, the
 * horizontal semi-axis is foreshortened to R·k (k ≈ 0.35).
 *
 * A blade at angle θ traces:
 *   tipX = R·k·sin θ,   tipY = −R·cos θ
 *
 * So a blade is:
 *   - vertical at θ = 0 / 180° → full length R       (fully visible)
 *   - horizontal at θ = 90 / 270° → length R·k        (very narrow —
 *     exactly the "转到水平位置时会变得很窄" effect)
 *
 * Implemented as one transform on the blade path:
 *   translate(hub) rotate(α) scale(1, s) translate(−hub)
 * where α = atan2(−cosθ, k·sinθ) and s = √(k²sin²θ + cos²θ).
 *
 * ## Float interleave (subtle perspective shift)
 *
 * The plane SVG is drawn from a slightly nose-on viewpoint: the far
 * float (Float_L, darker) sits higher and pokes out past the near
 * float (Float_R, lighter). As the plane crosses the screen, the
 * viewer's angle shifts from nose-on (plane at left edge) to
 * tail-on (plane at right edge). We approximate that by sliding the
 * two floats in OPPOSITE x directions — a few viewBox units only.
 *
 *   u = normalized screen position ∈ [−1 (left), +1 (right)]
 *   Float_L (far)  offset = −u·yawAmp   (toward nose at left edge)
 *   Float_R (near) offset = +u·yawAmp
 *
 * Pure function of world time → still deterministic on refresh.
 *
 * ## Determinism
 *
 * Position and blade angle are pure functions of world time, so a
 * refresh mid-flight shows the plane exactly where it should be,
 * with the propeller at the same angle.
 */

import floatplaneSvg from '../assets/svg/scene/Floatplane.svg?raw';
import { seededRng, range } from './world';

/* ═════════════════════════════════════════════════════════════════
   Aircraft manifest — the ONLY place aircraft behaviour is configured.
   ═════════════════════════════════════════════════════════════════ */

interface AircraftDef {
  svg: string;
  width: number;
  height: number;
  scale: number; // target size in WindowView viewBox
  /** Propeller hub (cx, cy) in the SVG's local viewBox coords. */
  hub: { cx: number; cy: number };
  /** Blade half-length (from hub to tip) in local viewBox coords. */
  bladeR: number;
  /** Foreshortening of the propeller disk (0..1). 0 = edge-on. */
  propK: number;
  /** Propeller spin, revolutions per second. */
  propRps: number;
  /** Float interleave amplitude (local viewBox units, applied to x). */
  floatYawAmp: number;
  /** Slight pitch-down (clockwise) angle, degrees — nose dips. */
  pitchDeg: number;
  /** Downward shift of the FAR (left) float, local viewBox units,
      to read as a low-angle view from below. */
  farFloatDy: number;
  /** Side-window forward slide amplitude (local viewBox units) —
      windows drift toward the nose as the plane crosses right. */
  winSlideAmp: number;
  /** Front-window horizontal compression (0..1) at the far-right
      extreme — it narrows as the view becomes tail-on. */
  winCompressK: number;
  /** Front-window center (cx, cy) in local viewBox coords. */
  frontWinCx: number;
  frontWinCy: number;
  /** Wings_Front V-closing compression (0..1): how much the wing
      span compresses horizontally at the right (tail-on) extreme. */
  wingCloseK: number;
  /** Wings_Front center (cx, cy) in local viewBox coords. */
  frontWingCx: number;
  frontWingCy: number;
  /** Wing_R_Bottom skew (deg) at the right extreme — the near edge
      (larger y) slides toward the nose, forming a slight trapezoid. */
  wingRSkewDeg: number;
  /** Wing_R_Bottom pivot (anchor) point in local viewBox coords. */
  wingRAnchorX: number;
  wingRAnchorY: number;
}

const AIRCRAFT_MANIFEST: AircraftDef[] = [
  {
    svg: floatplaneSvg,
    width: 248,
    height: 100,
    scale: 0.6,
    /* Propeller blade rect x=217.5..219.5, y=15.5..65.5 */
    hub: { cx: 218.5, cy: 40.5 },
    bladeR: 25,
    propK: 0.35,
    propRps: 8,
    /* ±3 local units → ±1.8 screen px at scale 0.6: subtle. */
    floatYawAmp: 3,
    /* Slight pitch-down so it reads as flying, not floating. */
    pitchDeg: 2.5,
    /* Far float dips a touch — low-angle view from below. */
    farFloatDy: 2,
    /* Side windows slide toward the nose (±2.5 local units). */
    winSlideAmp: 2.5,
    /* Front window compresses to 60% width at the right extreme. */
    winCompressK: 0.4,
    /* Window_Front bbox x 164..184, y 22.5..37 → center. */
    frontWinCx: 174,
    frontWinCy: 29.75,
    /* Wings_Front bbox x 73..205.5, y 10..23.5 → center ≈ (140, 17).
       V closes by 20% at the right extreme. */
    wingCloseK: 0.2,
    frontWingCx: 140,
    frontWingCy: 17,
    /* Wing_R_Bottom skew up to 6° at the right extreme, pivoting at
       the wing root (159, 15) so the bottom (near) edge shifts +x. */
    wingRSkewDeg: 6,
    wingRAnchorX: 159,
    wingRAnchorY: 15,
  },
];

/* ── Flight lanes ─────────────────────────────────────────────────
   Each lane is one flight path across the sky. */
interface AircraftLane {
  y: number;        // viewBox Y of the plane's top-left
  speed: number;    // viewBox units / second
  cycleSec: number; // seconds per full crossing (loops)
  delaySec: number; // time offset before first appearance
}

/* Fixed world seed — never change, or planes re-roll on refresh. */
const WORLD_SEED = 'maribbit-sky-planes';
const MARGIN = 80;

const AIRCRAFT_LANES: AircraftLane[] = [
  {
    y: 300,       // high in the sky, well above the horizon (~622)
    speed: 60,    // ≈ 30s per crossing — planes move fast
    cycleSec: 35,
    delaySec: 0,
  },
];

/* ═════════════════════════════════════════════════════════════════
   Runtime — no need to touch when adding new planes.
   ═════════════════════════════════════════════════════════════════ */

interface RuntimeConfig {
  viewWidth: number;
}

interface AircraftEntry {
  lane: AircraftLane;
  def: AircraftDef;
  g: SVGGElement;
  blade: SVGPathElement | null;   // propeller blade (double-bladed)
  floatL: SVGPathElement | null;  // far-side float (darker)
  floatR: SVGPathElement | null;  // near-side float (lighter)
  strutsL: SVGPathElement[];      // struts attached to Float_L
  strutsR: SVGPathElement[];      // struts attached to Float_R
  rearWin: SVGPathElement | null; // side window (rear)
  sideWin: SVGPathElement | null; // side window (middle)
  frontWin: SVGPathElement | null;// front window (nose)
  frontWing: SVGPathElement | null; // Wings_Front (V silhouette)
  wingR: SVGPathElement | null;   // Wing_R_Bottom (near wing bottom)
  x0: number;                     // raw offset at t=0
}

function spinBlade(
  blade: SVGPathElement,
  hub: { cx: number; cy: number },
  bladeR: number,
  k: number,
  theta: number,
): void {
  /* Blade tip on the ellipse: tipX = R·k·sinθ, tipY = −R·cosθ */
  const s = Math.sqrt(k * k * Math.sin(theta) ** 2 + Math.cos(theta) ** 2);
  /* The source blade points along +Y (vertical). After rotate(α),
     (0,1) → (−sinα, cosα). We need that to equal the blade direction
     (k·sinθ, −cosθ)/s → α = atan2(−k·sinθ, −cosθ). */
  const alpha = Math.atan2(-k * Math.sin(theta), -Math.cos(theta));
  const deg = (alpha * 180) / Math.PI;
  void bladeR; // length is fixed in the path; scale(1, s) shortens it
  blade.setAttribute(
    'transform',
    `translate(${hub.cx} ${hub.cy}) rotate(${deg}) scale(1 ${s.toFixed(4)}) translate(${-hub.cx} ${-hub.cy})`,
  );
}

export function buildAircraft(
  container: SVGGElement,
  config: RuntimeConfig,
): { update: (time: number) => void } {
  const { viewWidth } = config;
  const svgNS = 'http://www.w3.org/2000/svg';
  const entries: AircraftEntry[] = [];

  for (let laneIdx = 0; laneIdx < AIRCRAFT_LANES.length; laneIdx++) {
    const lane = AIRCRAFT_LANES[laneIdx];
    const def = AIRCRAFT_MANIFEST[0];
    const span = viewWidth + def.width * def.scale + MARGIN * 2;
    const g = document.createElementNS(svgNS, 'g') as SVGGElement;
    container.appendChild(g);

    /* Adopt the plane SVG into the scene. */
    const parser = new DOMParser();
    const doc = parser.parseFromString(def.svg, 'image/svg+xml');
    const srcG = doc.querySelector('g')!;
    while (srcG.firstChild) g.appendChild(srcG.firstChild);

    /* Propeller: the source rect is DOUBLE-bladed (spans hub±R), so
       one element spins the whole propeller — no mirror copy needed. */
    const blade = g.querySelector<SVGPathElement>('#Propeller');

    /* Floats: far-side (dark) and near-side (light). */
    const floatL = g.querySelector<SVGPathElement>('#Float_L');
    const floatR = g.querySelector<SVGPathElement>('#Float_R');

    /* Struts follow their own float: L-struts ↔ Float_L, R-struts ↔ Float_R.
       (The SVG has been corrected so the L/R strut IDs match their float.) */
    const strutsL: SVGPathElement[] = [];
    const strutsR: SVGPathElement[] = [];
    const pick = (id: string): SVGPathElement | null => g.querySelector<SVGPathElement>(id);
    for (const id of ['#Struts_LB', '#Struts_LF']) {
      const s = pick(id);
      if (s) strutsL.push(s);
    }
    for (const id of ['#Struts_RB', '#Struts_RF']) {
      const s = pick(id);
      if (s) strutsR.push(s);
    }

    /* Windows: rear + middle side windows, and the nose front window. */
    const rearWin = pick('#Window_Rear');
    const sideWin = pick('#Widow_Side');
    const frontWin = pick('#Window_Front');

    /* Wings: the front V silhouette and the near-side wing bottom. */
    const frontWing = pick('#Wings_Front');
    const wingR = pick('#Wing_R_Bottom');

    /* Deterministic start offset — planes are spaced by the seed. */
    const rng = seededRng(WORLD_SEED, laneIdx + 1);
    const x0 = range(rng, 0, span) - lane.delaySec * lane.speed;

    entries.push({
      lane, def, g,
      blade,
      floatL, floatR,
      strutsL, strutsR,
      rearWin, sideWin, frontWin,
      frontWing, wingR,
      x0,
    });
    if (!blade) {
      console.warn('[aircraft] #Propeller not found in', def.svg.slice(0, 40));
    }
  }

  /* Position + blade angle are PURE FUNCTIONS of world time (ms). */
  function update(time: number): void {
    const t = time / 1000; // seconds
    for (const e of entries) {
      const lane = e.lane;
      const span = viewWidth + e.def.width * e.def.scale + MARGIN * 2;
      const raw = e.x0 + lane.speed * t;
      const x = ((raw % span) + span) % span - e.def.width * e.def.scale - MARGIN;
      /* Plane transform: position + slight clockwise pitch (nose dips).
         Rotate about the fuselage center so the pitch reads natural. */
      const cx = (e.def.width * e.def.scale) / 2;
      const cy = (e.def.height * e.def.scale) / 2;
      e.g.setAttribute(
        'transform',
        `translate(${x} ${lane.y}) scale(${e.def.scale}) rotate(${e.def.pitchDeg} ${cx} ${cy})`,
      );

      /* Spinning propeller — angle is deterministic too. */
      if (e.blade) {
        const theta = 2 * Math.PI * e.def.propRps * t;
        spinBlade(e.blade, e.def.hub, e.def.bladeR, e.def.propK, theta);
      }

      /* Float interleave — subtle opposite x-slide as the plane
         crosses the viewport. Plane center in screen coords:
         px = x + halfWidth. u ∈ [−1, +1]. */
      const px = x + (e.def.width * e.def.scale) / 2;
      const u = (px - viewWidth / 2) / (viewWidth / 2);
      const inter = e.def.floatYawAmp * Math.max(-1, Math.min(1, u));
      const offL = (-inter).toFixed(2);
      const offR = inter.toFixed(2);
      /* Far float also dips down slightly (low-angle view from below). */
      const dyL = e.def.farFloatDy.toFixed(2);
      if (e.floatL) {
        e.floatL.setAttribute('transform', `translate(${offL}, ${dyL})`);
      }
      if (e.floatR) {
        e.floatR.setAttribute('transform', `translate(${offR}, 0)`);
      }
      /* Struts follow their floats — same offset keeps attachment.
         L-struts share the far float's dip as well. */
      for (const s of e.strutsL) s.setAttribute('transform', `translate(${offL}, ${dyL})`);
      for (const s of e.strutsR) s.setAttribute('transform', `translate(${offR}, 0)`);

      /* Window perspective shift: as the plane crosses left→right, the
         view goes nose-on → tail-on.  Side windows slide toward the
         nose (+x); the front window compresses horizontally. */
      const winSlide = e.def.winSlideAmp * u;
      const winSx = 1 - (e.def.winCompressK * (u + 1)) / 2; // 1 → 1−K
      const winT = winSlide.toFixed(2);
      if (e.rearWin) e.rearWin.setAttribute('transform', `translate(${winT}, 0)`);
      if (e.sideWin) e.sideWin.setAttribute('transform', `translate(${winT}, 0)`);
      if (e.frontWin) {
        e.frontWin.setAttribute(
          'transform',
          `translate(${e.def.frontWinCx} ${e.def.frontWinCy}) scale(${winSx.toFixed(3)} 1) translate(${-e.def.frontWinCx} ${-e.def.frontWinCy})`,
        );
      }

      /* Wing perspective: the V of Wings_Front closes (tail-on), and
         Wing_R_Bottom shears into a trapezoid — its near (lower) edge
         slides toward the nose. Both driven by the same u. */
      const wingSx = 1 - (e.def.wingCloseK * (u + 1)) / 2; // 1 → 1−K
      if (e.frontWing) {
        e.frontWing.setAttribute(
          'transform',
          `translate(${e.def.frontWingCx} ${e.def.frontWingCy}) scale(${wingSx.toFixed(3)} 1) translate(${-e.def.frontWingCx} ${-e.def.frontWingCy})`,
        );
      }
      const skewDeg = (e.def.wingRSkewDeg * (u + 1)) / 2; // 0 → max
      if (e.wingR) {
        e.wingR.setAttribute(
          'transform',
          `translate(${e.def.wingRAnchorX} ${e.def.wingRAnchorY}) skewX(${skewDeg.toFixed(2)}) translate(${-e.def.wingRAnchorX} ${-e.def.wingRAnchorY})`,
        );
      }
    }
  }

  return { update };
}
