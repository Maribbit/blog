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
import { hashMod } from './world';

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

/* Crossing behaviour — which lane each ship uses.
   Time-bucket model: the world clock is sliced into buckets of
   cycleSec; each bucket deterministically decides whether a ship
   sails (presencePct), which type it is, and when it appears. */
interface ShipLane {
  y: number;           // viewBox Y of the ship's top-left
  cycleSec: number;    // bucket length (s) — how often a new chance occurs
  presencePct: number; // 0–100: chance a bucket actually has a ship
  crossingSec: number; // time for a full left→right crossing (s)
}

/* Fixed world seed — never change, or ships re-roll on refresh. */
const WORLD_SEED = 'maribbit-sea-ships';
const MARGIN = 60;

const SHIP_LANES: ShipLane[] = [
  {
    y: 575,
    /* Cargo ships are rare — a 25-min bucket, ~55% presence, and a
       SLOW ~6.7 u/s crossing (300s across ~2018 units ≈ 5 min).
       Long quiet stretches between sailings. */
    cycleSec: 1500,   // 25 min
    presencePct: 55,
    crossingSec: 300,
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
  laneIdx: number;
  def: ShipDef;
  g: SVGGElement;
  visible: boolean;
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
    const def = typeForBucket(laneIdx, 0);
    const g = document.createElementNS(svgNS, 'g') as SVGGElement;
    container.appendChild(g);

    entries.push({ lane, laneIdx, def, g, visible: false });
    paintShip(entries[entries.length - 1], viewWidth);
    g.setAttribute('visibility', 'hidden');
  }

  /* Deterministic: which type sails in a given bucket? */
  function typeForBucket(laneIdx: number, bucket: number): ShipDef {
    return SHIP_MANIFEST[hashMod(`${WORLD_SEED}:${laneIdx}:${bucket}`, SHIP_MANIFEST.length)];
  }

  function paintShip(e: ShipEntry, vw: number): void {
    /* Replace children with the current def's shapes */
    while (e.g.firstChild) e.g.removeChild(e.g.firstChild);
    const parser = new DOMParser();
    const doc = parser.parseFromString(e.def.svg, 'image/svg+xml');
    const srcG = doc.querySelector('g')!;
    while (srcG.firstChild) e.g.appendChild(srcG.firstChild);
  }

  /* Position is a PURE FUNCTION of world time (ms). Time-bucket
     model: rare, intermittent appearances. */
  function update(time: number): void {
    const t = time / 1000; // seconds
    for (const e of entries) {
      const lane = e.lane;
      const span = viewWidth + e.def.width * e.def.scale + MARGIN * 2;
      const bucket = Math.floor(t / lane.cycleSec);
      const bucketT = t - bucket * lane.cycleSec;

      /* Type for this bucket — swap at bucket boundary. */
      const def = typeForBucket(e.laneIdx, bucket);
      if (def !== e.def) {
        e.def = def;
        paintShip(e, viewWidth);
      }

      /* Presence + appearance time within the bucket. The appear
         offset is hashed so it never shifts on refresh. */
      const present = hashMod(`${WORLD_SEED}:${e.laneIdx}:${bucket}`, 100) < lane.presencePct;
      const maxStart = Math.max(0, lane.cycleSec - lane.crossingSec);
      const appearT = present
        ? (hashMod(`${WORLD_SEED}:${e.laneIdx}:${bucket}:t`, 1000) / 1000) * maxStart
        : 0;

      const visible = present && bucketT >= appearT && bucketT < appearT + lane.crossingSec;

      if (visible) {
        const progress = (bucketT - appearT) / lane.crossingSec;
        const x = -e.def.width * e.def.scale - MARGIN + progress * span;
        e.g.setAttribute('transform', `translate(${x}, ${lane.y}) scale(${e.def.scale})`);
        if (!e.visible) {
          e.visible = true;
          e.g.setAttribute('visibility', 'visible');
        }
      } else if (e.visible) {
        e.visible = false;
        e.g.setAttribute('visibility', 'hidden');
      }
    }
  }

  return { update };
}
