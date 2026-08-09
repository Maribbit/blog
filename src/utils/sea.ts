/**
 * Dynamic low-poly ocean — a stack of horizontal ribbon layers.
 * Each layer is an SVG <path> whose top edge is a wavy polyline.
 * Layers near the horizon are flat and pale; layers near the viewer
 * are taller, darker, and wave more.
 *
 * Both Y-起伏 and X-拉扯 are animated each frame, and each layer's
 * color breathes around its base tone.
 *
 * All viewBox numbers are tuned for 1698×835 (the window glass).
 */

import { seededRng } from './world';

/* Fixed world seed — never change, or the sea mesh re-rolls. */
const SEA_SEED = 'maribbit-sea-waves';

/* ──────── Helpers ──────── */
function gaussianRandom(rng: () => number): number {
  let rand = 0;
  for (let i = 0; i < 6; i++) rand += rng();
  return (rand - 3) / 3;
}

/* ──────── Config ──────── */
interface SeaConfig {
  viewWidth: number;
  viewHeight: number;
  seaTopY: number;
}

const DEFAULT_CONFIG: SeaConfig = {
  viewWidth: 1698,
  viewHeight: 835,
  seaTopY: 452,
};

interface SeaPoint {
  baseX: number; baseY: number;
  phaseY: number; phaseX: number;
  ampY: number; ampX: number;
}

interface SeaLayer {
  element?: SVGPathElement;
  points: SeaPoint[];
  speed: number;
  baseRGB: [number, number, number];
  colorPhase: number;
  colorAnimAmp: number;
  /** Static anchor ribbon: fixed wave shape + fixed color (a time=0
      snapshot). Interleaved with the animated layers to calm the sea. */
  isStatic: boolean;
}

/* ──────── Ocean builder ──────── */

/* Canvas2D renderer — replaces 21 SVG <path> elements with a single
   <canvas>. The per-frame cost drops from N path string-parses +
   N fill/stroke sets to 1 setTransform + 1 fill + 1 stroke. */
export function buildOcean(
  container: SVGGElement | HTMLElement,
  config: SeaConfig,
): { layers: SeaLayer[]; animate: (time: number) => void } {
  /* The buildOcean signature is shared between the SVG and Canvas
     renderers. The legacy SVG path builder still exists for
     <use> elsewhere; we just branch on container type here. */
  if (container instanceof SVGGElement) {
    return buildOceanSvg(container as SVGGElement, config);
  }
  return buildOceanCanvas(container as HTMLElement, config);
}

/* ──────── Shared CONFIG (used by both renderers) ──────── */
function makeConfig() {
  return {
    layersCount: 28,
    flatSeaRatio: 0.05,
    ampYFar: 0,
    ampYNear: 30,
    stepXFar: 250,
    stepXNear: 155,
    perspectiveYExp: 2.2,
    perspectiveMeshExp: 2.0,
    colorFar: [172, 180, 186] as [number, number, number],
    colorNear: [138, 147, 155] as [number, number, number],
    colorMinClamp: [118, 128, 136] as [number, number, number],
    colorPerspectiveExp: 2.5,
    varianceFar: 2,
    varianceNear: 110,
    colorPeakShift: -0.15,
    colorSpread: 0.5,
    layerAltShift: 10,
    strokeHighlight: 6,
    colorAnimAmpFar: 0.5,
    colorAnimAmpNear: 32,
    colorAnimSpeed: 0.8,
    shapeAnimAmpXFar: 5,
    shapeAnimAmpXNear: 53,
    shapeAnimSpeedX: 0.5,
    globalTimeSpeed: 0.02,
  };
}

/* Pre-computed layer data shared between SVG and Canvas paths.
   All randomness comes from a fixed seeded PRNG, so the wave mesh
   is identical on every page load. */
