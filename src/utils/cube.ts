/**
 * cube — 1-point perspective box projection utility.
 *
 * ## Why
 * Every 3D object placed on the desk should first be enclosed in a
 * perspective-correct bounding box (an "外接立方体"), then the object's
 * details are drawn inside that box. This ensures all objects share the
 * same vanishing point and feel grounded in the 2.5D room.
 *
 * ## Usage
 *
 * ```ts
 * import { projectBox, calcScaleBack, calcVpXLocal, calcVpYLocal }
 *   from '../utils/cube';
 * import { getStageGeom } from '../utils/perspective';
 *
 * const g = getStageGeom();
 * const pedRect = pedEl.getBoundingClientRect();
 * const desk    = document.querySelector('.desk')!;
 * const deskRect = desk.getBoundingClientRect();
 * const deskCenterX = deskRect.left + deskRect.width / 2;
 *
 * const vpX = calcVpXLocal(pedRect, deskCenterX);
 * const vpY = calcVpYLocal(pedRect, g.vpY);
 * const sb  = calcScaleBack(g.vpY, pedRect.top, pedRect.height, 35, 8);
 *
 * const { top, front, right } = projectBox(
 *   { cx: 50, hw: 44, topY: 35, botY: 70 },
 *   { vpX, vpY, scaleBack: sb },
 * );
 * ```
 *
 * ## Perspective Model
 *
 * A box has a **front face** (closest to viewer) and a **back face**
 * (further). The back face is uniformly scaled toward the VP in both
 * X and Y:
 *
 * ```
 *           VP ●
 *            /|\
 *       bl───-──br    ← back face (smaller, closer to VP)
 *       |       |
 *       |   ○   |    ← the box
 *       |       |
 *       fl───-──fr    ← front face (larger, further from VP)
 * ```
 *
 * The 3 visible faces are: **top** (fl→fr→br→bl), **front** (fl→fr
 * vertical drop), and **right** (fr→br vertical drop). All depth
 * edges converge toward the VP in both X and Y.
 *
 * ## BoxDef vs ProjectionCtx
 *
 * - `BoxDef` describes the box's front face in the local viewBox (0-100).
 * - `ProjectionCtx` provides the VP position (viewBox coords) and the
 *   scale factor. The back face geometry is **derived** from these two.
 * - The caller is responsible for computing `vpX`, `vpY`, and `scaleBack`
 *   from the actual DOM layout. This keeps the projection logic pure.
 */

/* ──────── Types ──────── */

/**
 * Define a rectangular box (cube/prism) by its **front face**.
 *
 * The back face is computed from `ProjectionCtx` — the box's depth
 * is implicitly captured by `scaleBack`.
 *
 * ```
 *        ┌──────────┐  topY ── front top edge
 *        │          │
 *        │  front   │
 *        │   face   │
 *        └──────────┘  botY ── front bottom edge
 *        └────hw───┘
 *        └──cx──┘
 * ```
 */
export interface BoxDef {
  /** Front-face center X in viewBox coords (0-100) */
  cx: number;
  /** Front-face half-width in viewBox coords */
  hw: number;
  /** Front top-edge Y in viewBox coords (closer to viewer) */
  topY: number;
  /** Front bottom-edge Y in viewBox coords */
  botY: number;
}

/**
 * Projection context linking the box to the room's vanishing point.
 *
 * All three values are computed from the container's DOMRect and room
 * geometry via `calcVpXLocal`, `calcVpYLocal`, and `calcScaleBack`.
 */
export interface ProjectionCtx {
  /** VP X in the container's viewBox (0-100) */
  vpX: number;
  /** VP Y in the container's viewBox (0-100) */
  vpY: number;
  /** Narrowing ratio dBack/dFront for the back face (< 1) */
  scaleBack: number;
}

/**
 * SVG path `d` strings for the 3 visible faces.
 */
export interface BoxFaces {
  /** Top face — trapezoid narrowing toward VP */
  top: string;
  /** Front face — rectangle (vertical drop) */
  front: string;
  /** Right face — parallelogram-like quad, both depth edges toward VP */
  right: string;
}

