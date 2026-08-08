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
 * | speed       | viewBox units per rAF tick          |
 * | startDelay  | seconds before first appearance     |
 *
 * WindowView viewBox: 1698 × 835, horizon at seaTopY (~622).
 */

import cargoShipSvg from '../assets/svg/scene/Cargo_Ship_Faraway.svg?raw';

/* ═════════════════════════════════════════════════════════════════
   Ship manifest — the ONLY place ship behaviour is configured.
   Add a new row for each variant; the runtime handles the rest.
   ═════════════════════════════════════════════════════════════════ */

interface ShipDef {
  svg: string;       // raw SVG (imported via ?raw)
  width: number;
  height: number;
  scale: number;
  y: number;
  speed: number;
  startDelay: number; // seconds
}

const SHIP_MANIFEST: ShipDef[] = [
  {
    svg: cargoShipSvg,
    width: 259,
    height: 70,
    scale: 0.77,
    y: 575,
    speed: 0.12,
    startDelay: 0,
  },
  /* ── Future ships (examples) ──────────────────────────────
  {
    svg: fishingBoatSvg,
    width: 180,
    height: 45,
    scale: 0.6,
    y: 595,
    speed: 0.08,
    startDelay: 8,   // appears 8 s after load
  },
  */
];

/* ═════════════════════════════════════════════════════════════════
   Runtime — no need to touch this when adding new ships.
   ═════════════════════════════════════════════════════════════════ */

interface RuntimeConfig {
  viewWidth: number;
}

export function buildShips(
  container: SVGGElement,
  config: RuntimeConfig,
): { update: (time: number) => void } {
  const { viewWidth } = config;
  const entries: { g: SVGGElement; def: ShipDef; x: number }[] = [];

  for (const def of SHIP_MANIFEST) {
    /* Parse the raw SVG into DOM nodes */
    const parser = new DOMParser();
    const doc = parser.parseFromString(def.svg, 'image/svg+xml');
    const srcG = doc.querySelector('g')!;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    while (srcG.firstChild) g.appendChild(srcG.firstChild);
    container.appendChild(g);

    const shipW = def.width * def.scale;
    /* Start off-screen left, delayed by startDelay seconds */
    const startX = -shipW;
    g.setAttribute('transform', `translate(${startX}, ${def.y}) scale(${def.scale})`);

    entries.push({ g, def, x: startX + def.speed * def.startDelay * 50 /* rough tick→s */ });
  }

  function update(time: number): void {
    for (const e of entries) {
      e.x += e.def.speed;
      const shipW = e.def.width * e.def.scale;
      if (e.x > viewWidth + 20) {
        e.x = -shipW - 40;
      }
      e.g.setAttribute('transform', `translate(${e.x}, ${e.def.y}) scale(${e.def.scale})`);
    }
  }

  return { update };
}
