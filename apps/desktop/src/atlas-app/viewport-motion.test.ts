import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCanvasRevealForCollapse,
  computeCursorAnchoredPan,
  computeGridAnchoredScrollTop,
  computeGridCursorAnchor,
  computeGridRevealScrollTop,
  computeWheelZoomNext,
  sampleHeroEase,
  stepQuickLookWheelNavigation,
  type LayoutCardBox,
} from "./viewport-motion";

test("computeCursorAnchoredPan keeps world point under cursor fixed during zoom", () => {
  const pan = { x: 240, y: 80 };
  const prevZoom = 1.0;
  const nextZoom = 1.6;
  const cursorX = 720;
  const cursorY = 420;

  const worldBeforeX = (cursorX - pan.x) / prevZoom;
  const worldBeforeY = (cursorY - pan.y) / prevZoom;

  const nextPan = computeCursorAnchoredPan(pan, prevZoom, nextZoom, cursorX, cursorY);
  const worldAfterX = (cursorX - nextPan.x) / nextZoom;
  const worldAfterY = (cursorY - nextPan.y) / nextZoom;

  assert.ok(Math.abs(worldBeforeX - worldAfterX) < 0.2);
  assert.ok(Math.abs(worldBeforeY - worldAfterY) < 0.2);
});

test("computeWheelZoomNext zooms smoothly in/out and respects bounds", () => {
  const zoomedIn = computeWheelZoomNext(1.0, -60, true);
  assert.ok(zoomedIn > 1.0 && zoomedIn <= 2.4);

  const zoomedOut = computeWheelZoomNext(1.0, 60, true);
  assert.ok(zoomedOut < 1.0 && zoomedOut >= 0.65);

  assert.equal(computeWheelZoomNext(2.4, -120, false), 2.4);
  assert.equal(computeWheelZoomNext(0.65, 120, false), 0.65);
});

test("Grid cursor-following zoom keeps hovered card locked beneath cursor", () => {
  const oldCards: LayoutCardBox[] = [
    { id: "a", x: 0, y: 0, width: 300, height: 200 },
    { id: "b", x: 312, y: 0, width: 300, height: 200 },
    { id: "c", x: 0, y: 212, width: 300, height: 200 },
    { id: "d", x: 312, y: 212, width: 300, height: 200 },
  ];

  // Cursor hovering middle of card "d" at viewportY = 312 (scrollTop = 0)
  const anchor = computeGridCursorAnchor(oldCards, 450, 312, 312, 420);
  assert.equal(anchor.cardId, "d");
  assert.ok(Math.abs(anchor.relYInCard - 0.5) < 0.01);

  // After zooming in, card "d" moves much further down to y = 780, height = 360
  const newCards: LayoutCardBox[] = [
    { id: "a", x: 0, y: 0, width: 520, height: 360 },
    { id: "b", x: 0, y: 372, width: 520, height: 360 },
    { id: "c", x: 532, y: 372, width: 520, height: 360 },
    { id: "d", x: 0, y: 780, width: 520, height: 360 },
  ];
  const nextScrollTop = computeGridAnchoredScrollTop(newCards, anchor, 1600, 760, 0);
  // Middle of card "d" is 780 + 180 = 960; minus viewportY 312 = 648
  assert.equal(nextScrollTop, 648);
});

test("computeGridRevealScrollTop leaves visible card alone and centers off-screen card", () => {
  // Already comfortably inside viewport [0..800]
  const visible = computeGridRevealScrollTop(240, 200, 0, 800, 2400, 68);
  assert.equal(visible.needsScroll, false);
  assert.equal(visible.targetScrollTop, 0);

  // Completely below viewport
  const below = computeGridRevealScrollTop(1400, 220, 0, 800, 2400, 68);
  assert.equal(below.needsScroll, true);
  // Center: 1400 + 110 - 400 = 1110
  assert.equal(below.targetScrollTop, 1110);

  // Completely above current scrollTop
  const above = computeGridRevealScrollTop(40, 180, 1000, 800, 2400, 68);
  assert.equal(above.needsScroll, true);
  assert.equal(above.targetScrollTop, 0);
});

test("computeCanvasRevealForCollapse pans off-screen card into center and predicts exact screen rect", () => {
  // Card comfortably visible on screen
  const visible = computeCanvasRevealForCollapse(
    { x: 200, y: 180, width: 220, height: 160 },
    { x: 240, y: 60 },
    1.0,
    0,
    0,
    1440,
    900,
    240,
  );
  assert.equal(visible.needsPan, false);
  assert.equal(visible.finalScreenRect.left, 440);
  assert.equal(visible.finalScreenRect.top, 240);

  // Card far off-screen to the bottom-right
  const offscreen = computeCanvasRevealForCollapse(
    { x: 1800, y: 1200, width: 240, height: 180 },
    { x: 240, y: 60 },
    1.0,
    0,
    0,
    1440,
    900,
    240,
  );
  assert.equal(offscreen.needsPan, true);
  // Center of visible area to right of 240px sidebar: x = 240 + 600 = 840, y = 450
  assert.equal(
    Math.round(offscreen.finalScreenRect.left + offscreen.finalScreenRect.width / 2),
    840,
  );
  assert.equal(
    Math.round(offscreen.finalScreenRect.top + offscreen.finalScreenRect.height / 2),
    450,
  );
});

test("sampleHeroEase is monotonic from 0 to 1 with fast ease-out curve", () => {
  assert.equal(sampleHeroEase(0), 0);
  assert.equal(sampleHeroEase(1), 1);
  const q1 = sampleHeroEase(0.25);
  const mid = sampleHeroEase(0.5);
  const q3 = sampleHeroEase(0.75);
  assert.ok(q1 > 0.4 && mid > q1 && q3 > mid && q3 < 1);
});

test("stepQuickLookWheelNavigation supports wheel/swipe with inertia cooldown and boundary checks", () => {
  let state = { accum: 0, lastEventAt: 0, cooldownUntil: 0 };

  // Small scroll below threshold accumulates without firing
  let step = stepQuickLookWheelNavigation(state, 0, 18, 1000, true, true);
  assert.equal(step.direction, 0);
  state = step.nextState;

  // Crossing threshold advances to next card and starts cooldown
  step = stepQuickLookWheelNavigation(state, 0, 22, 1030, true, true);
  assert.equal(step.direction, 1);
  state = step.nextState;

  // Inertia tail during cooldown is suppressed
  step = stepQuickLookWheelNavigation(state, 0, 80, 1150, true, true);
  assert.equal(step.direction, 0);
  state = step.nextState;

  // After cooldown, horizontal left swipe goes previous
  step = stepQuickLookWheelNavigation(state, -48, 2, 1400, true, true);
  assert.equal(step.direction, -1);
  state = step.nextState;

  // Respects boundary when cannot go prev
  step = stepQuickLookWheelNavigation(state, -60, 0, 1800, false, true);
  assert.equal(step.direction, 0);
});
