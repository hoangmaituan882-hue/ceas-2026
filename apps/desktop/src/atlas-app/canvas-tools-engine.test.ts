import assert from "node:assert/strict";
import test from "node:test";
import {
  addReplyToCommentPin,
  computeCanvasFitViewport,
  computePanToCenterWorldPoint,
  createCanvasCommentPin,
  createCanvasNote,
  findCanvasMatches,
  stepMatchIndex,
  toggleReactionOnList,
} from "./canvas-tools-engine";

test("computeCanvasFitViewport centers and scales all boxes cleanly inside workspace bounds", () => {
  const boxes = [
    { id: "a", x: 0, y: 0, width: 400, height: 300 },
    { id: "b", x: 600, y: 300, width: 400, height: 300 },
  ];

  const fit = computeCanvasFitViewport(boxes, 1440, 900, 232, 48);

  assert.ok(fit.zoom >= 0.65 && fit.zoom <= 1.35);
  // Leftmost rendered edge stays clear of the 232px sidebar
  const renderedMinX = fit.panX + 0 * fit.zoom;
  const renderedMaxX = fit.panX + 1000 * fit.zoom;
  assert.ok(renderedMinX >= 232);
  assert.ok(renderedMaxX <= 1440);
});

test("findCanvasMatches searches media items, note cards, and unresolved comment pins", () => {
  const items = [
    {
      id: "i1",
      title: "Glass Interface Study",
      tags: ["glass", "toolbar"],
      note: "translucent",
      canvasX: 40,
      canvasY: 40,
      canvasW: 200,
      width: 1600,
      height: 1000,
    },
  ];
  const notes = [
    createCanvasNote("n1", 320, 120, 10, {
      title: "Toolbar Spec",
      body: "Porcelain floating pills",
    }),
  ];
  const comments = [
    createCanvasCommentPin("c1", 1, 500, 200, "Check toolbar spacing", "You", "Just now"),
    {
      ...createCanvasCommentPin("c2", 2, 540, 240, "Resolved toolbar note", "You", "Just now"),
      resolved: true,
    },
  ];

  const matches = findCanvasMatches(items, notes, comments, "toolbar");
  assert.equal(matches.length, 3);
  assert.deepEqual(
    matches.map((m) => m.kind),
    ["item", "note", "comment"],
  );
});

test("stepMatchIndex wraps cleanly forwards and backwards", () => {
  assert.equal(stepMatchIndex(0, 7, 1), 1);
  assert.equal(stepMatchIndex(6, 7, 1), 0);
  assert.equal(stepMatchIndex(0, 7, -1), 6);
  assert.equal(stepMatchIndex(-1, 0, 1), -1);
});

test("comment pin replies, reactions, and center-point panning are pure and deterministic", () => {
  const pin = createCanvasCommentPin("c1", 1, 200, 150, "Try warmer lighting", "Studio", "Now");
  const withReply = addReplyToCommentPin(pin, "r1", "Updated contrast!", "You", "Just now");
  assert.equal(withReply.replies.length, 1);
  assert.equal(pin.replies.length, 0);

  const r1 = toggleReactionOnList([], "✨");
  assert.deepEqual(r1, ["✨"]);
  assert.deepEqual(toggleReactionOnList(r1, "✨"), []);

  const pan = computePanToCenterWorldPoint(400, 300, 1.0, 1440, 900, 232);
  // Workspace center X = 232 + (1440-232)/2 = 836 -> 836 - 400 = 436
  assert.equal(pan.x, 436);
  assert.equal(pan.y, 150);
});
