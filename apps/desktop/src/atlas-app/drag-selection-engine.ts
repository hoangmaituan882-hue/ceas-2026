import type { ScreenRect } from "./hero-transition";

export type SidebarDropTarget =
  | { kind: "inbox"; key: "inbox" }
  | { kind: "likes"; key: "likes" }
  | { kind: "trash"; key: "trash" }
  | { kind: "collection"; key: string; collectionId: string }
  | { kind: "tag"; key: string; tagName: string };

export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StackCardPose {
  offsetX: number;
  offsetY: number;
  rotate: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * Normalizes any two marquee drag anchor/current points into a positive-dimension rect.
 */
export function normalizeMarqueeRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): ScreenRect {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  return { left, top, width, height };
}

/**
 * Strict 2D axis-aligned bounding-box intersection test.
 */
export function rectsIntersect(a: ScreenRect, b: ScreenRect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }
  return !(
    a.left + a.width < b.left ||
    b.left + b.width < a.left ||
    a.top + a.height < b.top ||
    b.top + b.height < a.top
  );
}

/**
 * Computes Finder-style marquee selection ids.
 * When `additive` (Shift/Cmd) is true, cards inside the marquee toggle against `baselineIds`.
 */
export function computeMarqueeSelectedIds(
  marqueeRect: ScreenRect,
  cards: readonly { id: string; rect: ScreenRect }[],
  baselineIds: ReadonlySet<string>,
  additive: boolean,
): Set<string> {
  const next = additive ? new Set<string>(baselineIds) : new Set<string>();
  for (const card of cards) {
    if (!rectsIntersect(marqueeRect, card.rect)) continue;
    if (additive) {
      if (baselineIds.has(card.id)) {
        next.delete(card.id);
      } else {
        next.add(card.id);
      }
    } else {
      next.add(card.id);
    }
  }
  return next;
}

/**
 * Checks whether a viewport pointer coordinate is inside the valid grid reorder zone.
 * Releasing outside triggers an elastic snap-back to the original resting slot.
 */
export function isPointInsideReorderBounds(
  clientX: number,
  clientY: number,
  bounds: ScreenRect,
  padding = 32,
): boolean {
  return (
    clientX >= bounds.left - padding &&
    clientX <= bounds.left + bounds.width + padding &&
    clientY >= bounds.top - padding &&
    clientY <= bounds.top + bounds.height + padding
  );
}

/**
 * Pure immutable group reorder helper.
 * Removes all `draggedIds` (preserving their order in `items` or `draggedOrder`),
 * then inserts them as a contiguous block at `targetSlotIndex` among the remaining items.
 */
export function reorderGroupByTargetIndex<T extends { id: string }>(
  items: readonly T[],
  draggedIds: readonly string[],
  targetSlotIndex: number,
): T[] {
  if (draggedIds.length === 0 || items.length <= 1) return [...items];
  const draggedSet = new Set(draggedIds);
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const draggedItems: T[] = [];
  for (const id of draggedIds) {
    const found = byId.get(id);
    if (found) draggedItems.push(found);
  }
  if (draggedItems.length === 0) return [...items];

  const remaining = items.filter((item) => !draggedSet.has(item.id));
  const clamped = Math.max(0, Math.min(remaining.length, Math.round(targetSlotIndex)));
  const out = [...remaining];
  out.splice(clamped, 0, ...draggedItems);
  return out;
}

/**
 * Computes the exact live insertion index in `[0, remainingCards.length]`
 * across Justified, Square, and Fit grid layouts.
 *
 * Groups cards into visual rows by vertical band, selects the active row,
 * and compares `pointerX` against each card's midpoint — with a light sticky
 * deadzone around `currentSlotIndex` to eliminate justified-row re-flow jitter.
 */
