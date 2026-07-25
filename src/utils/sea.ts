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

/* ──────── Helpers ──────── */
function gaussianRandom(): number {
  let rand = 0;
  for (let i = 0; i < 6; i++) rand += Math.random();
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
  element: SVGPathElement;
  points: SeaPoint[];
  speed: number;
  baseRGB: [number, number, number];
  colorPhase: number;
  colorAnimAmp: number;
}

/* ──────── Ocean builder ──────── */
export function buildOcean(
  container: SVGGElement,
  config: SeaConfig,
): { layers: SeaLayer[]; animate: (time: number) => void } {
  const seaTopY = config.seaTopY;
  const CONFIG = {
    layersCount: 40,
    flatSeaRatio: 0.05,
    ampYFar: 0,
    ampYNear: 58,
    stepXFar: 221,
    stepXNear: 133,
    perspectiveYExp: 2.2,
    perspectiveMeshExp: 2.0,
    colorFar: [164, 173, 180] as [number, number, number],
    colorNear: [85, 95, 105] as [number, number, number],
    colorMinClamp: [70, 80, 90] as [number, number, number],
    colorPerspectiveExp: 2.5,
    varianceFar: 2,
    varianceNear: 260,
    colorPeakShift: -0.45,
    colorSpread: 0.5,
    layerAltShift: 15,
    strokeHighlight: 4,
    colorAnimAmpFar: 0.5,
    colorAnimAmpNear: 32,
    colorAnimSpeed: 0.8,
    shapeAnimAmpXFar: 5,
    shapeAnimAmpXNear: 53,
    shapeAnimSpeedX: 0.5,
    globalTimeSpeed: 0.02,
  };

  const layers: SeaLayer[] = [];

  /* Sync base sea gradient */
  const baseSeaRect = document.getElementById('base-sea-rect');
  if (baseSeaRect) {
    baseSeaRect.setAttribute('y', String(seaTopY));
    baseSeaRect.setAttribute('height', String(config.viewHeight - seaTopY));
  }

  /* Compute gradient stops using the FINAL seaTopY */
  const firstPolyProgress = Math.pow(CONFIG.flatSeaRatio, 1 / CONFIG.perspectiveYExp);
  const firstColorProgress = Math.pow(firstPolyProgress, CONFIG.colorPerspectiveExp);
  const rBlend = Math.round(
    CONFIG.colorFar[0] - firstColorProgress * (CONFIG.colorFar[0] - CONFIG.colorNear[0])
  );
  const gBlend = Math.round(
    CONFIG.colorFar[1] - firstColorProgress * (CONFIG.colorFar[1] - CONFIG.colorNear[1])
  );
  const bBlend = Math.round(
    CONFIG.colorFar[2] - firstColorProgress * (CONFIG.colorFar[2] - CONFIG.colorNear[2])
  );
  const gradStopFar = document.getElementById('grad-stop-far');
  const gradStopMid = document.getElementById('grad-stop-mid');
  const gradStopNear = document.getElementById('grad-stop-near');
  if (gradStopFar)
    gradStopFar.setAttribute('stop-color', `rgb(${CONFIG.colorFar.join(',')})`);
  if (gradStopMid) {
    gradStopMid.setAttribute('offset', `${CONFIG.flatSeaRatio * 100}%`);
    gradStopMid.setAttribute('stop-color', `rgb(${rBlend},${gBlend},${bBlend})`);
  }
  if (gradStopNear)
    gradStopNear.setAttribute('stop-color', `rgb(${CONFIG.colorNear.join(',')})`);

  /* Build layers */
  const svgNS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < CONFIG.layersCount; i++) {
    const progress = i / (CONFIG.layersCount - 1);
    const perspectiveY = Math.pow(progress, CONFIG.perspectiveYExp);
    const perspectiveMorph = Math.pow(progress, CONFIG.perspectiveMeshExp);
    if (perspectiveY < CONFIG.flatSeaRatio) continue;

    const baseY = seaTopY + perspectiveY * (config.viewHeight - seaTopY + 50);
    const baseStepX = CONFIG.stepXFar - perspectiveMorph * (CONFIG.stepXFar - CONFIG.stepXNear);
    const layerSpeed = 0.2 + Math.random() * 0.4;
    const currentAmpY = CONFIG.ampYFar + perspectiveMorph * (CONFIG.ampYNear - CONFIG.ampYFar);
    const currentAnimAmpX = CONFIG.shapeAnimAmpXFar + perspectiveMorph * (CONFIG.shapeAnimAmpXNear - CONFIG.shapeAnimAmpXFar);
    const currentColorAnimAmp = CONFIG.colorAnimAmpFar + perspectiveMorph * (CONFIG.colorAnimAmpNear - CONFIG.colorAnimAmpFar);

    const points: SeaPoint[] = [];
    let currentX = -300;
    while (currentX < config.viewWidth + 300) {
      const stepX = baseStepX * (0.6 + Math.random() * 0.8);
      points.push({
        baseX: currentX,
        baseY,
        phaseY: currentX * 0.005 + progress * 20 + Math.random() * 3,
        phaseX: currentX * 0.01 + progress * 10 + Math.random() * 5,
        ampY: currentAmpY * (0.7 + Math.random() * 0.5),
        ampX: currentAnimAmpX * (0.5 + Math.random() * 1.0),
      });
      currentX += stepX;
    }

    /* Color */
    const colorProgress = Math.pow(progress, CONFIG.colorPerspectiveExp);
    const rBase = CONFIG.colorFar[0] - colorProgress * (CONFIG.colorFar[0] - CONFIG.colorNear[0]);
    const gBase = CONFIG.colorFar[1] - colorProgress * (CONFIG.colorFar[1] - CONFIG.colorNear[1]);
    const bBase = CONFIG.colorFar[2] - colorProgress * (CONFIG.colorFar[2] - CONFIG.colorNear[2]);
    const currentVariance = CONFIG.varianceFar + Math.pow(progress, 1.2) * (CONFIG.varianceNear - CONFIG.varianceFar);
    const currentPeakShift = CONFIG.colorPeakShift * Math.pow(progress, 0.5);
    const rawGaussian = gaussianRandom();
    const adjustedRandom = rawGaussian * CONFIG.colorSpread + currentPeakShift;
    let lightOffset = adjustedRandom * currentVariance;
    const altShift = (i % 2 === 0 ? CONFIG.layerAltShift : -CONFIG.layerAltShift) * progress;
    lightOffset += altShift;
    const initR = Math.round(rBase + lightOffset);
    const initG = Math.round(gBase + lightOffset);
    const initB = Math.round(bBase + lightOffset);
    const layerColorPhase = Math.random() * Math.PI * 2;

    const pathEl = document.createElementNS(svgNS, 'path') as SVGPathElement;
    pathEl.setAttribute('stroke-width', '1.5');
    pathEl.setAttribute('stroke-linejoin', 'round');
    container.appendChild(pathEl);
    layers.push({
      element: pathEl, points, speed: layerSpeed,
      baseRGB: [initR, initG, initB],
      colorPhase: layerColorPhase,
      colorAnimAmp: currentColorAnimAmp,
    });
  }

  /* ──── Animation tick ──── */
  function animate(time: number): void {
    for (const layer of layers) {
      let d = `M -300 ${config.viewHeight} L -300 ${layer.points[0].baseY} `;
      for (const pt of layer.points) {
        const layerTime = time * layer.speed;
        const waveY1 = Math.sin(pt.phaseY + layerTime);
        const waveY2 = 0.2 * Math.cos(pt.phaseY * 1.5 - layerTime * 0.6);
        const currentY = pt.baseY + (waveY1 + waveY2) * pt.ampY;
        const waveX = Math.sin(pt.phaseX + layerTime * CONFIG.shapeAnimSpeedX);
        const currentX = pt.baseX + waveX * pt.ampX;
        d += `L ${currentX} ${currentY} `;
      }
      d += `L ${config.viewWidth + 300} ${config.viewHeight} Z`;
      layer.element.setAttribute('d', d);

      const colorWave = Math.sin(time * CONFIG.colorAnimSpeed + layer.colorPhase);
      const dynamicOffset = colorWave * layer.colorAnimAmp;
      const finalR = Math.max(CONFIG.colorMinClamp[0], Math.min(255, Math.round(layer.baseRGB[0] + dynamicOffset)));
      const finalG = Math.max(CONFIG.colorMinClamp[1], Math.min(255, Math.round(layer.baseRGB[1] + dynamicOffset)));
      const finalB = Math.max(CONFIG.colorMinClamp[2], Math.min(255, Math.round(layer.baseRGB[2] + dynamicOffset)));
      const strokeR = Math.min(255, finalR + CONFIG.strokeHighlight);
      const strokeG = Math.min(255, finalG + CONFIG.strokeHighlight);
      const strokeB = Math.min(255, finalB + CONFIG.strokeHighlight);
      layer.element.setAttribute('fill', `rgb(${finalR},${finalG},${finalB})`);
      layer.element.setAttribute('stroke', `rgb(${strokeR},${strokeG},${strokeB})`);
    }
  }

  return { layers, animate };
}
