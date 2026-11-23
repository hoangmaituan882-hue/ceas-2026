export interface CanvasNodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  axis: "x" | "y";
  position: number;
  start: number;
  end: number;
}

export interface PushCollisionResult {
  positions: Record<string, { x: number; y: number }>;
  pushedIds: Set<string>;
}

export interface MagneticSnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/**
 * Checks whether any two boxes overlap (strict interior intersection, with optional minGap).
 */
export function countOverlappingPairs(
  boxes: readonly CanvasNodeBox[],
  minGap = 0,
): number {
  let count = 0;
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]!;
      const overlapX =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + minGap;
      const overlapY =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + minGap;
      if (overlapX > 0.5 && overlapY > 0.5) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Real-time 2D rigid-body push collision solver ("Push things around").
 *
 * Pinned nodes (currently dragged by the user) act as immovable pushers:
 * colliding neighbors slide cleanly aside along the minimum-translation vector,
 * and secondary collisions cascade smoothly outward so tiles NEVER stack messily.
 */
export function resolveCanvasPushCollisions(
  nodes: readonly CanvasNodeBox[],
  pinnedIds: ReadonlySet<string>,
  gap = 12,
  iterations = 18,
): PushCollisionResult {
  const working = nodes.map((n) => ({ ...n }));
  const origById = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }] as const));

  // Compute centroid of pinned (dragged) group to bias outward cascade waves naturally
  let pinnedCx = 0;
  let pinnedCy = 0;
  let pinnedCount = 0;
  for (const n of working) {
    if (pinnedIds.has(n.id)) {
      pinnedCx += n.x + n.width * 0.5;
      pinnedCy += n.y + n.height * 0.5;
      pinnedCount += 1;
    }
  }
  if (pinnedCount > 0) {
    pinnedCx /= pinnedCount;
    pinnedCy /= pinnedCount;
  }

  for (let iter = 0; iter < iterations; iter++) {
    let maxOverlap = 0;

    for (let i = 0; i < working.length; i++) {
      const a = working[i]!;
      const aPinned = pinnedIds.has(a.id);

      for (let j = i + 1; j < working.length; j++) {
        const b = working[j]!;
        const bPinned = pinnedIds.has(b.id);
        if (aPinned && bPinned) continue;

        const aCx = a.x + a.width * 0.5;
        const aCy = a.y + a.height * 0.5;
        const bCx = b.x + b.width * 0.5;
        const bCy = b.y + b.height * 0.5;

        const halfW = (a.width + b.width) * 0.5 + gap;
        const halfH = (a.height + b.height) * 0.5 + gap;

        const diffX = bCx - aCx;
        const diffY = bCy - aCy;

        const overlapX = halfW - Math.abs(diffX);
        const overlapY = halfH - Math.abs(diffY);

        if (overlapX <= 0.25 || overlapY <= 0.25) continue;

        const minOverlap = Math.min(overlapX, overlapY);
        if (minOverlap > maxOverlap) maxOverlap = minOverlap;

        // Minimum Translation Vector (MTV) with deterministic tie-break
        let pushX = 0;
        let pushY = 0;

        if (overlapX < overlapY) {
          const dirX =
            Math.abs(diffX) > 0.5
              ? Math.sign(diffX)
              : pinnedCount > 0 && !bPinned
                ? Math.sign(bCx - pinnedCx) || 1
                : 1;
          pushX = overlapX * dirX;
        } else {
          const dirY =
            Math.abs(diffY) > 0.5
              ? Math.sign(diffY)
              : pinnedCount > 0 && !bPinned
                ? Math.sign(bCy - pinnedCy) || 1
                : 1;
          pushY = overlapY * dirY;
        }

        if (aPinned) {
          b.x += pushX;
          b.y += pushY;
        } else if (bPinned) {
          a.x -= pushX;
          a.y -= pushY;
        } else {
          // Secondary cascade push: slightly favor pushing the card farther from the dragged centroid
          let weightB = 0.5;
          if (pinnedCount > 0) {
            const distA = Math.hypot(aCx - pinnedCx, aCy - pinnedCy);
            const distB = Math.hypot(bCx - pinnedCx, bCy - pinnedCy);
            weightB = distB >= distA ? 0.64 : 0.36;
          }
          const weightA = 1 - weightB;
          a.x -= pushX * weightA;
          a.y -= pushY * weightA;
          b.x += pushX * weightB;
          b.y += pushY * weightB;
        }
      }
    }

    if (maxOverlap < 0.35) break;
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const pushedIds = new Set<string>();

  for (const n of working) {
    const rx = Math.round(n.x);
    const ry = Math.round(n.y);
    positions[n.id] = { x: rx, y: ry };
    const orig = origById.get(n.id);
    if (
      orig &&
      !pinnedIds.has(n.id) &&
      (Math.abs(rx - orig.x) > 1.5 || Math.abs(ry - orig.y) > 1.5)
    ) {
      pushedIds.add(n.id);
    }
  }

  return { positions, pushedIds };
}

