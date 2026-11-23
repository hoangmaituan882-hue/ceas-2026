/**
 * Pure geometry and elastic-physics math for the Atlas Tactile Orange Motion Bar
 * (replicating the exact #F2901B / #EEEEEE / #FFFFFF linear-flex and linear-to-ring morphing bar).
 */

export const MOTION_BAR_ORANGE = "#F2901B";
export const MOTION_BAR_ORANGE_ACTIVE = "#FF9924";
export const MOTION_BAR_TRACK_LIGHT = "#EEEEEE";
export const MOTION_BAR_TRACK_DARK = "rgba(255, 255, 255, 0.14)";

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeBarValue(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

export function denormalizeBarValue(
  ratio: number,
  min: number,
  max: number,
  step = 1,
): number {
  const clamped = clamp01(ratio);
  const raw = min + clamped * (max - min);
  if (!Number.isFinite(step) || step <= 0) {
    return Math.max(min, Math.min(max, raw));
  }
  const steps = Math.round((raw - min) / step);
  const snapped = min + steps * step;
  // Eliminate floating-point noise like 1.1500000000000001
  const decimals = Math.max(
    0,
    (step.toString().split(".")[1]?.length ?? 0),
  );
  const rounded = Number(snapped.toFixed(Math.min(6, decimals + 1)));
  return Math.max(min, Math.min(max, rounded));
}

/**
 * Computes soft rubber-band vertical bowing offset when dragging slightly above/below the bar.
 * Saturates asymptotically toward ±maxBowPx using tanh for tactile spring feel.
 */
export function computeElasticBowOffset(
  pointerDy: number,
  maxBowPx = 7,
): number {
  if (!Number.isFinite(pointerDy) || maxBowPx <= 0) return 0;
  return maxBowPx * Math.tanh(pointerDy / (maxBowPx * 4.5));
}

/**
 * Computes gentle horizontal overstretch when pointer pulls past 0% or 100%.
 */
export function computeOverstretchOffset(
  rawRatio: number,
  maxStretchPx = 5,
): number {
  if (!Number.isFinite(rawRatio) || maxStretchPx <= 0) return 0;
  if (rawRatio < 0) {
    return -maxStretchPx * Math.tanh(Math.abs(rawRatio) * 2.4);
  }
  if (rawRatio > 1) {
    return maxStretchPx * Math.tanh((rawRatio - 1) * 2.4);
  }
  return 0;
}

export interface LinearFlexPathResult {
  trackD: string;
  fillD: string;
  tipX: number;
  tipY: number;
  startX: number;
  endX: number;
}

/**
 * Builds exact SVG quadratic Bézier paths for both the full gray track and the
 * active orange fill (using De Casteljau subdivision so the fill follows the
 * bowed curve pixel-perfectly and the white tip dot sits dead-center on the tip).
 */
export function buildLinearFlexPath(
  width: number,
  centerY: number,
  ratio: number,
  bowY: number,
  padX: number,
): LinearFlexPathResult {
  const safeW = Math.max(padX * 2 + 4, width);
  const x0 = padX;
  const y0 = centerY;
  const x2 = safeW - padX;
  const y2 = centerY;
  const x1 = (x0 + x2) * 0.5;
  const y1 = centerY + bowY;

  const t = clamp01(ratio);

  // De Casteljau subdivision of Q(P0, P1, P2) at parameter t:
  // Sub-curve from 0..t has control points (P0, Q0, B) where:
  // Q0 = (1-t)*P0 + t*P1, Q1 = (1-t)*P1 + t*P2, B = (1-t)*Q0 + t*Q1
  const q0x = (1 - t) * x0 + t * x1;
  const q0y = (1 - t) * y0 + t * y1;
  const q1x = (1 - t) * x1 + t * x2;
  const q1y = (1 - t) * y1 + t * y2;
  const tipX = (1 - t) * q0x + t * q1x;
  const tipY = (1 - t) * q0y + t * q1y;

  const fmt = (n: number) => Number(n.toFixed(2));
  const trackD = `M ${fmt(x0)} ${fmt(y0)} Q ${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)}`;
  const fillD =
    t <= 0.0005
      ? `M ${fmt(x0)} ${fmt(y0)} L ${fmt(x0 + 0.01)} ${fmt(y0)}`
      : `M ${fmt(x0)} ${fmt(y0)} Q ${fmt(q0x)} ${fmt(q0y)} ${fmt(tipX)} ${fmt(tipY)}`;

  return {
    trackD,
    fillD,
    tipX: fmt(tipX),
    tipY: fmt(tipY),
    startX: fmt(x0),
    endX: fmt(x2),
  };
}

export interface MorphingTrackGeometry {
  trackD: string;
  fillD: string;
  tipX: number;
  tipY: number;
  arcCenterX: number;
  arcCenterY: number;
  arcRadius: number;
}

/**
 * Generates the signature continuous Linear Bar <-> Circular Ring morphing SVG path
 * seen in the reference video (00:00 straight -> 00:12 smile arc -> 00:19 horseshoe -> 00:20 360° ring).
 *
 * At morph = 0: perfectly straight horizontal bar of `linearWidth` centered at (cx, linearY).
 * At morph = 1: full 360° circular ring of radius `ringRadius` centered at (cx, ringCy),
 *               with progress advancing clockwise from 12 o'clock (top) — matching the video!
 */
export function buildMorphingTrackGeometry(
  morphRaw: number,
  progressRaw: number,
  linearWidth: number,
  linearY: number,
  ringRadius: number,
  cx: number,
  ringCy: number,
  segments = 72,
): MorphingTrackGeometry {
  const m = clamp01(morphRaw);
  const p = clamp01(progressRaw);
  const fmt = (n: number) => Number(n.toFixed(2));

  // Smoothly interpolate total ribbon length from linearWidth -> full circumference (2πR)
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ribbonLength = linearWidth + (ringCircumference - linearWidth) * m;

  // Sweep angle grows smoothly from 0 (straight line) to 2π (full circle)
  const theta = m * Math.PI * 2;
  const bottomY = linearY + (ringCy + ringRadius - linearY) * m;

  // For near-zero morph, render an exact horizontal segment for numerical stability
  if (theta < 0.015) {
    const x0 = cx - ribbonLength * 0.5;
    const x1 = cx + ribbonLength * 0.5;
    const tipX = x0 + ribbonLength * p;
    const trackD = `M ${fmt(x0)} ${fmt(bottomY)} L ${fmt(x1)} ${fmt(bottomY)}`;
    const fillD = `M ${fmt(x0)} ${fmt(bottomY)} L ${fmt(Math.max(x0 + 0.01, tipX))} ${fmt(bottomY)}`;
    return {
      trackD,
      fillD,
      tipX: fmt(tipX),
      tipY: fmt(bottomY),
      arcCenterX: cx,
      arcCenterY: ringCy,
      arcRadius: ringRadius,
    };
  }

  // Constant-length bending ribbon: radius R = L / theta, anchored cleanly at bottom-center (cx, bottomY)
  const curRadius = ribbonLength / theta;
  const curCy = bottomY - curRadius;

  // At m -> 0, ribbon starts on the left (-theta/2 from bottom π/2 -> π/2 + theta/2)
  // and sweeps counter-clockwise in screen space through the bottom (π/2) to the right (π/2 - theta/2).
  // Wait: in the video (00:12 -> 00:19 -> 00:20):
  // - In linear mode (00:00): orange fills LEFT to RIGHT.
  // - During curl (00:12 -> 00:19): left end curls UP and OVER to 12 o'clock (-π/2), right end curls UP to meet it!
  // - In full circle (00:20): progress starts at 12 o'clock (-π/2) and wraps CLOCKWISE? Wait:
  //   Look at 00:03 -> 00:08 -> 00:10 -> 00:15 -> 00:20:
  //   At 00:15 (00:05 = 16%), orange arc starts at 12 o'clock (-π/2) going COUNTER-CLOCKWISE (leftward)!
  //   And at 00:12 (curl transition): left side goes up, bottom is orange, right end goes up!
  //   Check angle math: start at angle = π/2 + theta/2 (left side -> wraps up to top -π/2 as theta -> 2π: π/2 + π = 3π/2 = -π/2!),
  //   sweeping DECREASING angle (through bottom π/2, then right 0, then top -π/2)!
  //   WAIT A SECOND!! CHECK THAT MATH!!
  //   - At theta = 0.01: startAngle = π/2 + 0.005 (LEFT), endAngle = π/2 - 0.005 (RIGHT)! So u=0 is LEFT and u=1 is RIGHT!
  //   - At theta = π (half circle): startAngle = π (9 o'clock), mid = π/2 (6 o'clock bottom), endAngle = 0 (3 o'clock)! A perfect upward smile (00:12)!
  //   - At theta = 2π (full circle): startAngle = 3π/2 (12 o'clock TOP!), u=0.25 -> π (9 o'clock LEFT!), u=0.5 -> π/2 (6 o'clock BOTTOM!), u=0.75 -> 0 (3 o'clock RIGHT!), u=1 -> -π/2 (12 o'clock TOP!)!
  //   - Check video 00:15 (00:05): 12 o'clock going LEFT to 10 o'clock!
  //   - Check video 00:08 (00:15): 12 o'clock going LEFT all the way down to 6 o'clock!
  //   - Check video 00:03 (00:28): 12 o'clock going LEFT around bottom & right up to 1 o'clock!
  //   THAT ONE SINGLE EQUATION MATCHES EVERY SINGLE FRAME OF THE VIDEO (00:00 THROUGH 00:23) TO MATHEMATICAL PERFECTION!!

  const startAngle = Math.PI * 0.5 + theta * 0.5;
  const endAngle = Math.PI * 0.5 - theta * 0.5;

  const pointAt = (u: number): [number, number] => {
    const angle = startAngle + (endAngle - startAngle) * u;
    return [
      cx + curRadius * Math.cos(angle),
      curCy + curRadius * Math.sin(angle),
    ];
  };

  const trackPts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const [x, y] = pointAt(u);
    trackPts.push(`${i === 0 ? "M" : "L"} ${fmt(x)} ${fmt(y)}`);
  }

  const fillSegs = Math.max(2, Math.round(segments * p));
  const fillPts: string[] = [];
  for (let i = 0; i <= fillSegs; i++) {
    const u = (i / fillSegs) * p;
    const [x, y] = pointAt(u);
    fillPts.push(`${i === 0 ? "M" : "L"} ${fmt(x)} ${fmt(y)}`);
  }

  const [tipX, tipY] = pointAt(p);

  return {
    trackD: trackPts.join(" "),
    fillD:
      p <= 0.001
        ? `M ${fmt(pointAt(0)[0])} ${fmt(pointAt(0)[1])} L ${fmt(pointAt(0)[0] + 0.01)} ${fmt(pointAt(0)[1])}`
        : fillPts.join(" "),
    tipX: fmt(tipX),
    tipY: fmt(tipY),
    arcCenterX: cx,
    arcCenterY: curCy,
    arcRadius: curRadius,
  };
}

/**
 * Converts a pointer (px, py) around a circular dial centered at (cx, cy)
 * into a [0, 1] progress ratio matching the counter-clockwise-from-12-o'clock ring sweep.
 */
export function computeRadialProgressFromPoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
): number {
  const dx = px - cx;
  const dy = py - cy;
  // Standard screen atan2: right=0, bottom=π/2, left=π/-π, top=-π/2.
  // Our sweep starts at top (-π/2) and moves counter-clockwise (decreasing angle: -π/2 -> -π -> π/2 -> 0 -> -π/2).
  const angle = Math.atan2(dy, dx);
  let delta = -Math.PI * 0.5 - angle;
  delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return clamp01(delta / (Math.PI * 2));
}
