import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDragVelocityTilt,
  computeGridInsertionIndex,
  computeMarqueeSelectedIds,
  computeStackCardPose,
  isPointInsideReorderBounds,
  normalizeMarqueeRect,
  parseSidebarDropTarget,
  rectsIntersect,
  reorderGroupByTargetIndex,
  type BoxRect,
} from "./drag-selection-engine";

test("normalizeMarqueeRect handles all four drag quadrants", () => {
  assert.deepEqual(normalizeMarqueeRect(100, 200, 260, 320), {
    left: 100,
    top: 200,
    width: 160,
    height: 120,
  });
  assert.deepEqual(normalizeMarqueeRect(260, 320, 100, 200), {
    left: 100,
    top: 200,
    width: 160,
    height: 120,
  });
  assert.deepEqual(normalizeMarqueeRect(260, 200, 100, 320), {
    left: 100,
    top: 200,
    width: 160,
    height: 120,
  });
});

test("computeMarqueeSelectedIds supports standard and Finder additive toggle selection", () => {
  const cards = [
    { id: "a", rect: { left: 10, top: 10, width: 100, height: 100 } },
    { id: "b", rect: { left: 130, top: 10, width: 100, height: 100 } },
    { id: "c", rect: { left: 250, top: 10, width: 100, height: 100 } },
  ];
  const marquee = normalizeMarqueeRect(50, 50, 180, 90);

  assert.equal(rectsIntersect(marquee, cards[0]!.rect), true);
  assert.equal(rectsIntersect(marquee, cards[1]!.rect), true);
  assert.equal(rectsIntersect(marquee, cards[2]!.rect), false);

  const fresh = computeMarqueeSelectedIds(marquee, cards, new Set(["c"]), false);
  assert.deepEqual([...fresh].sort(), ["a", "b"]);

  // Additive Finder marquee toggles items inside the marquee against baseline
  const additive = computeMarqueeSelectedIds(
    marquee,
    cards,
    new Set(["a", "c"]),
    true,
  );
  assert.deepEqual([...additive].sort(), ["b", "c"]);
});

test("isPointInsideReorderBounds respects padding and rejects out-of-bounds drops", () => {
  const bounds = { left: 240, top: 64, width: 1180, height: 800 };
  assert.equal(isPointInsideReorderBounds(500, 400, bounds, 32), true);
  assert.equal(isPointInsideReorderBounds(215, 400, bounds, 32), true);
  assert.equal(isPointInsideReorderBounds(100, 400, bounds, 32), false);
  assert.equal(isPointInsideReorderBounds(500, 10, bounds, 32), false);
});

test("reorderGroupByTargetIndex moves single and multi-card groups immutably", () => {
  const items = [
    { id: "1" },
    { id: "2" },
    { id: "3" },
    { id: "4" },
    { id: "5" },
  ];

  const singleMoved = reorderGroupByTargetIndex(items, ["1"], 3);
  assert.deepEqual(
    singleMoved.map((x) => x.id),
    ["2", "3", "4", "1", "5"],
  );

  // Multi-card group ["2", "4"] inserted at index 0 among remaining ["1", "3", "5"]
  const groupFront = reorderGroupByTargetIndex(items, ["2", "4"], 0);
  assert.deepEqual(
    groupFront.map((x) => x.id),
    ["2", "4", "1", "3", "5"],
  );

  // Multi-card group ["1", "3"] inserted at end
  const groupEnd = reorderGroupByTargetIndex(items, ["1", "3"], 99);
  assert.deepEqual(
    groupEnd.map((x) => x.id),
    ["2", "4", "5", "1", "3"],
  );
});

test("computeGridInsertionIndex resolves row and slot with sticky anti-jitter hysteresis", () => {
  const remaining: BoxRect[] = [
    // Row 0
    { x: 0, y: 0, width: 200, height: 180 },
    { x: 212, y: 0, width: 200, height: 180 },
    { x: 424, y: 0, width: 200, height: 180 },
    // Row 1
    { x: 0, y: 192, width: 280, height: 180 },
    { x: 292, y: 192, width: 280, height: 180 },
  ];

  // Left of first card in row 0 -> index 0
  assert.equal(computeGridInsertionIndex(40, 80, remaining, null), 0);
  // Between card 0 and card 1 -> index 1
  assert.equal(computeGridInsertionIndex(230, 80, remaining, null), 1);
  // Past card 2 midpoint in row 0 -> index 3 (end of row 0)
  assert.equal(computeGridInsertionIndex(560, 80, remaining, null), 3);
  // Row 1 right of card 4 -> index 5 (very end)
  assert.equal(computeGridInsertionIndex(520, 260, remaining, null), 5);

  // Sticky hysteresis near midpoint of card 1 (midX = 312) keeps currentSlotIndex=1
  assert.equal(computeGridInsertionIndex(318, 80, remaining, 1), 1);
  // Moving firmly past deadzone flips cleanly to index 2
  assert.equal(computeGridInsertionIndex(350, 80, remaining, 1), 2);
});

test("computeDragVelocityTilt, computeStackCardPose, and parseSidebarDropTarget behave predictably", () => {
  const tiltRight = computeDragVelocityTilt(30, 0);
  assert.ok(tiltRight > 0 && tiltRight <= 8.5);
  const tiltZero = computeDragVelocityTilt(0, 0.05);
  assert.equal(tiltZero, 0);

  const front = computeStackCardPose(0, 4, false, 3);
  const mid = computeStackCardPose(1, 4, true, 3);
  const back = computeStackCardPose(2, 4, true, 3);
  assert.equal(front.scale, 1);
  assert.ok(mid.rotate < 0 && back.rotate > 0);
  assert.ok(front.zIndex > mid.zIndex && mid.zIndex > back.zIndex);

  assert.deepEqual(parseSidebarDropTarget("inbox"), { kind: "inbox", key: "inbox" });
  assert.deepEqual(parseSidebarDropTarget("likes"), { kind: "likes", key: "likes" });
  assert.deepEqual(parseSidebarDropTarget("trash"), { kind: "trash", key: "trash" });
  assert.deepEqual(parseSidebarDropTarget("collection:col-arch"), {
    kind: "collection",
    key: "collection:col-arch",
    collectionId: "col-arch",
  });
  assert.deepEqual(parseSidebarDropTarget("tag:minimal"), {
    kind: "tag",
    key: "tag:minimal",
    tagName: "minimal",
  });
  assert.equal(parseSidebarDropTarget("unknown"), null);
});