/**
 * Computes delicate magnetic alignment snapping & subtle guide lines
 * when a dragged card/group approaches flush or `gap`-spaced edges of nearby neighbors.
 */
export function computeMagneticSnap(
  draggedBounds: { x: number; y: number; width: number; height: number },
  neighbors: readonly CanvasNodeBox[],
  gap = 12,
  threshold = 9,
): MagneticSnapResult {
  let bestDx = 0;
  let bestDistX = threshold + 1;
  let guideX: SnapGuide | null = null;

  let bestDy = 0;
  let bestDistY = threshold + 1;
  let guideY: SnapGuide | null = null;

  const dLeft = draggedBounds.x;
  const dRight = draggedBounds.x + draggedBounds.width;
  const dTop = draggedBounds.y;
  const dBottom = draggedBounds.y + draggedBounds.height;

  for (const n of neighbors) {
    const nLeft = n.x;
    const nRight = n.x + n.width;
    const nTop = n.y;
    const nBottom = n.y + n.height;

    // Only snap against reasonably nearby cards (within 420px on the perpendicular axis)
    const verticalNear = dBottom >= nTop - 420 && dTop <= nBottom + 420;
    const horizontalNear = dRight >= nLeft - 420 && dLeft <= nRight + 420;

    if (verticalNear) {
      const candidatesX: { delta: number; lineX: number }[] = [
        { delta: nLeft - dLeft, lineX: nLeft },
        { delta: nRight - dRight, lineX: nRight },
        { delta: nRight + gap - dLeft, lineX: nRight + gap * 0.5 },
        { delta: nLeft - gap - dRight, lineX: nLeft - gap * 0.5 },
      ];
      for (const c of candidatesX) {
        const abs = Math.abs(c.delta);
        if (abs < bestDistX) {
          bestDistX = abs;
          bestDx = c.delta;
          guideX = {
            axis: "x",
            position: c.lineX,
            start: Math.min(dTop, nTop) - 10,
            end: Math.max(dBottom, nBottom) + 10,
          };
        }
      }
    }

    if (horizontalNear) {
      const candidatesY: { delta: number; lineY: number }[] = [
        { delta: nTop - dTop, lineY: nTop },
        { delta: nBottom - dBottom, lineY: nBottom },
        { delta: nBottom + gap - dTop, lineY: nBottom + gap * 0.5 },
        { delta: nTop - gap - dBottom, lineY: nTop - gap * 0.5 },
      ];
      for (const c of candidatesY) {
        const abs = Math.abs(c.delta);
        if (abs < bestDistY) {
          bestDistY = abs;
          bestDy = c.delta;
          guideY = {
            axis: "y",
            position: c.lineY,
            start: Math.min(dLeft, nLeft) - 10,
            end: Math.max(dRight, nRight) + 10,
          };
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (guideX && bestDistX <= threshold) guides.push(guideX);
  else bestDx = 0;
  if (guideY && bestDistY <= threshold) guides.push(guideY);
  else bestDy = 0;

  return { dx: Math.round(bestDx), dy: Math.round(bestDy), guides };
}

/**
 * Packs a subset of cards tightly into a balanced, aspect-preserving Atlas-style pile
 * centered around their current center of mass ("Pile the ones that go together"),
 * then pushes any non-target cards cleanly out of the way so zero overlaps occur.
 */
export function packCanvasPile(
  allNodes: readonly CanvasNodeBox[],
  targetIds: ReadonlySet<string>,
  gap = 12,
  targetRowHeight = 168,
): Record<string, { x: number; y: number; w: number }> {
  const targets = allNodes.filter((n) => targetIds.has(n.id));
  if (targets.length === 0) return {};

  // Compute anchor center of mass of the target group
  let cx = 0;
  let cy = 0;
  for (const t of targets) {
    cx += t.x + t.width * 0.5;
    cy += t.y + t.height * 0.5;
  }
  cx /= targets.length;
  cy /= targets.length;

  // Compute balanced visual dimensions per card while preserving exact true aspect ratio
  const sized = targets.map((t) => {
    const trueAspect = t.height > 0 ? t.width / t.height : 1;
    const clampedForWidth = Math.max(0.72, Math.min(1.68, trueAspect));
    const w = Math.round(targetRowHeight * clampedForWidth);
    const h = Math.round(w / trueAspect);
    return { id: t.id, w, h, origY: t.y, origX: t.x };
  });

  // Preserve visual reading order (top-to-bottom bands, then left-to-right)
  sized.sort((a, b) => {
    if (Math.abs(a.origY - b.origY) > targetRowHeight * 0.55) {
      return a.origY - b.origY;
    }
    return a.origX - b.origX;
  });

  // Target total width aims for a roughly 4:3 organic pile silhouette
  const totalArea = sized.reduce((sum, s) => sum + (s.w + gap) * (s.h + gap), 0);
  const idealClusterWidth = Math.max(
    targetRowHeight * 2.1,
    Math.min(1040, Math.sqrt(totalArea * 1.42)),
  );

  // Pack into balanced shelf rows
  interface ShelfRow {
    items: { id: string; w: number; h: number }[];
    width: number;
    height: number;
  }
  const rows: ShelfRow[] = [];
  let current: ShelfRow = { items: [], width: 0, height: 0 };

  for (const s of sized) {
    const nextWidth = current.items.length === 0 ? s.w : current.width + gap + s.w;
    if (current.items.length > 0 && nextWidth > idealClusterWidth) {
      rows.push(current);
      current = { items: [s], width: s.w, height: s.h };
    } else {
      current.items.push(s);
      current.width = nextWidth;
      current.height = Math.max(current.height, s.h);
    }
  }
  if (current.items.length > 0) rows.push(current);

  const maxRowW = rows.reduce((m, r) => Math.max(m, r.width), 0);
  const totalH = rows.reduce((sum, r) => sum + r.height, 0) + gap * Math.max(0, rows.length - 1);

  const startY = Math.round(cy - totalH * 0.5);
  const packedBoxes: CanvasNodeBox[] = [];
  const widthMap: Record<string, number> = {};

  let cursorY = startY;
  for (const row of rows) {
    // Center each row organically inside the pile silhouette (matching reference video)
    let cursorX = Math.round(cx - row.width * 0.5);
    if (row.width > maxRowW * 0.85) {
      cursorX = Math.round(cx - maxRowW * 0.5);
    }
    for (const entry of row.items) {
      // Vertically center slightly shorter cards inside their shelf row for crisp visual balance
      const offsetY = Math.round((row.height - entry.h) * 0.5);
      packedBoxes.push({
        id: entry.id,
        x: cursorX,
        y: cursorY + offsetY,
        width: entry.w,
        height: entry.h,
      });
      widthMap[entry.id] = entry.w;
      cursorX += entry.w + gap;
    }
    cursorY += row.height + gap;
  }

  // Merge packed targets with untouched other nodes, then push non-targets cleanly aside
  const merged: CanvasNodeBox[] = [
    ...packedBoxes,
    ...allNodes.filter((n) => !targetIds.has(n.id)),
  ];
  const resolved = resolveCanvasPushCollisions(merged, targetIds, gap, 20);

  const result: Record<string, { x: number; y: number; w: number }> = {};
  for (const node of merged) {
    const pos = resolved.positions[node.id] ?? { x: node.x, y: node.y };
    result[node.id] = {
      x: pos.x,
      y: pos.y,
      w: widthMap[node.id] ?? node.width,
    };
  }
  return result;
}

/**
 * Packs ALL visible board items into one cohesive centered architectural mosaic
 * anchored neatly at (originX, originY), matching the Atlas board overview in the reference video.
 */
export function packCanvasMosaic(
  items: readonly { id: string; width: number; height: number }[],
  gap = 12,
  rowHeight = 148,
  originX = 36,
  originY = 26,
  maxWidth = 980,
): Record<string, { x: number; y: number; w: number }> {
  if (items.length === 0) return {};

  interface MosaicRow {
    entries: { id: string; w: number; h: number }[];
    width: number;
    height: number;
  }
  const rows: MosaicRow[] = [];
  let current: MosaicRow = { entries: [], width: 0, height: 0 };

  for (const item of items) {
    const trueAspect = item.height > 0 ? item.width / item.height : 1;
    const clampedForWidth = Math.max(0.72, Math.min(1.65, trueAspect));
    const w = Math.round(rowHeight * clampedForWidth);
    const h = Math.round(w / trueAspect);
    const nextWidth = current.entries.length === 0 ? w : current.width + gap + w;
    if (current.entries.length > 0 && nextWidth > maxWidth) {
      rows.push(current);
      current = { entries: [{ id: item.id, w, h }], width: w, height: h };
    } else {
      current.entries.push({ id: item.id, w, h });
      current.width = nextWidth;
      current.height = Math.max(current.height, h);
    }
  }
  if (current.entries.length > 0) rows.push(current);

  const maxRowW = rows.reduce((m, r) => Math.max(m, r.width), 0);
  const placements: Record<string, { x: number; y: number; w: number }> = {};
  let cursorY = originY;

  for (const row of rows) {
    let cursorX = Math.round(originX + (maxRowW - row.width) * 0.5);
    for (const entry of row.entries) {
      const offsetY = Math.round((row.height - entry.h) * 0.5);
      placements[entry.id] = {
        x: cursorX,
        y: cursorY + offsetY,
        w: entry.w,
      };
      cursorX += entry.w + gap;
    }
    cursorY += row.height + gap;
  }

  return placements;
}

/**
 * Computes a harmonious initial two-cluster Canvas layout with an intentional breathing gap
 * ("Pile the ones that go together, leave gaps where you haven't figured it out yet")
 * guaranteeing zero initial card overlaps and balanced framing inside a 1440×900 workspace.
 */
export function computeHarmoniousCanvasClusters(
  items: readonly { id: string; width: number; height: number }[],
  gap = 12,
  rowHeight = 144,
): Record<string, { x: number; y: number; w: number }> {
  if (items.length === 0) return {};

  const splitAt = Math.max(1, Math.round(items.length * 0.52));
  const leftGroup = items.slice(0, splitAt);
  const rightGroup = items.slice(splitAt);

  const layoutPile = (
    group: readonly { id: string; width: number; height: number }[],
    originX: number,
    originY: number,
    maxRowWidth: number,
  ): {
    placements: Record<string, { x: number; y: number; w: number }>;
    boundsWidth: number;
  } => {
    interface Row {
      entries: { id: string; w: number; h: number }[];
      width: number;
      height: number;
    }
    const rows: Row[] = [];
    let current: Row = { entries: [], width: 0, height: 0 };

    for (const item of group) {
      const trueAspect = item.height > 0 ? item.width / item.height : 1;
      const clampedForWidth = Math.max(0.72, Math.min(1.62, trueAspect));
      const w = Math.round(rowHeight * clampedForWidth);
      const h = Math.round(w / trueAspect);
      const nextWidth = current.entries.length === 0 ? w : current.width + gap + w;
      if (current.entries.length > 0 && nextWidth > maxRowWidth) {
        rows.push(current);
        current = { entries: [{ id: item.id, w, h }], width: w, height: h };
      } else {
        current.entries.push({ id: item.id, w, h });
        current.width = nextWidth;
        current.height = Math.max(current.height, h);
      }
    }
    if (current.entries.length > 0) rows.push(current);

    const boundsWidth = rows.reduce((m, r) => Math.max(m, r.width), 0);
    const placements: Record<string, { x: number; y: number; w: number }> = {};
    let cursorY = originY;
    for (const row of rows) {
      let cursorX = originX;
      for (const entry of row.entries) {
        const offsetY = Math.round((row.height - entry.h) * 0.5);
        placements[entry.id] = {
          x: Math.round(cursorX),
          y: Math.round(cursorY + offsetY),
          w: entry.w,
        };
        cursorX += entry.w + gap;
      }
      cursorY += row.height + gap;
    }
    return { placements, boundsWidth };
  };

  const left = layoutPile(leftGroup, 18, 12, 488);
  const clusterGap = 92; // Intentional breathing space between the two curated piles
  const right = layoutPile(
    rightGroup,
    18 + left.boundsWidth + clusterGap,
    22,
    488,
  );

  return {
    ...left.placements,
    ...right.placements,
  };
}
