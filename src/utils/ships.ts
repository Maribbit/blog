/**
 * Distant ships — placed in the far sea / sky, behind the islands.
 *
 * ## Asset workflow
 *
 * 1. Draw each ship as a standalone `.svg` in `src/assets/svg/scene/`.
 * 2. Import it with `?raw` below.
 * 3. Add a row to SHIP_MANIFEST with the ship's behaviour.
 *
 * ## Manifest fields
 *
 * | Field       | Meaning |
 * | width       | SVG viewBox width (pixels)          |
 * | height      | SVG viewBox height (pixels)         |
 * | scale       | target size in WindowView viewBox   |
 * | y           | viewBox Y of the SVG's top-left     |
 * | speed       | viewBox units per second            |
 * | cycleSec    | seconds per full crossing           |
 *
 * ## Determinism (world clock)
 *
 * Position is a pure function of world time: `x = wrap(x0 + speed·t)`.
 * Refresh mid-crossing and the ship is exactly where it should be.
 * The ship TYPE is hashed per crossing generation: each pass can pick
 * a different variant from the manifest, deterministically.
 *
 * WindowView viewBox: 1698 × 835, horizon at seaTopY (~622).
 */

import cargoShipSvg from '../assets/svg/scene/Cargo_Ship_Faraway.svg?raw';
import { seededRng, range, hashMod } from './world';

/* ═════════════════════════════════════════════════════════════════
   Ship manifest — the ONLY place ship behaviour is configured.
   Add a new row for each variant; the runtime handles the rest.
   ═════════════════════════════════════════════════════════════════ */

interface ShipDef {
  svg: string;   // raw SVG (imported via ?raw)
  width: number;
  height: number;
  scale: number; // target size in WindowView viewBox
}

const SHIP_MANIFEST: ShipDef[] = [
  {
    svg: cargoShipSvg,
    width: 259,
    height: 70,
    scale: 0.77,
  },
  /* ── Future ships (examples) ──────────────────────────────
  {
    svg: fishingBoatSvg,
    width: 180,
    height: 45,
    scale: 0.6,
  },
  */
];

/* Crossing behaviour — which lane each ship uses. */
interface ShipLane {
  /** Which manifest entry the FIRST crossing shows. */
  firstType: number;
  y: number;
  speed: number;      // viewBox units / second
  cycleSec: number;   // seconds per full crossing (loops)
  /** Time offset (s) before the first appearance. */
  delaySec: number;
}

/* Fixed world seed — never change, or ships re-roll on refresh. */
const WORLD_SEED = 'maribbit-sea-ships';
const MARGIN = 60;

const SHIP_LANES: ShipLane[] = [
  {
    firstType: 0,
    y: 575,
    speed: 7.2,       // ≈ 0.12/帧 × 60
    cycleSec: 300,    // 5 min per crossing
    delaySec: 0,
  },
];

/* ═════════════════════════════════════════════════════════════════
   Runtime — no need to touch this when adding new ships.
   ═════════════════════════════════════════════════════════════════ */

interface RuntimeConfig {
  viewWidth: number;
}

interface ShipEntry {
  lane: ShipLane;
  def: ShipDef;
  g: SVGGElement;
  x0: number;         // raw offset at t=0 (ms)
  lastGen: number;
  lastDef: ShipDef;
}

export function buildShips(
  container: SVGGElement,
  config: RuntimeConfig,
): { update: (time: number) => void } {
  const { viewWidth } = config;
  const svgNS = 'http://www.w3.org/2000/svg';
  const entries: ShipEntry[] = [];

  for (let laneIdx = 0; laneIdx < SHIP_LANES.length; laneIdx++) {
    const lane = SHIP_LANES[laneIdx];
    /* First type is deterministic; span uses that type's width. */
    const def = SHIP_MANIFEST[lane.firstType % SHIP_MANIFEST.length];
    const span = viewWidth + def.width * def.scale + MARGIN * 2;
    const g = document.createElementNS(svgNS, 'g') as SVGGElement;
    container.appendChild(g);

    /* Raw offset at t=0 — deterministic lane phase, so ships are
       spaced apart and never all clustered. */
    const rng = seededRng(WORLD_SEED, laneIdx + 1);
    const x0 = range(rng, 0, span) - lane.delaySec * lane.speed;
    const gen = Math.floor(x0 / span); // could be -1 if delay pushed raw negative

    entries.push({
      lane, def, g,
      x0, lastGen: gen - 1,
      lastDef: def,
    });
    paintShip(entries[entries.length - 1], viewWidth);
  }

  /* Deterministic: which type is sailing this generation? */
  function typeForGen(lane: ShipLane, gen: number): ShipDef {
    return SHIP_MANIFEST[hashMod(`${WORLD_SEED}:${laneIdxOf(lane)}:${gen}`, SHIP_MANIFEST.length)];
  }

  function laneIdxOf(lane: ShipLane): number {
    return SHIP_LANES.indexOf(lane);
  }

  function paintShip(e: ShipEntry, vw: number): void {
    /* Replace children with the current def's shapes */
    while (e.g.firstChild) e.g.removeChild(e.g.firstChild);
    const parser = new DOMParser();
    const doc = parser.parseFromString(e.def.svg, 'image/svg+xml');
    const srcG = doc.querySelector('g')!;
    while (srcG.firstChild) e.g.appendChild(srcG.firstChild);
    const span = vw + e.def.width * e.def.scale + MARGIN * 2;
    e.g.setAttribute('transform', `translate(${-e.def.width * e.def.scale - MARGIN}, ${e.lane.y}) scale(${e.def.scale})`);
    void span;
  }

  /* Position is a PURE FUNCTION of world time (ms). */
  function update(time: number): void {
    const t = time / 1000; // seconds
    for (const e of entries) {
      const lane = e.lane;
      const span = viewWidth + e.def.width * e.def.scale + MARGIN * 2;
      const raw = e.x0 + lane.speed * t;
      const gen = Math.floor(raw / span);

      /* Type change at a new generation — deterministic hash. */
      if (gen !== e.lastGen) {
        const next = typeForGen(lane, gen);
        if (next !== e.lastDef) {
          e.def = next;
          e.lastDef = next;
          paintShip(e, viewWidth);
        }
        e.lastGen = gen;
      }

      const x = (raw % span + span) % span - e.def.width * e.def.scale - MARGIN;
      e.g.setAttribute('transform', `translate(${x}, ${lane.y}) scale(${e.def.scale})`);
    }
  }

  return { update };
}
