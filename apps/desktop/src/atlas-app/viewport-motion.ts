import type { ScreenRect } from "./hero-transition";

export interface CollapseRevealResult {
  rect: ScreenRect;
  cardKey: string;
  didReveal: boolean;
}

export type CollapseRevealHandler = (
  itemId: string,
  preferredKey: string | null,
  durationMs: number,
) => CollapseRevealResult | null;

export interface Point2D {
  x: number;
  y: number;
}

export interface WorldBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutCardBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridZoomAnchor {
  cardId: string | null;
  /** Normalized vertical coordinate [0, 1] inside the anchored card. */
  relYInCard: number;
  /** Cursor Y relative to the scroller's top edge. */
  viewportY: number;
  /** Fallback normalized ratio across total grid height if no card is matched. */
  fallbackRatio: number;
}

export interface GridRevealResult {
  needsScroll: boolean;
  targetScrollTop: number;
}

export interface CanvasRevealResult {
  needsPan: boolean;
  targetPan: Point2D;
  finalScreenRect: ScreenRect;
}

export interface QuickLookWheelState {
  accum: number;
  lastEventAt: number;
  cooldownUntil: number;
}

export interface QuickLookWheelStep {
  direction: -1 | 0 | 1;
  nextState: QuickLookWheelState;
}

const roundTenth = (n: number) => Math.round(n * 10) / 10;

/**
 * Computes the new Canvas / Infinity pan translation so the exact world point
 * currently under `(anchorX, anchorY)` stays locked to that exact screen pixel
 * as zoom changes from `prevZoom` to `nextZoom`.
 */
export function computeCursorAnchoredPan(
  pan: Point2D,
  prevZoom: number,
  nextZoom: number,
  anchorX: number,
  anchorY: number,
): Point2D {
  if (!Number.isFinite(prevZoom) || prevZoom <= 0 || !Number.isFinite(nextZoom)) {
    return { ...pan };
  }
  const ratio = nextZoom / prevZoom;
  return {
    x: roundTenth(anchorX - (anchorX - pan.x) * ratio),
    y: roundTenth(anchorY - (anchorY - pan.y) * ratio),
  };
}

/**
 * Computes a smooth, device-adaptive next zoom value from a wheel or trackpad pinch delta.
 * Trackpad pinches emit fine `deltaY` values (`ctrlKey === true`), while mouse wheels emit
 * larger discrete steps — exponential scaling handles both cleanly without feeling sluggish or jumpy.
 */
export function computeWheelZoomNext(
  currentZoom: number,
  deltaY: number,
  isPinchGesture: boolean,
  minZoom = 0.65,
  maxZoom = 2.4,
): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return currentZoom;
  const clampedDelta = Math.max(-140, Math.min(140, deltaY));
  const isFinePinch = isPinchGesture && Math.abs(clampedDelta) <= 24;
  const sensitivity = isFinePinch ? 0.006 : isPinchGesture ? 0.0032 : 0.0022;
  const factor = Math.exp(-clampedDelta * sensitivity);
  const raw = currentZoom * factor;
  const clamped = Math.min(maxZoom, Math.max(minZoom, raw));
  return Math.round(clamped * 100) / 100;
}

/**
 * Captures which card (and exact fractional vertical position inside it) lies beneath
 * the user's cursor in Grid view right before a zoom change.
 */
export function computeGridCursorAnchor(
  cards: readonly LayoutCardBox[],
  contentX: number,
  contentY: number,
  viewportY: number,
  totalHeight: number,
): GridZoomAnchor {
  const safeTotal = Math.max(1, totalHeight);
  const fallbackRatio = Math.max(0, Math.min(1, contentY / safeTotal));

  if (cards.length === 0) {
    return {
      cardId: null,
      relYInCard: 0.5,
      viewportY,
      fallbackRatio,
    };
  }

  // 1. Direct hit test under cursor
  for (const card of cards) {
    if (
      contentX >= card.x &&
      contentX <= card.x + card.width &&
      contentY >= card.y &&
      contentY <= card.y + card.height
    ) {
      const relY =
        card.height > 0 ? Math.max(0, Math.min(1, (contentY - card.y) / card.height)) : 0.5;
      return {
        cardId: card.id,
        relYInCard: relY,
        viewportY,
        fallbackRatio,
      };
    }
  }

  // 2. Cursor is in spacing gap — pick nearest card center
  let bestCard = cards[0]!;
  let bestDist = Infinity;
  for (const card of cards) {
    const cx = card.x + card.width * 0.5;
    const cy = card.y + card.height * 0.5;
    const dist = Math.hypot(cx - contentX, cy - contentY);
    if (dist < bestDist) {
      bestDist = dist;
      bestCard = card;
    }
  }
  const relY =
    bestCard.height > 0
      ? Math.max(0, Math.min(1, (contentY - bestCard.y) / bestCard.height))
      : 0.5;

  return {
    cardId: bestCard.id,
    relYInCard: relY,
    viewportY,
    fallbackRatio,
  };
}

