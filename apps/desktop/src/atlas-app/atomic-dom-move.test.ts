import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmbeddedMotionSrcDoc,
  inferEmbeddedReelTheme,
  moveNodePreservingState,
  parseDurationToSeconds,
  resolveActiveHostSlot,
  type AtomicMoveParent,
} from "./atomic-dom-move";

test("moveNodePreservingState calls slot.moveBefore when available and preserves playback", () => {
  const calls: string[] = [];
  const fakeNode = { parentNode: null, nextSibling: null } as unknown as Node;

  const slotWithMoveBefore: AtomicMoveParent = {
    moveBefore(node, child) {
      calls.push(`moveBefore:${child === null ? "null" : "ref"}`);
      (node as unknown as { parentNode: unknown; nextSibling: unknown }).parentNode =
        slotWithMoveBefore;
      (node as unknown as { parentNode: unknown; nextSibling: unknown }).nextSibling =
        child;
    },
    insertBefore(node, _child) {
      calls.push("insertBefore");
      return node;
    },
  };

  const strategy = moveNodePreservingState(slotWithMoveBefore, fakeNode, null);
  assert.equal(strategy, "moveBefore");
  assert.deepEqual(calls, ["moveBefore:null"]);

  // Calling again when already placed in the exact slot position is a no-op
  const second = moveNodePreservingState(slotWithMoveBefore, fakeNode, null);
  assert.equal(second, "noop");
  assert.deepEqual(calls, ["moveBefore:null"]);
});

test("moveNodePreservingState falls back to slot.insertBefore when moveBefore is absent", () => {
  const calls: string[] = [];
  const fakeNode = { parentNode: null, nextSibling: null } as unknown as Node;

  const legacySlot: AtomicMoveParent = {
    insertBefore(node, child) {
      calls.push(`insertBefore:${child === null ? "null" : "ref"}`);
      (node as unknown as { parentNode: unknown; nextSibling: unknown }).parentNode =
        legacySlot;
      (node as unknown as { parentNode: unknown; nextSibling: unknown }).nextSibling =
        child;
      return node;
    },
  };

  const strategy = moveNodePreservingState(legacySlot, fakeNode, null);
  assert.equal(strategy, "insertBefore");
  assert.deepEqual(calls, ["insertBefore:null"]);
});

test("resolveActiveHostSlot enforces deterministic QuickLook > PiP > Card > Parking priority", () => {
  assert.equal(
    resolveActiveHostSlot({ hasQuickLook: true, hasPip: true, hasCard: true }),
    "quicklook",
  );
  assert.equal(
    resolveActiveHostSlot({ hasQuickLook: false, hasPip: true, hasCard: true }),
    "pip",
  );
  assert.equal(
    resolveActiveHostSlot({ hasQuickLook: false, hasPip: false, hasCard: true }),
    "card",
  );
  assert.equal(
    resolveActiveHostSlot({ hasQuickLook: false, hasPip: false, hasCard: false }),
    "parking",
  );
});

test("parseDurationToSeconds and buildEmbeddedMotionSrcDoc generate clean self-contained iframe embeds", () => {
  assert.equal(parseDurationToSeconds("0:14"), 14);
  assert.equal(parseDurationToSeconds("1:05"), 65);
  assert.equal(parseDurationToSeconds(undefined), 12);
  assert.equal(inferEmbeddedReelTheme("item-02", "Botanical Orb"), "orb");
  assert.equal(inferEmbeddedReelTheme("item-09", "Rotary Dial"), "rotary");

  const doc = buildEmbeddedMotionSrcDoc({
    itemId: "item-01",
    title: "Luminous Glass Interface Study",
    posterUrl: "/poster.jpg",
    durationSec: 14,
    palette: ["#60a5fa", "#f2901b", "#1c1c1e"],
    reelTheme: "glass",
  });
  assert.ok(doc.includes("__atlasEmbedSessionId"));
  assert.ok(doc.includes("atlas-embed-state"));
  assert.ok(doc.includes("Luminous Glass Interface Study"));
});
