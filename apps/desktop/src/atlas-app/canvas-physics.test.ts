import assert from "node:assert/strict";
import test from "node:test";
import {
  computeHarmoniousCanvasClusters,
  computeMagneticSnap,
  countOverlappingPairs,
  packCanvasMosaic,
  packCanvasPile,
  resolveCanvasPushCollisions,
  type CanvasNodeBox,
} from "./canvas-physics";

test("resolveCanvasPushCollisions pushes colliding cards cleanly apart while keeping dragged card pinned", () => {
  const nodes: CanvasNodeBox[] = [
    // Pinned dragged card dropped right on top of card B
    { id: "dragged", x: 100, y: 100, width: 200, height: 150 },
    { id: "b", x: 120, y: 110, width: 180, height: 150 },
    { id: "c", x: 312, y: 110, width: 180, height: 150 },
  ];

  const { positions, pushedIds } = resolveCanvasPushCollisions(
    nodes,
    new Set(["dragged"]),
    12,
    20,
  );

  // Dragged card stays exactly where user placed it
  assert.deepEqual(positions.dragged, { x: 100, y: 100 });
  // Card B was physically pushed out of the way
  assert.equal(pushedIds.has("b"), true);

  // Resulting layout has zero overlaps (with full 12px gap respected!)
  const resolvedBoxes = nodes.map((n) => ({
    ...n,
    x: positions[n.id]!.x,
    y: positions[n.id]!.y,
  }));
  assert.equal(countOverlappingPairs(resolvedBoxes, 10), 0);
});

test("computeMagneticSnap aligns flush edges and gap-spaced edges with alignment guides", () => {
  const neighbor: CanvasNodeBox = {
    id: "n1",
    x: 200,
    y: 100,
    width: 180,
    height: 160,
  };

  // Dragged card left edge is 205 (within 9px of neighbor left edge 200) and top is 276 (within 9px of 100+160+12=272)
  const snap = computeMagneticSnap(
    { x: 205, y: 276, width: 160, height: 140 },
    [neighbor],
    12,
    9,
  );

  assert.equal(snap.dx, -5);
  assert.equal(snap.dy, -4);
  assert.equal(snap.guides.length, 2);
});

test("packCanvasPile packs selected cards tightly around their center of mass without overlapping unselected cards", () => {
  const allNodes: CanvasNodeBox[] = [
    { id: "s1", x: 0, y: 0, width: 180, height: 140 },
    { id: "s2", x: 320, y: 20, width: 160, height: 160 },
    { id: "s3", x: 80, y: 260, width: 200, height: 140 },
    { id: "other", x: 160, y: 120, width: 180, height: 150 },
  ];

  const packed = packCanvasPile(
    allNodes,
    new Set(["s1", "s2", "s3"]),
    12,
    150,
  );

  const finalBoxes: CanvasNodeBox[] = allNodes.map((n) => {
    const p = packed[n.id]!;
    const aspect = n.width / n.height;
    return {
      id: n.id,
      x: p.x,
      y: p.y,
      width: p.w,
      height: Math.round(p.w / aspect),
    };
  });

  // Zero overlaps anywhere on the board after packing
  assert.equal(countOverlappingPairs(finalBoxes, 8), 0);
});

test("computeHarmoniousCanvasClusters produces two clean non-overlapping clusters with an intentional breathing gap", () => {
  const sampleItems = Array.from({ length: 14 }, (_, idx) => ({
    id: `c-${idx}`,
    width: idx % 4 === 0 ? 1800 : idx % 4 === 1 ? 800 : 1200,
    height: idx % 4 === 0 ? 900 : idx % 4 === 1 ? 1500 : 1200,
  }));

  const layout = computeHarmoniousCanvasClusters(sampleItems, 12, 144);
  const boxes: CanvasNodeBox[] = sampleItems.map((it) => {
    const p = layout[it.id]!;
    const trueAspect = it.width / it.height;
    return {
      id: it.id,
      x: p.x,
      y: p.y,
      width: p.w,
      height: Math.round(p.w / trueAspect),
    };
  });

  assert.equal(countOverlappingPairs(boxes, 10), 0);

  // Verify the two clusters are separated by a clear horizontal gap (>= 90px)
  const splitAt = Math.round(sampleItems.length * 0.52);
  const leftMaxRight = Math.max(...boxes.slice(0, splitAt).map((b) => b.x + b.width));
  const rightMinLeft = Math.min(...boxes.slice(splitAt).map((b) => b.x));
  assert.ok(rightMinLeft - leftMaxRight >= 90);
});

test("packCanvasMosaic packs mixed portrait and panoramic cards into one zero-overlap mosaic", () => {
  const sampleItems = Array.from({ length: 16 }, (_, idx) => ({
    id: `m-${idx}`,
    width: idx % 3 === 0 ? 1920 : idx % 3 === 1 ? 760 : 1200,
    height: idx % 3 === 0 ? 1080 : idx % 3 === 1 ? 1400 : 1200,
  }));

  const mosaic = packCanvasMosaic(sampleItems, 12, 148, 36, 24, 980);
  const boxes: CanvasNodeBox[] = sampleItems.map((it) => {
    const p = mosaic[it.id]!;
    return {
      id: it.id,
      x: p.x,
      y: p.y,
      width: p.w,
      height: Math.round(p.w / (it.width / it.height)),
    };
  });

  assert.equal(countOverlappingPairs(boxes, 10), 0);
});