/**
 * Computes the exact `scrollTop` after Grid re-layout at a new zoom so the anchored card
 * stays pinned directly underneath the user's cursor (`anchor.viewportY`).
 */
export function computeGridAnchoredScrollTop(
  newCards: readonly LayoutCardBox[],
  anchor: GridZoomAnchor,
  newTotalHeight: number,
  scrollerClientHeight: number,
  contentPaddingTop = 0,
): number {
  const maxScrollTop = Math.max(0, newTotalHeight + contentPaddingTop - scrollerClientHeight);
  if (maxScrollTop <= 0) return 0;

  if (anchor.cardId) {
    const match = newCards.find((c) => c.id === anchor.cardId);
    if (match) {
      const targetContentY = contentPaddingTop + match.y + anchor.relYInCard * match.height;
      const rawScroll = targetContentY - anchor.viewportY;
      return Math.round(Math.max(0, Math.min(maxScrollTop, rawScroll)));
    }
  }

  const fallbackScroll =
    contentPaddingTop + anchor.fallbackRatio * newTotalHeight - anchor.viewportY;
  return Math.round(Math.max(0, Math.min(maxScrollTop, fallbackScroll)));
}

/**
 * Determines whether a Grid card needs to be scrolled into view when collapsing from QuickLook.
 * If it is off-screen or clipped outside `safeMargin`, returns a centered `targetScrollTop`.
 */
export function computeGridRevealScrollTop(
  cardTopInScroller: number,
  cardHeight: number,
  currentScrollTop: number,
  viewportHeight: number,
  totalScrollHeight: number,
  safeMargin = 68,
): GridRevealResult {
  const maxScrollTop = Math.max(0, totalScrollHeight - viewportHeight);
  const clampedCurrent = Math.max(0, Math.min(maxScrollTop, currentScrollTop));

  const visibleTop = clampedCurrent + safeMargin;
  const visibleBottom = clampedCurrent + Math.max(safeMargin + 40, viewportHeight - safeMargin);
  const cardBottom = cardTopInScroller + cardHeight;

  // Already comfortably inside the visible viewport (or taller than viewport and covering center)
  const comfortablyInside =
    cardTopInScroller >= visibleTop && cardBottom <= visibleBottom;
  const tallAndCentered =
    cardHeight > visibleBottom - visibleTop &&
    cardTopInScroller <= visibleTop &&
    cardBottom >= visibleBottom;

  if (comfortablyInside || tallAndCentered) {
    return {
      needsScroll: false,
      targetScrollTop: clampedCurrent,
    };
  }

  const centered = cardTopInScroller + cardHeight * 0.5 - viewportHeight * 0.5;
  const targetScrollTop = Math.round(Math.max(0, Math.min(maxScrollTop, centered)));
  return {
    needsScroll: Math.abs(targetScrollTop - clampedCurrent) >= 2,
    targetScrollTop,
  };
}

/**
 * Determines whether a Canvas world card is outside (or clipped by) the visible stage area
 * when collapsing from QuickLook. If off-screen, computes a smooth centered `targetPan` and
 * returns the exact post-pan destination `ScreenRect` so the collapsing hero flies straight
 * into its final landed slot.
 */
