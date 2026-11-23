import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLightboxTargetRect,
  computeNeighborPushOffset,
  computeSharedGifPhase,
  computeTidyWhiteboardLayout,
  getQuickLookFrameSurfaceColor,
  resolveHeroHandoffFlags,
  unpushCardRect,
  unscaleRectFromCenter,
} from "./hero-transition";

test("computeLightboxTargetRect centers media cleanly and shifts when Inspector opens", () => {
  const closed = computeLightboxTargetRect(1440, 900, 1600, 1200, false);
  const open = computeLightboxTargetRect(1440, 900, 1600, 1200, true);

  // Preserves 4:3 aspect ratio
  assert.ok(Math.abs(closed.width / closed.height - 4 / 3) < 0.02);
  // Centered horizontally in full 1440 viewport when inspector is closed
  assert.ok(Math.abs(closed.left + closed.width / 2 - 720) <= 2);
  // Shifts left and stays centered inside the remaining stage when inspector opens
  assert.ok(open.left + open.width / 2 < closed.left + closed.width / 2);
  assert.ok(open.left + open.width <= 1440 - 276);
});

test("computeNeighborPushOffset pushes surrounding cards radially outward and resets when inactive", () => {
  const origin = { left: 500, top: 300, width: 220, height: 180 };
  const target = { left: 320, top: 100, width: 800, height: 650 };

  const leftNeighbor = { left: 240, top: 300, width: 220, height: 180 };
  const rightNeighbor = { left: 760, top: 300, width: 220, height: 180 };
  const topNeighbor = { left: 500, top: 80, width: 220, height: 180 };
  const bottomNeighbor = { left: 500, top: 520, width: 220, height: 180 };

  const pLeft = computeNeighborPushOffset(leftNeighbor, origin, target, true);
  const pRight = computeNeighborPushOffset(rightNeighbor, origin, target, true);
  const pTop = computeNeighborPushOffset(topNeighbor, origin, target, true);
  const pBottom = computeNeighborPushOffset(bottomNeighbor, origin, target, true);
  const pInactive = computeNeighborPushOffset(leftNeighbor, origin, target, false);

  assert.ok(pLeft.dx < -40, `Expected left neighbor pushed left, got ${pLeft.dx}`);
  assert.ok(pRight.dx > 40, `Expected right neighbor pushed right, got ${pRight.dx}`);
  assert.ok(pTop.dy < -40, `Expected top neighbor pushed up, got ${pTop.dy}`);
  assert.ok(pBottom.dy > 40, `Expected bottom neighbor pushed down, got ${pBottom.dy}`);
  assert.equal(pInactive.dx, 0);
  assert.equal(pInactive.dy, 0);
  assert.equal(pInactive.scale, 1);
  assert.equal(pInactive.opacity, 1);
});

test("unpushCardRect recovers exact resting coordinates from a pushed and scaled card", () => {
  const resting = { left: 760, top: 300, width: 220, height: 180 };
  const dx = 92;
  const dy = -18;
  const scale = 0.965;

  const cx = resting.left + resting.width / 2 + dx;
  const cy = resting.top + resting.height / 2 + dy;
  const measured = {
    left: cx - (resting.width * scale) / 2,
    top: cy - (resting.height * scale) / 2,
    width: resting.width * scale,
    height: resting.height * scale,
  };

  const recovered = unpushCardRect(measured, dx, dy, scale);
  assert.ok(Math.abs(recovered.left - resting.left) <= 0.2);
  assert.ok(Math.abs(recovered.top - resting.top) <= 0.2);
  assert.ok(Math.abs(recovered.width - resting.width) <= 0.2);
  assert.ok(Math.abs(recovered.height - resting.height) <= 0.2);
});

test("unscaleRectFromCenter recovers exact resting screen coordinates", () => {
  const resting = { left: 420, top: 260, width: 280, height: 210 };
  const vw = 1440;
  const vh = 900;
  const scale = 0.968;

  const scaled = {
    left: vw / 2 + (resting.left - vw / 2) * scale,
    top: vh / 2 + (resting.top - vh / 2) * scale,
    width: resting.width * scale,
    height: resting.height * scale,
  };

  const recovered = unscaleRectFromCenter(scaled, vw, vh, scale);
  assert.ok(Math.abs(recovered.left - resting.left) <= 1);
  assert.ok(Math.abs(recovered.top - resting.top) <= 1);
  assert.ok(Math.abs(recovered.width - resting.width) <= 1);
  assert.ok(Math.abs(recovered.height - resting.height) <= 1);
});

test("computeTidyWhiteboardLayout arranges items without horizontal overlap", () => {
  const items = [
    { id: "a", width: 1600, height: 900 },
    { id: "b", width: 1200, height: 1200 },
    { id: "c", width: 1200, height: 1600 },
    { id: "d", width: 1600, height: 1200 },
    { id: "e", width: 1600, height: 1200 },
  ];
  const layout = computeTidyWhiteboardLayout(items, 4, 200, 24, 24);
  assert.equal(Object.keys(layout).length, 5);

  const a = layout["a"]!;
  const b = layout["b"]!;
  const e = layout["e"]!;
  assert.ok(b.x >= a.x + a.w + 24);
  assert.ok(e.y >= a.y + 200);
});

test("resolveHeroHandoffFlags reveals underlying card during double-buffered landing while hero stays mounted", () => {
  const open = resolveHeroHandoffFlags("open", true);
  assert.deepEqual(open, {
    hideUnderlyingCard: true,
    keepHeroMounted: true,
    neighborsPushed: true,
  });

  const closing = resolveHeroHandoffFlags("closing", true);
  assert.deepEqual(closing, {
    hideUnderlyingCard: true,
    keepHeroMounted: true,
    neighborsPushed: false,
  });

  // Landing phase: underlying card MUST be visible while hero overlay is STILL mounted on top!
  const landing = resolveHeroHandoffFlags("landing", true);
  assert.deepEqual(landing, {
    hideUnderlyingCard: false,
    keepHeroMounted: true,
    neighborsPushed: false,
  });

  const closed = resolveHeroHandoffFlags(null, true);
  assert.deepEqual(closed, {
    hideUnderlyingCard: false,
    keepHeroMounted: false,
    neighborsPushed: false,
  });
});

test("computeSharedGifPhase and getQuickLookFrameSurfaceColor stay deterministic across themes", () => {
  assert.equal(computeSharedGifPhase(1300, 2600), 0.5);
  assert.equal(computeSharedGifPhase(2600, 2600), 0);
  assert.equal(computeSharedGifPhase(-650, 2600), 0.75);

  assert.equal(
    getQuickLookFrameSurfaceColor({ kind: "font", fontTone: "paper" }, "light"),
    "#f6f2ea",
  );
  assert.equal(
    getQuickLookFrameSurfaceColor({ kind: "font", fontTone: "ink" }, "light"),
    "#191a1e",
  );
  assert.equal(
    getQuickLookFrameSurfaceColor({ kind: "audio" }, "dark"),
    "#1c1d22",
  );
  assert.equal(
    getQuickLookFrameSurfaceColor({ kind: "gif", gifKind: "fluid-orb" }, "light"),
    "#eef4ff",
  );
});
