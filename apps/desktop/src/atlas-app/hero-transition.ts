export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WhiteboardPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PushOffset {
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
}

export interface HeroPushContext {
  /** True while QuickLook is actively open; flips false the instant closing starts so neighbors return in lockstep. */
  active: boolean;
  heroKey: string | null;
  originRect: ScreenRect | null;
  targetRect: ScreenRect | null;
}

/** Shared Apple-native motion curve & durations synchronizing Hero, Veil, Sidebar, and Neighbor Push-Out. */
export const HERO_MOTION_EASE: readonly [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
export const HERO_OPEN_DURATION_S = 0.36;
export const HERO_CLOSE_DURATION_S = 0.32;
export const HERO_CSS_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export type QuickLookPhase = "open" | "closing" | "landing";

export interface HeroHandoffFlags {
  /** Underlying card in Grid/Canvas/Infinity stays hidden ONLY while hero is open or flying back.
   *  The instant `landing` begins, the underlying card becomes synchronously visible underneath
   *  the hero frame for 2 animation frames BEFORE the hero unmounts—guaranteeing zero blank-frame flash! */
  hideUnderlyingCard: boolean;
  /** Keep QuickLook overlay mounted during `landing` so double-buffered handoff completes cleanly. */
  keepHeroMounted: boolean;
  /** Radial neighbor push-out active state. */
  neighborsPushed: boolean;
}

export function resolveHeroHandoffFlags(
  phase: QuickLookPhase | null,
  radialNeighborPush: boolean,
): HeroHandoffFlags {
  if (!phase) {
    return {
      hideUnderlyingCard: false,
      keepHeroMounted: false,
      neighborsPushed: false,
    };
  }
  return {
    hideUnderlyingCard: phase !== "landing",
    keepHeroMounted: true,
    neighborsPushed: radialNeighborPush && phase === "open",
  };
}

/**
 * Shared wall-clock phase in [0, 1) so procedural GIF thumbnails on Grid/Canvas
 * and the QuickLook GIF studio stay in lockstep with zero animation phase jump.
 */
export function computeSharedGifPhase(
  nowMs: number,
  loopDurationMs = 2600,
): number {
  const safeLoop = Math.max(200, loopDurationMs);
  return (((nowMs % safeLoop) + safeLoop) % safeLoop) / safeLoop;
}

export interface SurfaceToneDescriptor {
  kind: string;
  fontTone?: "paper" | "ink" | "cobalt";
  gifKind?: "kinetic-type" | "fluid-orb" | "iso-grid";
}

/**
 * Returns the exact native background surface tone for a QuickLook hero container
 * on frame 0 so expanding cards never flash an off-color white/dark background.
 */
export function getQuickLookFrameSurfaceColor(
  desc: SurfaceToneDescriptor,
  theme: "light" | "dark",
): string {
  const dark = theme === "dark";
  if (desc.kind === "font") {
    if (desc.fontTone === "ink") return "#191a1e";
    if (desc.fontTone === "cobalt") return "#102a5c";
    return "#f6f2ea";
  }
  if (desc.kind === "audio") {
    return dark ? "#1c1d22" : "#ffffff";
  }
  if (desc.kind === "model3d") {
    return dark ? "#1d1e22" : "#f1f2f5";
  }
  if (desc.kind === "gif") {
    if (desc.gifKind === "iso-grid") return dark ? "#191a1d" : "#eceef2";
    if (desc.gifKind === "fluid-orb") return dark ? "#141821" : "#eef4ff";
    return dark ? "#141518" : "#f4f1ea";
  }
  if (desc.kind === "video") {
    return "#101114";
  }
  return dark ? "#18181b" : "#f4f4f6";
}

/**
 * Computes the centered destination rectangle for the QuickLook hero image
 * inside the viewport, preserving natural aspect ratio while leaving room for
 * the minimal macOS topbar, bottom dock, and optional right Inspector drawer.
 */
export function computeLightboxTargetRect(
  viewportWidth: number,
  viewportHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  inspectorOpen: boolean,
): ScreenRect {
  const isMobile = viewportWidth <= 768;
  const topInset = isMobile ? 58 : 64;
  const bottomInset =
    inspectorOpen && isMobile
      ? Math.min(Math.round(viewportHeight * 0.56) + 16, 496)
      : 68;
  const sideInset = isMobile ? 20 : 64;
  const inspectorWidth = inspectorOpen && !isMobile ? 316 : 0;

  const stageWidth = Math.max(220, viewportWidth - inspectorWidth);
  const availWidth = Math.max(180, stageWidth - sideInset * 2);
  const availHeight = Math.max(150, viewportHeight - topInset - bottomInset);

  const safeW = naturalWidth > 0 ? naturalWidth : 1200;
  const safeH = naturalHeight > 0 ? naturalHeight : 900;

  const scale = Math.min(availWidth / safeW, availHeight / safeH, 1.45);
  const width = Math.round(safeW * scale);
  const height = Math.round(safeH * scale);

  const left = Math.round((stageWidth - width) / 2);
  const top = Math.round(topInset + (availHeight - height) / 2);

  return { left, top, width, height };
}

/**
 * Computes the radial "parting / push-out" offset for a neighboring card when
 * the clicked hero image expands from `heroOriginRect` to `heroTargetRect`.
 *
 * Cards around the opened image are smoothly pushed outward along the radial
 * vector away from the hero center, and return in exact lockstep on close.
 */
export function computeNeighborPushOffset(
  cardRect: ScreenRect,
  heroOriginRect: ScreenRect | null,
  heroTargetRect: ScreenRect | null,
  active: boolean,
): PushOffset {
  if (!active || !heroOriginRect || !heroTargetRect) {
    return { dx: 0, dy: 0, scale: 1, opacity: 1 };
  }

  const heroCx = heroOriginRect.left + heroOriginRect.width / 2;
  const heroCy = heroOriginRect.top + heroOriginRect.height / 2;
  const cardCx = cardRect.left + cardRect.width / 2;
  const cardCy = cardRect.top + cardRect.height / 2;

  const vx = cardCx - heroCx;
  const vy = cardCy - heroCy;
  const dist = Math.hypot(vx, vy);
  if (dist < 1) {
    return { dx: 0, dy: 0, scale: 0.96, opacity: 0.42 };
  }

  const ux = vx / dist;
  const uy = vy / dist;

  // Scale push amplitude with how much the hero grows, bounded for crisp elegance
  const deltaW = Math.max(0, heroTargetRect.width - heroOriginRect.width);
  const deltaH = Math.max(0, heroTargetRect.height - heroOriginRect.height);
  const pushX = Math.min(156, Math.max(62, deltaW * 0.28 + 46));
  const pushY = Math.min(144, Math.max(56, deltaH * 0.28 + 42));

  // Gentle distance attenuation keeps spacing natural without causing neighbor collisions
  const falloff = 0.68 + 0.32 * Math.exp(-dist / 540);

  return {
    dx: Math.round(ux * pushX * falloff),
    dy: Math.round(uy * pushY * falloff),
    scale: 0.965,
    opacity: 0.44,
  };
}

/**
 * Recovers a card's resting screen rect from its currently transformed DOMRect
 * given any active push offset and scale applied around its center.
 */
export function unpushCardRect(
  measuredRect: ScreenRect,
  pushDx: number,
  pushDy: number,
  pushScale: number,
): ScreenRect {
  const safeScale =
    Number.isFinite(pushScale) && pushScale > 0.1 ? pushScale : 1;
  const restingW = measuredRect.width / safeScale;
  const restingH = measuredRect.height / safeScale;
  const cx = measuredRect.left + measuredRect.width / 2 - pushDx;
  const cy = measuredRect.top + measuredRect.height / 2 - pushDy;

  const roundTenth = (n: number) => Math.round(n * 10) / 10;
  return {
    left: roundTenth(cx - restingW / 2),
    top: roundTenth(cy - restingH / 2),
    width: roundTenth(restingW),
    height: roundTenth(restingH),
  };
}

/**
 * Compensates a DOMRect measured while a container is scaled around viewport
 * center (scaleFactor < 1) back to its resting unscaled screen coordinates.
 */
export function unscaleRectFromCenter(
  rect: ScreenRect,
  viewportWidth: number,
  viewportHeight: number,
  scaleFactor: number,
): ScreenRect {
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0 || scaleFactor === 1) {
    return { ...rect };
  }
  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const inv = 1 / scaleFactor;

  return {
    left: Math.round(cx + (rect.left - cx) * inv),
    top: Math.round(cy + (rect.top - cy) * inv),
    width: Math.round(rect.width * inv),
    height: Math.round(rect.height * inv),
  };
}