export function computeCanvasRevealForCollapse(
  worldBox: WorldBox,
  pan: Point2D,
  zoom: number,
  stageLeft: number,
  stageTop: number,
  stageWidth: number,
  stageHeight: number,
  sidebarOffset: number,
  safeMargin = 72,
): CanvasRevealResult {
  const safeZoom = Math.max(0.1, zoom);
  const screenW = roundTenth(worldBox.width * safeZoom);
  const screenH = roundTenth(worldBox.height * safeZoom);

  const curLocalX = pan.x + worldBox.x * safeZoom;
  const curLocalY = pan.y + worldBox.y * safeZoom;

  const minLeft = sidebarOffset + safeMargin;
  const maxRight = Math.max(minLeft + 80, stageWidth - safeMargin);
  const minTop = safeMargin;
  const maxBottom = Math.max(minTop + 80, stageHeight - safeMargin);

  const fitsHorizontally =
    curLocalX >= minLeft && curLocalX + screenW <= maxRight;
  const fitsVertically =
    curLocalY >= minTop && curLocalY + screenH <= maxBottom;

  if (fitsHorizontally && fitsVertically) {
    return {
      needsPan: false,
      targetPan: { ...pan },
      finalScreenRect: {
        left: roundTenth(stageLeft + curLocalX),
        top: roundTenth(stageTop + curLocalY),
        width: screenW,
        height: screenH,
      },
    };
  }

  const usableWidth = Math.max(120, stageWidth - sidebarOffset);
  const targetCenterLocalX = sidebarOffset + usableWidth * 0.5;
  const targetCenterLocalY = stageHeight * 0.5;
  const worldCx = worldBox.x + worldBox.width * 0.5;
  const worldCy = worldBox.y + worldBox.height * 0.5;

  const targetPan: Point2D = {
    x: roundTenth(targetCenterLocalX - worldCx * safeZoom),
    y: roundTenth(targetCenterLocalY - worldCy * safeZoom),
  };

  return {
    needsPan:
      Math.hypot(targetPan.x - pan.x, targetPan.y - pan.y) >= 2,
    targetPan,
    finalScreenRect: {
      left: roundTenth(stageLeft + targetPan.x + worldBox.x * safeZoom),
      top: roundTenth(stageTop + targetPan.y + worldBox.y * safeZoom),
      width: screenW,
      height: screenH,
    },
  };
}

/**
 * Evaluates cubic-bezier(0.22, 1, 0.36, 1) — identical to `HERO_MOTION_EASE` — so RAF
 * scroll-reveal animations move in exact lockstep with Framer Motion's QuickLook collapse.
 */
export function sampleHeroEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x1 = 0.22;
  const y1 = 1;
  const x2 = 0.36;
  const y2 = 1;

  // Solve B_x(u) = t using Newton-Raphson iterations
  let u = t;
  for (let i = 0; i < 6; i++) {
    const inv = 1 - u;
    const bx = 3 * inv * inv * u * x1 + 3 * inv * u * u * x2 + u * u * u;
    const dbx =
      3 * inv * inv * x1 +
      6 * inv * u * (x2 - x1) +
      3 * u * u * (1 - x2);
    if (Math.abs(dbx) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - (bx - t) / dbx));
  }
  const inv = 1 - u;
  return 3 * inv * inv * u * y1 + 3 * inv * u * u * y2 + u * u * u;
}

/**
 * Pure wheel/trackpad gesture recognizer for scrolling between cards while QuickLook is open.
 * Handles both mouse wheel (`deltaY`) and two-finger horizontal swipe (`deltaX`) with
 * momentum cooldown so a single gesture advances cleanly by one item.
 */
export function stepQuickLookWheelNavigation(
  state: QuickLookWheelState,
  deltaX: number,
  deltaY: number,
  nowMs: number,
  canGoPrev: boolean,
  canGoNext: boolean,
  thresholdPx = 34,
  cooldownMs = 300,
): QuickLookWheelStep {
  // Choose dominant axis: horizontal swipe takes priority if clearly horizontal
  const primaryDelta =
    Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? deltaX : deltaY;

  if (!Number.isFinite(primaryDelta) || Math.abs(primaryDelta) < 0.5) {
    return { direction: 0, nextState: state };
  }

  // Ignore trailing trackpad momentum during cooldown window
  if (nowMs < state.cooldownUntil) {
    return {
      direction: 0,
      nextState: {
        ...state,
        accum: 0,
        lastEventAt: nowMs,
      },
    };
  }

  const isStale = nowMs - state.lastEventAt > 180;
  const reversed =
    state.accum !== 0 && Math.sign(primaryDelta) !== Math.sign(state.accum);
  const nextAccum = (isStale || reversed ? 0 : state.accum) + primaryDelta;

  if (nextAccum >= thresholdPx) {
    if (!canGoNext) {
      return {
        direction: 0,
        nextState: { accum: 0, lastEventAt: nowMs, cooldownUntil: state.cooldownUntil },
      };
    }
    return {
      direction: 1,
      nextState: {
        accum: 0,
        lastEventAt: nowMs,
        cooldownUntil: nowMs + cooldownMs,
      },
    };
  }

  if (nextAccum <= -thresholdPx) {
    if (!canGoPrev) {
      return {
        direction: 0,
        nextState: { accum: 0, lastEventAt: nowMs, cooldownUntil: state.cooldownUntil },
      };
    }
    return {
      direction: -1,
      nextState: {
        accum: 0,
        lastEventAt: nowMs,
        cooldownUntil: nowMs + cooldownMs,
      },
    };
  }

  return {
    direction: 0,
    nextState: {
      accum: nextAccum,
      lastEventAt: nowMs,
      cooldownUntil: state.cooldownUntil,
    },
  };
}
