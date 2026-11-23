import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLinearFlexPath,
  buildMorphingTrackGeometry,
  computeElasticBowOffset,
  computeOverstretchOffset,
  computeRadialProgressFromPoint,
  denormalizeBarValue,
  normalizeBarValue,
} from "./elastic-motion-bar";

test("normalizeBarValue and denormalizeBarValue clamp and snap cleanly to step", () => {
  assert.equal(normalizeBarValue(1.5, 0.5, 2.5), 0.5);
  assert.equal(normalizeBarValue(-10, 0, 100), 0);
  assert.equal(normalizeBarValue(150, 0, 100), 1);

  assert.equal(denormalizeBarValue(0.5, 4, 28, 2), 16);
  assert.equal(denormalizeBarValue(0.33, 0.65, 2.4, 0.05), 1.25);
  assert.equal(denormalizeBarValue(1.2, 0, 100, 1), 100);
});

test("computeElasticBowOffset and computeOverstretchOffset saturate smoothly with symmetry", () => {
  const up = computeElasticBowOffset(-40, 8);
  const down = computeElasticBowOffset(40, 8);
  assert.ok(up < 0 && down > 0);
  assert.equal(Number((up + down).toFixed(5)), 0);
  assert.ok(Math.abs(down) < 8);

  assert.equal(computeOverstretchOffset(0.5, 5), 0);
  assert.ok(computeOverstretchOffset(-0.4, 5) < 0);
  assert.ok(computeOverstretchOffset(1.4, 5) > 0);
});

test("buildLinearFlexPath places the orange tip dead-center along the bowed quadratic curve", () => {
  const res = buildLinearFlexPath(200, 16, 0.5, 10, 8);
  assert.equal(res.startX, 8);
  assert.equal(res.endX, 192);
  // At t=0.5 on Q(y=16, ctrl=26, y=16), exact De Casteljau midpoint y = 0.25*16 + 0.5*26 + 0.25*16 = 21
  assert.equal(res.tipX, 100);
  assert.equal(res.tipY, 21);
  assert.ok(res.trackD.includes("Q 100 26"));
  assert.ok(res.fillD.includes("100 21"));
});

test("buildMorphingTrackGeometry morphs smoothly from horizontal bar to 360-degree ring", () => {
  const linear = buildMorphingTrackGeometry(0, 0.5, 200, 190, 84, 120, 110);
  assert.equal(linear.tipX, 120);
  assert.equal(linear.tipY, 190);

  // At morph = 1, progress = 0.5 should sit at 6 o'clock (bottom: cx=120, y=ringCy + ringRadius = 194)
  const ringHalf = buildMorphingTrackGeometry(1, 0.5, 200, 190, 84, 120, 110);
  assert.ok(Math.abs(ringHalf.tipX - 120) < 0.5);
  assert.ok(Math.abs(ringHalf.tipY - 194) < 0.5);

  // At morph = 1, progress = 0.25 should sit at 9 o'clock (left: cx - r = 36, y = 110)
  const ringQuarter = buildMorphingTrackGeometry(1, 0.25, 200, 190, 84, 120, 110);
  assert.ok(Math.abs(ringQuarter.tipX - 36) < 0.5);
  assert.ok(Math.abs(ringQuarter.tipY - 110) < 0.5);
});

test("computeRadialProgressFromPoint maps 12/9/6/3 o'clock to 0 / 0.25 / 0.5 / 0.75", () => {
  assert.ok(computeRadialProgressFromPoint(100, 20, 100, 100) < 0.01);
  assert.ok(Math.abs(computeRadialProgressFromPoint(20, 100, 100, 100) - 0.25) < 0.01);
  assert.ok(Math.abs(computeRadialProgressFromPoint(100, 180, 100, 100) - 0.5) < 0.01);
  assert.ok(Math.abs(computeRadialProgressFromPoint(180, 100, 100, 100) - 0.75) < 0.01);
});