/* ──────── Core projection ──────── */

/**
 * Compute the 3 visible faces of a box under 1-point perspective.
 *
 * The front face is a simple rectangle (the reference depth). The top
 * and right faces are derived by projecting the front face's corners
 * toward the VP using `scaleBack` — applied to BOTH X and Y.
 *
 * @param box  - Box definition (front face in local viewBox).
 * @param ctx  - Projection context (VP + scale factor).
 * @returns    SVG path `d` strings for { top, front, right }.
 */
export function projectBox(box: BoxDef, ctx: ProjectionCtx): BoxFaces {
  const { cx, hw, topY, botY } = box;
  const { vpX, vpY, scaleBack } = ctx;

  /* 1-point perspective projection: all points converge toward VP */
  const projectX = (x: number, s: number): number => vpX + (x - vpX) * s;
  const projectY = (y: number, s: number): number => vpY + (y - vpY) * s;

  /* Front edge (scale = 1: reference depth, no narrowing) */
  const fl = projectX(cx - hw, 1);
  const fr = projectX(cx + hw, 1);

  /* Back edge (scale = scaleBack: narrowed toward VP) */
  const bl = projectX(cx - hw, scaleBack);
  const br = projectX(cx + hw, scaleBack);

  /* Back face Y positions (projected toward VP) */
  const backTopY = projectY(topY, scaleBack);
  const backBotY = projectY(botY, scaleBack);

  return {
    top:   `M ${fl} ${topY} L ${fr} ${topY} L ${br} ${backTopY} L ${bl} ${backTopY} Z`,
    front: `M ${fl} ${topY} L ${fr} ${topY} L ${fr} ${botY} L ${fl} ${botY} Z`,
    right: `M ${fr} ${topY} L ${br} ${backTopY} L ${br} ${backBotY} L ${fr} ${botY} Z`,
  };
}

/* ──────── Helpers ──────── */

/**
 * Compute VP's X position inside a container element's local viewBox (0-100).
 *
 * @param containerRect - `getBoundingClientRect()` of the container.
 * @param vpViewportX   - VP's absolute X in viewport coords
 *                        (e.g., desk center = deskRect.left + deskRect.width/2).
 */
export function calcVpXLocal(containerRect: DOMRect, vpViewportX: number): number {
  return ((vpViewportX - containerRect.left) / containerRect.width) * 100;
}

/**
 * Compute VP's Y position inside a container element's local viewBox (0-100).
 *
 * @param containerRect - `getBoundingClientRect()` of the container.
 * @param vpViewportY   - VP's absolute Y in viewport coords (from getStageGeom).
 */
export function calcVpYLocal(containerRect: DOMRect, vpViewportY: number): number {
  return ((vpViewportY - containerRect.top) / containerRect.height) * 100;
}

/**
 * Compute the perspective narrowing ratio (dBack / dFront) between two
 * Y-depths within a container element.
 *
 * The ratio is < 1 when `topBackVB` is higher on screen (further from
 * viewer) than `topFrontVB`.
 *
 * @param vpY         - Vanishing point Y in viewport coords (from getStageGeom).
 * @param elTop       - Container element's top edge in viewport coords.
 * @param elH         - Container element's height in px.
 * @param topFrontVB  - ViewBox Y of the front (closer) edge.
 * @param topBackVB   - ViewBox Y of the back (further) edge.
 */
export function calcScaleBack(
  vpY: number,
  elTop: number,
  elH: number,
  topFrontVB: number,
  topBackVB: number,
): number {
  const yFront = elTop + (topFrontVB / 100) * elH;
  const yBack  = elTop + (topBackVB / 100) * elH;
  const dFront = yFront - vpY;
  const dBack  = yBack - vpY;
  return dBack / dFront;
}

/* ──────── Wireframe (all 8 corners + edges) ──────── */