export function computeGridInsertionIndex(
  pointerX: number,
  pointerY: number,
  remainingCards: readonly BoxRect[],
  currentSlotIndex: number | null = null,
): number {
  const n = remainingCards.length;
  if (n === 0) return 0;

  interface VisualRow {
    top: number;
    bottom: number;
    centerY: number;
    entries: { index: number; card: BoxRect }[];
  }

  const rows: VisualRow[] = [];
  for (let i = 0; i < n; i++) {
    const card = remainingCards[i]!;
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(card.y - lastRow.top) <= 14) {
      lastRow.entries.push({ index: i, card });
      lastRow.bottom = Math.max(lastRow.bottom, card.y + card.height);
      lastRow.centerY = (lastRow.top + lastRow.bottom) * 0.5;
    } else {
      rows.push({
        top: card.y,
        bottom: card.y + card.height,
        centerY: card.y + card.height * 0.5,
        entries: [{ index: i, card }],
      });
    }
  }

  // Pick row containing pointerY, or nearest row by vertical distance
  let targetRow = rows[0]!;
  let bestRowDist = Infinity;
  for (const row of rows) {
    if (pointerY >= row.top && pointerY <= row.bottom) {
      targetRow = row;
      bestRowDist = 0;
      break;
    }
    const dist = Math.min(
      Math.abs(pointerY - row.top),
      Math.abs(pointerY - row.bottom),
      Math.abs(pointerY - row.centerY),
    );
    if (dist < bestRowDist) {
      bestRowDist = dist;
      targetRow = row;
    }
  }

  const entries = targetRow.entries;
  const firstEntry = entries[0]!;
  const lastEntry = entries[entries.length - 1]!;

  let candidate = lastEntry.index + 1;
  for (const entry of entries) {
    const midX = entry.card.x + entry.card.width * 0.5;
    if (pointerX < midX) {
      candidate = entry.index;
      break;
    }
  }

  // Sticky hysteresis: if pointer is barely past the midpoint of an adjacent card
  // that would flip currentSlotIndex by ±1, require crossing an extra 10% margin.
  if (
    currentSlotIndex !== null &&
    Math.abs(candidate - currentSlotIndex) === 1
  ) {
    const boundaryIdx = Math.min(candidate, currentSlotIndex);
    const boundaryCard = remainingCards[boundaryIdx];
    if (boundaryCard && boundaryIdx >= firstEntry.index && boundaryIdx <= lastEntry.index) {
      const midX = boundaryCard.x + boundaryCard.width * 0.5;
      const deadzone = Math.min(22, boundaryCard.width * 0.14);
      if (Math.abs(pointerX - midX) < deadzone) {
        return currentSlotIndex;
      }
    }
  }

  return Math.max(0, Math.min(n, candidate));
}

/**
 * Smoothly damps horizontal pointer velocity into tactile macOS card tilt degrees.
 */
export function computeDragVelocityTilt(vx: number, prevTilt: number): number {
  const target = Math.max(-8.5, Math.min(8.5, vx * 0.42));
  const blended = prevTilt * 0.72 + target * 0.28;
  return Math.abs(blended) < 0.08 ? 0 : Math.round(blended * 100) / 100;
}

/**
 * Computes deterministic fanned stack geometry for Finder-style multi-card drags.
 * `stackIndex === 0` is the front-most card directly under the pointer.
 */
export function computeStackCardPose(
  stackIndex: number,
  totalCount: number,
  compactSidebarMode: boolean,
  velocityTiltDeg: number,
): StackCardPose {
  const visibleLayers = Math.min(3, Math.max(1, totalCount));
  const clampedIdx = Math.min(stackIndex, visibleLayers - 1);

  if (clampedIdx === 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      rotate: velocityTiltDeg,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    };
  }

  if (clampedIdx === 1) {
    return {
      offsetX: compactSidebarMode ? -6 : -10,
      offsetY: compactSidebarMode ? 5 : 8,
      rotate: (compactSidebarMode ? -6.5 : -4.8) + velocityTiltDeg * 0.55,
      scale: compactSidebarMode ? 0.94 : 0.96,
      opacity: 0.96,
      zIndex: 20,
    };
  }

  return {
    offsetX: compactSidebarMode ? 7 : 11,
    offsetY: compactSidebarMode ? 9 : 14,
    rotate: (compactSidebarMode ? 6.2 : 4.5) + velocityTiltDeg * 0.35,
    scale: compactSidebarMode ? 0.88 : 0.92,
    opacity: 0.9,
    zIndex: 10,
  };
}

/**
 * Parses `data-drop-sidebar-target` DOM attributes into strongly-typed drop actions.
 */
export function parseSidebarDropTarget(
  rawAttr: string | null | undefined,
): SidebarDropTarget | null {
  if (!rawAttr) return null;
  if (rawAttr === "inbox") return { kind: "inbox", key: "inbox" };
  if (rawAttr === "likes") return { kind: "likes", key: "likes" };
  if (rawAttr === "trash") return { kind: "trash", key: "trash" };
  if (rawAttr.startsWith("collection:")) {
    const collectionId = rawAttr.slice("collection:".length).trim();
    if (!collectionId) return null;
    return { kind: "collection", key: rawAttr, collectionId };
  }
  if (rawAttr.startsWith("tag:")) {
    const tagName = rawAttr.slice("tag:".length).trim();
    if (!tagName) return null;
    return { kind: "tag", key: rawAttr, tagName };
  }
  return null;
}
