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
