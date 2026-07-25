/**
 * Drifting 2.5D cloud shapes — each cloud has a light top surface
 * (bumpy upper profile, flat bottom) and a darker bottom face (thin
 * 3D thickness strip below). Clouds drift horizontally at different
 * speeds (parallax), wrapping around when they exit the view.
 *
 * Algorithm matching Cloud_Ref.svg's two-face style:
 *   1. Pick width W and a base line at y = baseY
 *   2. Sample 6–10 irregularly spaced points along W
 *   3. Peak height near the middle point, tapering to edges
 *   4. Top face: straight-line polyline across bumps + Q curve to
 *      base on left and right
 *   5. Bottom face: kite (4-point rhombus) with stable random params
 */

/* ──────── Types ──────── */
interface CloudPt {
  rx: number;
  ry: number;
}

interface CloudData {
  group: SVGGElement;
  topEl: SVGPathElement;
  bottomEl: SVGPathElement;
  x: number;
  width: number;
  baseY: number;
  pts: CloudPt[];
  speed: number;
  /* Stable bottom-face geometry (computed once, not per-frame random) */
  bOffset: number;  // horizontal spread of bottom kite
  bThick: number;   // vertical depth of bottom kite
}

interface CloudConfig {
  viewWidth: number;
  viewHeight: number;
}

const CLOUD_COLORS = {
  top: '#f2f3f5',
  bottom: '#d4d6d9',
};

/* ──────── Spec generation ──────── */
function generateCloudSpec(config: CloudConfig) {
  const aspect = 0.66 + Math.random() * 0.5;
  const width = 80 + Math.random() * 220;
  const maxHeight = width * aspect * (0.15 + Math.random() * 0.2);
  const depth = maxHeight * (0.1 + Math.random() * 0.1); /* 10–20 % of height */
  const baseY = 50 + Math.random() * 350;
  const x = -width + Math.random() * (config.viewWidth + width * 2);
  const bOffset = width * (0.04 + Math.random() * 0.06);
  const bThick = depth * (0.6 + Math.random() * 0.6);
  return { width, x, baseY, maxHeight, depth, bOffset, bThick };
}

/* ──────── Point generation ──────── */
function makeCloudPoints(width: number, maxHeight: number): CloudPt[] {
  const n = 5 + Math.floor(Math.random() * 4);  // 5–8 points
  const pts: CloudPt[] = [];
  /* First and last points at 18% and 82% of width — far enough from
     edges so the side diagonals aren't steep. */
  const margin = width * 0.18;
  const usableW = width - margin * 2;

  for (let i = 0; i < n; i++) {
    const progress = i / (n - 1);
    /* Evenly spaced base, then jitter by ±15% of the segment width */
    const baseX = margin + progress * usableW;
    const jitter = (Math.random() - 0.5) * usableW / n * 0.6;
    const rx = Math.max(margin, Math.min(width - margin, baseX + jitter));

    /* Bell-curve height: small at edges (so side diagonals aren't
       flat against the kite), peaks at center. The minimum hFactor
       ensures the kite's upper diagonal stays below the top face. */
    const centered = Math.abs(progress - 0.5) * 2;
    const hFactor = Math.min(1 - centered + 0.2, 1);
    const noise = 0.55 + Math.random() * 0.5;
    pts.push({ rx, ry: -(maxHeight * hFactor * noise) });
  }

  return pts;
}

/* ──────── Path builders ──────── */
function makeTopPath(
  x: number, baseY: number, width: number, pts: CloudPt[]
): string {
  if (pts.length === 0) return 'M 0 0 Z';
  let d = `M ${x + pts[0].rx},${baseY + pts[0].ry}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${x + pts[i].rx},${baseY + pts[i].ry}`;
  }
  /* Straight down to right baseline end, across, and back up to
     first bump — pure lines, no Q curves. */
  d += ` L ${x + width},${baseY}`;
  d += ` L ${x},${baseY}`;
  d += ' Z';
  return d;
}

function makeBottomPath(
  x: number, baseY: number, width: number,
  bOffset: number, bThick: number,
  pts: CloudPt[],
): string {
  /* Find the tallest bump to center the kite under the highest part
     of the cloud, per the spec: "取D当中最高点的位置". */
  let peakI = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].ry < pts[peakI].ry) peakI = i;
  }
  const cx = x + pts[peakI].rx;

  /* 4-point kite: left→top(cx)→right→bottom(cx).
     Top vertex above baseline, bottom below — baseline runs through
     the interior as the kite's center line. */
  return [
    `M ${x},${baseY}`,
    `L ${cx + bOffset},${baseY - bThick}`,
    `L ${x + width},${baseY}`,
    `L ${cx - bOffset},${baseY + bThick}`,
    'Z',
  ].join(' ');
}

/* ──────── Public API ──────── */
export function buildClouds(
  container: SVGGElement,
  config: CloudConfig,
): { update: () => void } {
  const svgNS = 'http://www.w3.org/2000/svg';
  const clouds: CloudData[] = [];
  const nClouds = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < nClouds; i++) {
    const spec = generateCloudSpec(config);
    const pts = makeCloudPoints(spec.width, spec.maxHeight);
    const speed = 0.15 + Math.random() * 0.35;
    const group = document.createElementNS(svgNS, 'g') as SVGGElement;
    const topEl = document.createElementNS(svgNS, 'path') as SVGPathElement;
    const bottomEl = document.createElementNS(svgNS, 'path') as SVGPathElement;
    topEl.setAttribute('d', makeTopPath(spec.x, spec.baseY, spec.width, pts));
    topEl.setAttribute('fill', CLOUD_COLORS.top);
    topEl.setAttribute('stroke', 'none');
    topEl.setAttribute('stroke-linejoin', 'round');
    bottomEl.setAttribute('d', makeBottomPath(spec.x, spec.baseY, spec.width, spec.bOffset, spec.bThick, pts));
    bottomEl.setAttribute('fill', CLOUD_COLORS.bottom);
    bottomEl.setAttribute('stroke', CLOUD_COLORS.bottom);
    bottomEl.setAttribute('stroke-width', '1');
    bottomEl.setAttribute('stroke-linejoin', 'round');
    /* z-order: top face behind, bottom kite in front (closer to
       viewer). The kite spans across the baseline so the baseline
       becomes the kite's interior center line, not the visual edge. */
    group.appendChild(topEl);
    group.appendChild(bottomEl);
    container.appendChild(group);
    clouds.push({
      group, topEl, bottomEl,
      x: spec.x, width: spec.width, baseY: spec.baseY,
      pts, speed,
      bOffset: spec.bOffset, bThick: spec.bThick,
    });
  }

  function update(): void {
    for (const c of clouds) {
      c.x += c.speed;
      if (c.x > config.viewWidth + 50) {
        c.x = -c.width - 50 - Math.random() * 100;
        const spec = generateCloudSpec(config);
        c.width = spec.width;
        c.baseY = spec.baseY;
        c.bOffset = spec.bOffset;
        c.bThick = spec.bThick;
        c.pts = makeCloudPoints(spec.width, spec.maxHeight);
        c.speed = 0.15 + Math.random() * 0.35;
      }
      c.topEl.setAttribute('d', makeTopPath(c.x, c.baseY, c.width, c.pts));
      c.bottomEl.setAttribute('d', makeBottomPath(c.x, c.baseY, c.width, c.bOffset, c.bThick, c.pts));
    }
  }

  return { update };
}