function buildLayers(
  seaTopY: number, viewWidth: number, viewHeight: number, C: ReturnType<typeof makeConfig>,
  rng: () => number = seededRng(SEA_SEED, 0),
): Array<{
  points: SeaPoint[];
  speed: number;
  baseRGB: [number, number, number];
  colorPhase: number;
  colorAnimAmp: number;
  isStatic: boolean;
}> {
  const layers: Array<{
    points: SeaPoint[]; speed: number;
    baseRGB: [number, number, number];
    colorPhase: number; colorAnimAmp: number;
    isStatic: boolean;
  }> = [];
  for (let i = 0; i < C.layersCount; i++) {
    const progress = i / (C.layersCount - 1);
    const perspectiveY = Math.pow(progress, C.perspectiveYExp);
    const perspectiveMorph = Math.pow(progress, C.perspectiveMeshExp);
    if (perspectiveY < C.flatSeaRatio) continue;

    const baseY = seaTopY + perspectiveY * (viewHeight - seaTopY + 50);
    const baseStepX = C.stepXFar - perspectiveMorph * (C.stepXFar - C.stepXNear);
    const layerSpeed = 0.2 + rng() * 0.4;
    const currentAmpY = C.ampYFar + perspectiveMorph * (C.ampYNear - C.ampYFar);
    const currentAnimAmpX = C.shapeAnimAmpXFar + perspectiveMorph * (C.shapeAnimAmpXNear - C.shapeAnimAmpXFar);
    const currentColorAnimAmp = C.colorAnimAmpFar + perspectiveMorph * (C.colorAnimAmpNear - C.colorAnimAmpFar);

    const points: SeaPoint[] = [];
    let currentX = -300;
    while (currentX < viewWidth + 300) {
      const stepX = baseStepX * (0.6 + rng() * 0.8);
      points.push({
        baseX: currentX, baseY,
        phaseY: currentX * 0.005 + progress * 20 + rng() * 3,
        phaseX: currentX * 0.01 + progress * 10 + rng() * 5,
        ampY: currentAmpY * (0.7 + rng() * 0.5),
        ampX: currentAnimAmpX * (0.5 + rng() * 1.0),
      });
      currentX += stepX;
    }

    const colorProgress = Math.pow(progress, C.colorPerspectiveExp);
    const rBase = C.colorFar[0] - colorProgress * (C.colorFar[0] - C.colorNear[0]);
    const gBase = C.colorFar[1] - colorProgress * (C.colorFar[1] - C.colorNear[1]);
    const bBase = C.colorFar[2] - colorProgress * (C.colorFar[2] - C.colorNear[2]);
    const currentVariance = C.varianceFar + Math.pow(progress, 1.2) * (C.varianceNear - C.varianceFar);
    const currentPeakShift = C.colorPeakShift * Math.pow(progress, 0.5);
    const rawGaussian = gaussianRandom(rng);
    const adjustedRandom = rawGaussian * C.colorSpread + currentPeakShift;
    let lightOffset = adjustedRandom * currentVariance;
    const altShift = (i % 2 === 0 ? C.layerAltShift : -C.layerAltShift) * progress;
    lightOffset += altShift;
    const initR = Math.round(rBase + lightOffset);
    const initG = Math.round(gBase + lightOffset);
    const initB = Math.round(bBase + lightOffset);
    const layerColorPhase = rng() * Math.PI * 2;

    layers.push({
      points, speed: layerSpeed,
      baseRGB: [initR, initG, initB],
      colorPhase: layerColorPhase,
      colorAnimAmp: currentColorAnimAmp,
      /* Every 3rd ribbon is static — a fixed wave + fixed color anchor
         interleaved with the moving ones, so the sea reads calmer. */
      isStatic: i % 3 === 2,
    });
  }
  return layers;
}

/* ──────── Legacy SVG renderer (kept for completeness) ──────── */
function buildOceanSvg(
  container: SVGGElement,
  config: SeaConfig,
): { layers: SeaLayer[]; animate: (time: number) => void } {
  const seaTopY = config.seaTopY;
  const C = makeConfig();
  const baseSeaRect = document.getElementById('base-sea-rect');
  if (baseSeaRect) {
    baseSeaRect.setAttribute('y', String(seaTopY));
    baseSeaRect.setAttribute('height', String(config.viewHeight - seaTopY));
  }
  const layers: SeaLayer[] = buildLayers(seaTopY, config.viewWidth, config.viewHeight, C) as SeaLayer[];
  const svgNS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < layers.length; i++) {
    const pathEl = document.createElementNS(svgNS, 'path') as SVGPathElement;
    pathEl.setAttribute('stroke-width', '1.5');
    pathEl.setAttribute('stroke-linejoin', 'round');
    container.appendChild(pathEl);
    (layers[i] as any).element = pathEl;
  }
  function animate(time: number): void {
    for (const layer of layers) {
      let d = `M -300 ${config.viewHeight} L -300 ${layer.points[0].baseY} `;
      /* Static ribbons use the time=0 snapshot: fixed wave shape,
         so they act as calm anchor bands between the moving ones. */
      const layerTime = layer.isStatic ? 0 : time * layer.speed;
      for (const pt of layer.points) {
        const waveY1 = Math.sin(pt.phaseY + layerTime);
        const waveY2 = 0.2 * Math.cos(pt.phaseY * 1.5 - layerTime * 0.6);
        const currentY = pt.baseY + (waveY1 + waveY2) * pt.ampY;
        const waveX = Math.sin(pt.phaseX + layerTime * C.shapeAnimSpeedX);
        const currentX = pt.baseX + waveX * pt.ampX;
        d += `L ${currentX} ${currentY} `;
      }
      d += `L ${config.viewWidth + 300} ${config.viewHeight} Z`;
      (layer as any).element.setAttribute('d', d);

      /* Static ribbons also keep their base color (no breathing). */
      const colorWave = layer.isStatic ? 0 : Math.sin(time * C.colorAnimSpeed + layer.colorPhase);
      const dynamicOffset = colorWave * layer.colorAnimAmp;
      const finalR = Math.max(C.colorMinClamp[0], Math.min(255, Math.round(layer.baseRGB[0] + dynamicOffset)));
      const finalG = Math.max(C.colorMinClamp[1], Math.min(255, Math.round(layer.baseRGB[1] + dynamicOffset)));
      const finalB = Math.max(C.colorMinClamp[2], Math.min(255, Math.round(layer.baseRGB[2] + dynamicOffset)));
      const strokeR = Math.min(255, finalR + C.strokeHighlight);
      const strokeG = Math.min(255, finalG + C.strokeHighlight);
      const strokeB = Math.min(255, finalB + C.strokeHighlight);
      (layer as any).element.setAttribute('fill', `rgb(${finalR},${finalG},${finalB})`);
      (layer as any).element.setAttribute('stroke', `rgb(${strokeR},${strokeG},${strokeB})`);
    }
  }
  return { layers, animate };
}

