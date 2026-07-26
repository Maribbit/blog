/**
 * Distant islands + lighthouse — exact SVG paths originally authored
 * in Lighthouse_And_Islands.svg, now embedded here as constants.
 *
 * Z-order (back to front):
 *   1. Island_Right  (#A8B5BB)
 *   2. Island_Middle  (#AFBAC0)
 *   3. Lighthouse     (11 parts)
 *   4. Island_Left    (#B6BFC4)  — front, overlaps lighthouse base
 *
 * The right island's right edge extends past viewWidth so it's
 * partially clipped (not fully exposed).
 */

/* ──────── Types ──────── */
interface IslandConfig {
  viewWidth: number;
  viewHeight: number;
  seaTopY: number;
}

/* ──────── Exact SVG paths from Lighthouse_And_Islands.svg ──────── */

const ISLAND_RIGHT_D =
  'M74.5 179.499C251.167 180.499 593.231 180.517 598.5 179.499' +
  'C603.616 178.511 592.449 152.787 506 135' +
  'C466.544 90.3632 404.82 98.4345 361.5 109.999' +
  'C272.632 112.222 264.72 112.457 223 134.999' +
  'C159.167 149.351 126.421 158.965 74.5 179.499Z';

const ISLAND_MIDDLE_D =
  'M173 141.5C242.5 141.5 269.387 161.164 325 183H52' +
  'C84.7612 159.931 103.5 141.499 173 141.5Z';

const ISLAND_LEFT_D =
  'M134.5 145.5C55.0167 142.455 56.0874 159.085 0 186.001H240' +
  'L239.997 185.997C239.372 185.101 213.864 148.54 134.5 145.5Z';

/* ──────── Lighthouse parts (shifted to x=99–143) ──────── */
interface LhPart { d: string; fill: string; }

const LIGHTHOUSE_PARTS: LhPart[] = [
  { d: 'M99 148L108.609 40H133.897L143 148Z',        fill: '#C1C8CE' },
  { d: 'M119 148V132H128V148Z',                       fill: '#98A7AC' },
  { d: 'M124 148V132H130V148H124Z',                   fill: '#ABB4B9' },
  { d: 'M102.925 104L104.5 86H137.803L139.279 104Z', fill: '#B7C0C7' },
  { d: 'M119 104V86H130V104H119Z',                    fill: '#A1ACB2' },
  { d: 'M107 60L108.5 41H134L135.5 60H107Z',         fill: '#BBC2C8' },
  { d: 'M131 60L129.5 41H134L135.5 60H131Z',         fill: '#A8B0B7' },
  { d: 'M132.75 34.5H109.75V14.5H132.75V34.5Z',      fill: '#BBC2CA' },
  { d: 'M129 34V15H133V34H129Z',                      fill: '#ACB3BD' },
  { d: 'M141 34H101V41H141V34Z',                      fill: '#B3BCC3' },
  { d: 'M120.5 0L103 15H139L120.5 0Z',                fill: '#96A3A9' },
];

/* ──────── Island fills (exact from SVG) ──────── */
/* Island fills (from Lighthouse_And_Islands.svg) */
const ISLAND_COLORS = {
  right: '#A8B5BB',
  middle: '#AFBAC0',
  left: '#B6BFC4',
};

/* ──────── Build ──────── */
export function buildIslands(
  container: SVGGElement,
  config: IslandConfig,
): void {
  const svgNS = 'http://www.w3.org/2000/svg';
  const { viewWidth, seaTopY } = config;

  /* Scale & position:
     - Source viewBox is 600×186.
     - Scale 0.7 × 1.8 = 1.26 (shrunk 30%).
     - Right edge of Island_Right (source x=598.5) → roughly viewWidth + 80,
       so the rightmost island is partially clipped.
     - Additional +100 on translateX shifts everything right.
     - Bottom of source (y=186) → seaTopY + 30, so wave layers cover
       the island bases naturally. */
  const scale = 1.8 * 0.7;
  const translateX = viewWidth + 80 - 598.5 * scale + 100;
  const translateY = seaTopY + 30 - 186 * scale;

  const islandGroup = document.createElementNS(svgNS, 'g');
  islandGroup.setAttribute(
    'transform',
    `translate(${translateX}, ${translateY}) scale(${scale})`,
  );

  /* 1. Island_Right (back) */
  const rightEl = document.createElementNS(svgNS, 'path');
  rightEl.setAttribute('d', ISLAND_RIGHT_D);
  rightEl.setAttribute('fill', ISLAND_COLORS.right);
  rightEl.setAttribute('stroke', 'none');
  islandGroup.appendChild(rightEl);

  /* 2. Island_Middle */
  const middleEl = document.createElementNS(svgNS, 'path');
  middleEl.setAttribute('d', ISLAND_MIDDLE_D);
  middleEl.setAttribute('fill', ISLAND_COLORS.middle);
  middleEl.setAttribute('stroke', 'none');
  islandGroup.appendChild(middleEl);

  /* 3. Lighthouse */
  const lhGroup = document.createElementNS(svgNS, 'g');
  lhGroup.setAttribute('shape-rendering', 'crispEdges');
  for (const part of LIGHTHOUSE_PARTS) {
    const el = document.createElementNS(svgNS, 'path');
    el.setAttribute('d', part.d);
    el.setAttribute('fill', part.fill);
    el.setAttribute('stroke', 'none');
    lhGroup.appendChild(el);
  }
  islandGroup.appendChild(lhGroup);

  /* 4. Island_Left (front — overlaps lighthouse base) */
  const leftEl = document.createElementNS(svgNS, 'path');
  leftEl.setAttribute('d', ISLAND_LEFT_D);
  leftEl.setAttribute('fill', ISLAND_COLORS.left);
  leftEl.setAttribute('stroke', 'none');
  islandGroup.appendChild(leftEl);

  container.appendChild(islandGroup);
}