/**
 * The 8 projected corners of a perspective box in viewBox coords.
 *
 * ```
 *          bl_top ─── br_top    ← back face (closer to VP)
 *         /        / |
 *   fl_top ───── fr_top |        ← front face
 *        |  bl_bot | br_bot
 *   fl_bot ───── fr_bot
 * ```
 */
export interface BoxCorners {
  fl_top:  { x: number; y: number };
  fr_top:  { x: number; y: number };
  fl_bot:  { x: number; y: number };
  fr_bot:  { x: number; y: number };
  bl_top:  { x: number; y: number };
  br_top:  { x: number; y: number };
  bl_bot:  { x: number; y: number };
  br_bot:  { x: number; y: number };
}

export interface WireframeEdge {
  from: { x: number; y: number };
  to:   { x: number; y: number };
  /** true if this edge would be hidden behind solid faces */
  hidden: boolean;
}

export interface BoxWireframe {
  corners: BoxCorners;
  edges: WireframeEdge[];
}

/**
 * Project all 8 corners of a box under 1-point perspective.
 *
 * The front face uses scale=1, the back face uses `scaleBack` in
 * both X and Y.
 */
export function projectCorners(box: BoxDef, ctx: ProjectionCtx): BoxCorners {
  const { cx, hw, topY, botY } = box;
  const { vpX, vpY, scaleBack } = ctx;

  const px = (x: number, s: number): number => vpX + (x - vpX) * s;
  const py = (y: number, s: number): number => vpY + (y - vpY) * s;

  return {
    fl_top: { x: px(cx - hw, 1),          y: topY },
    fr_top: { x: px(cx + hw, 1),          y: topY },
    fl_bot: { x: px(cx - hw, 1),          y: botY },
    fr_bot: { x: px(cx + hw, 1),          y: botY },
    bl_top: { x: px(cx - hw, scaleBack),   y: py(topY, scaleBack) },
    br_top: { x: px(cx + hw, scaleBack),   y: py(topY, scaleBack) },
    bl_bot: { x: px(cx - hw, scaleBack),   y: py(botY, scaleBack) },
    br_bot: { x: px(cx + hw, scaleBack),   y: py(botY, scaleBack) },
  };
}

/**
 * Compute all 12 edges of a perspective box, classified visible/hidden.
 *
 * In 1-point perspective with VP to the right (typical desk position),
 * the 3 hidden edges are:
 *   back-left vertical, left-bottom depth, back-bottom horizontal
 * forming an L-shape at the back-left-bottom corner.
 */
export function projectWireframe(box: BoxDef, ctx: ProjectionCtx): BoxWireframe {
  const c = projectCorners(box, ctx);

  /* All 12 edges. "hidden" marks edges occluded by solid faces. */
  const edges: WireframeEdge[] = [
    // Front face (all visible)
    { from: c.fl_top, to: c.fr_top, hidden: false },
    { from: c.fr_top, to: c.fr_bot, hidden: false },
    { from: c.fr_bot, to: c.fl_bot, hidden: false },
    { from: c.fl_bot, to: c.fl_top, hidden: false },
    // Back face top (visible), bottom (hidden)
    { from: c.bl_top, to: c.br_top, hidden: false },
    { from: c.br_top, to: c.br_bot, hidden: false },
    { from: c.br_bot, to: c.bl_bot, hidden: true  },  // back-bottom horizontal
    { from: c.bl_bot, to: c.bl_top, hidden: true  },  // back-left vertical
    // Depth edges
    { from: c.fl_top, to: c.bl_top, hidden: false },
    { from: c.fr_top, to: c.br_top, hidden: false },
    { from: c.fr_bot, to: c.br_bot, hidden: false },
    { from: c.fl_bot, to: c.bl_bot, hidden: true  },  // left-bottom depth
  ];

  return { corners: c, edges };
}

/* ──────── Rounded shapes (cubic-bezier corners) ──────── */

const KAPPA = 0.5523; /* 4×(√2−1)/3 — cubic bezier quarter-circle approx */