/**
 * Computes a clean, balanced multi-row spatial whiteboard layout inspired by
 * Atlas's Canvas view: preserves natural aspect ratios across editorial rows
 * with generous breathing room and smooth edge bleed behind the frosted sidebar.
 */
export function computeTidyWhiteboardLayout(
  items: ReadonlyArray<{ id: string; width: number; height: number }>,
  columns = 4,
  rowHeight = 204,
  gapX = 24,
  gapY = 24,
): Record<string, WhiteboardPlacement> {
  const result: Record<string, WhiteboardPlacement> = {};
  const safeCols = Math.max(1, columns);

  let cursorY = 18;
  for (let i = 0; i < items.length; i += safeCols) {
    const rowItems = items.slice(i, i + safeCols);
    // Subtle editorial horizontal stagger on alternating rows
    let cursorX = Math.floor(i / safeCols) % 2 === 1 ? 50 : 0;

    for (const item of rowItems) {
      const aspect = item.height > 0 ? item.width / item.height : 1;
      const w = Math.round(Math.max(155, Math.min(340, rowHeight * aspect)));
      const h = Math.round(w / aspect);

      result[item.id] = {
        x: cursorX,
        y: cursorY + Math.round((rowHeight - h) * 0.5),
        w,
        h,
      };
      cursorX += w + gapX;
    }

    cursorY += rowHeight + gapY;
  }

  return result;
}