/* ──────── Canvas2D renderer (default, perf-critical path) ──────── */
function buildOceanCanvas(
  container: HTMLElement,
  config: SeaConfig,
): { layers: SeaLayer[]; animate: (time: number) => void } {
  const seaTopY = config.seaTopY;
  const C = makeConfig();
  const layers = buildLayers(seaTopY, config.viewWidth, config.viewHeight, C);

  /* Use the SVG viewBox dimensions for the internal canvas resolution,
     so wave vertices fall on the same pixels the SVG would have.
     object-fit:cover maps the bitmap onto the slot with the exact same
     scale/crop math as the sibling SVGs' preserveAspectRatio="slice",
     keeping the sea aligned with clouds/islands. */
  const canvas = document.createElement('canvas');
  canvas.width = config.viewWidth;
  canvas.height = config.viewHeight;
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;

  /* ── Sky gradient (matches the SVG SkyGradient: #d5d7db → #e6e6e6).
     The canvas sits above the SVG sky rect, so it must repaint the sky
     itself. IMPORTANT: the canvas inside <foreignObject> composites its
     transparent pixels as BLACK (foreignObject is its own layer), so
     we must paint an opaque background every frame — never clearRect. */
  const skyGradient = ctx.createLinearGradient(0, 0, 0, config.viewHeight);
  skyGradient.addColorStop(0, '#d5d7db');
  skyGradient.addColorStop(1, '#e6e6e6');

  /* ── Far-sea static gradient (same stops as the SVG BaseSeaGradient:
     colorFar @ 0% → blend @ 5% → colorNear @ 100%). */
  const seaGradient = ctx.createLinearGradient(0, seaTopY, 0, config.viewHeight);
  const firstPolyProgress = Math.pow(C.flatSeaRatio, 1 / C.perspectiveYExp);
  const firstColorProgress = Math.pow(firstPolyProgress, C.colorPerspectiveExp);
  const blend = (a: number, b: number) => Math.round(a - firstColorProgress * (a - b));
  seaGradient.addColorStop(0, `rgb(${C.colorFar[0]},${C.colorFar[1]},${C.colorFar[2]})`);
  seaGradient.addColorStop(
    C.flatSeaRatio,
    `rgb(${blend(C.colorFar[0], C.colorNear[0])},${blend(C.colorFar[1], C.colorNear[1])},${blend(C.colorFar[2], C.colorNear[2])})`
  );
  seaGradient.addColorStop(1, `rgb(${C.colorNear[0]},${C.colorNear[1]},${C.colorNear[2]})`);

  function animate(time: number): void {
    /* Opaque sky gradient above the horizon — matches the SVG sky and
       prevents transparent pixels from showing through as black. */
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, config.viewWidth, seaTopY);
    /* Far-sea gradient base (drawn first, under the wave bands). */
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, seaTopY, config.viewWidth, config.viewHeight - seaTopY);

    for (const layer of layers) {
      /* Static ribbons use the time=0 snapshot: fixed wave shape and
         fixed color, so they read as calm anchor bands. */
      const layerTime = layer.isStatic ? 0 : time * layer.speed;
      ctx.beginPath();
      ctx.moveTo(-300, config.viewHeight);
      ctx.lineTo(-300, layer.points[0].baseY);
      for (const pt of layer.points) {
        const waveY1 = Math.sin(pt.phaseY + layerTime);
        const waveY2 = 0.2 * Math.cos(pt.phaseY * 1.5 - layerTime * 0.6);
        const y = pt.baseY + (waveY1 + waveY2) * pt.ampY;
        const waveX = Math.sin(pt.phaseX + layerTime * C.shapeAnimSpeedX);
        const x = pt.baseX + waveX * pt.ampX;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(config.viewWidth + 300, config.viewHeight);
      ctx.closePath();

      const colorWave = layer.isStatic ? 0 : Math.sin(time * C.colorAnimSpeed + layer.colorPhase);
      const dy = colorWave * layer.colorAnimAmp;
      const r = Math.max(C.colorMinClamp[0], Math.min(255, Math.round(layer.baseRGB[0] + dy)));
      const g = Math.max(C.colorMinClamp[1], Math.min(255, Math.round(layer.baseRGB[1] + dy)));
      const b = Math.max(C.colorMinClamp[2], Math.min(255, Math.round(layer.baseRGB[2] + dy)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.strokeStyle = `rgb(${Math.min(255, r + C.strokeHighlight)},${Math.min(255, g + C.strokeHighlight)},${Math.min(255, b + C.strokeHighlight)})`;
      ctx.stroke();
    }
  }
  return { layers, animate };
}