/**
 * Generate an SVG path for any polygon with per-corner rounded corners,
 * using cubic Bezier curves (C command).
 *
 * Unlike arc (A) commands, bezier curves don't require equal rx/ry and
 * won't distort when the viewBox is stretched non-uniformly.
 *
 * @param points - Clockwise corner points `{x, y}`.
 * @param radii  - Per-corner radius (same length as points; 0 = sharp).
 * @returns      SVG path `d` string.
 */
export function roundedPath(
  points: { x: number; y: number }[],
  radii: number[],
): string {
  const n = points.length;
  if (n < 2) return '';
  const segs: string[] = [];

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    let r = Math.max(0, radii[i]);

    const dxIn = p.x - prev.x;
    const dyIn = p.y - prev.y;
    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);

    const dxOut = next.x - p.x;
    const dyOut = next.y - p.y;
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);

    r = Math.min(r, lenIn / 2, lenOut / 2);

    if (r < 0.001) {
      segs.push(`${i === 0 ? 'M' : 'L'} ${p.x.toFixed(4)} ${p.y.toFixed(4)}`);
      continue;
    }

    const nxIn = dxIn / lenIn;
    const nyIn = dyIn / lenIn;
    const nxOut = dxOut / lenOut;
    const nyOut = dyOut / lenOut;

    /* Arc start (inset on incoming edge) and end (inset on outgoing edge) */
    const ax = p.x - r * nxIn;
    const ay = p.y - r * nyIn;
    const bx = p.x + r * nxOut;
    const by = p.y + r * nyOut;

    /* Cubic bezier control points tangent to each edge */
    const c1x = ax + r * KAPPA * nxIn;
    const c1y = ay + r * KAPPA * nyIn;
    const c2x = bx - r * KAPPA * nxOut;
    const c2y = by - r * KAPPA * nyOut;

    segs.push(`${i === 0 ? 'M' : 'L'} ${ax.toFixed(4)} ${ay.toFixed(4)}`);
    segs.push(`C ${c1x.toFixed(4)} ${c1y.toFixed(4)} ${c2x.toFixed(4)} ${c2y.toFixed(4)} ${bx.toFixed(4)} ${by.toFixed(4)}`);
  }

  segs.push('Z');
  return segs.join(' ');
}

/**
 * Generate all 3 visible faces of a box with rounded top edges.
 *
 * This is like `projectBox` but the top-front corners of the front and
 * right faces are rounded to match the inscribed rounded top face.
 *
 * @param box     - Box definition.
 * @param ctx     - Projection context.
 * @param rFront  - Corner radius at the front edge (viewBox units).
 * @returns       { top, front, right } SVG path `d` strings.
 */
export function projectRoundedTopBox(
  box: BoxDef,
  ctx: ProjectionCtx,
  rFront: number,
): BoxFaces {
  const { cx, hw, topY, botY } = box;
  const { vpX, vpY, scaleBack } = ctx;

  const px = (x: number, s: number): number => vpX + (x - vpX) * s;
  const py = (y: number, s: number): number => vpY + (y - vpY) * s;

  const fl = px(cx - hw, 1);
  const fr = px(cx + hw, 1);
  const bl = px(cx - hw, scaleBack);
  const br = px(cx + hw, scaleBack);
  const bTop = py(topY, scaleBack);
  const bBot = py(botY, scaleBack);
  const rBack = rFront * scaleBack;

  return {
    top: roundedPath(
      [{ x: fl, y: topY }, { x: fr, y: topY }, { x: br, y: bTop }, { x: bl, y: bTop }],
      [rFront, rFront, rBack, rBack],
    ),
    front: roundedPath(
      [{ x: fl, y: topY }, { x: fr, y: topY }, { x: fr, y: botY }, { x: fl, y: botY }],
      [rFront, rFront, 0, 0],
    ),
    right: roundedPath(
      [{ x: fr, y: topY }, { x: br, y: bTop }, { x: br, y: bBot }, { x: fr, y: botY }],
      [rFront, rBack, 0, 0],
    ),
  };
}


