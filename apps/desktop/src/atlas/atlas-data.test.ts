import test from "node:test";
import assert from "node:assert/strict";
import {
  FAQ_ITEMS,
  FEATURE_ITEMS,
  SIDEBAR_COLLECTIONS,
  clampZoom,
  filterGalleryItems,
  validateEmail,
  validateFeedback,
} from "./atlas-data";

test("clampZoom restricts zoom scale cleanly to [0.7, 1.8]", () => {
  assert.equal(clampZoom(1.24), 1.2);
  assert.equal(clampZoom(0.2), 0.7);
  assert.equal(clampZoom(3.5), 1.8);
  assert.equal(clampZoom(Number.NaN), 1.2);
});

test("filterGalleryItems returns all items for 'all' and filters by collection id", () => {
  const sample = [
    { id: "1", collection: "macos-apps" },
    { id: "2", collection: "portfolio" },
    { id: "3", collection: "macos-apps" },
  ];
  assert.equal(filterGalleryItems(sample, "all").length, 3);
  assert.equal(filterGalleryItems(sample, "macos-apps").length, 2);
  assert.equal(filterGalleryItems(sample, "portfolio").length, 1);
  assert.equal(filterGalleryItems(sample, "memes").length, 0);
});

test("validateEmail rejects empty and malformed addresses and accepts valid emails", () => {
  assert.ok(validateEmail("") !== null);
  assert.ok(validateEmail("not-an-email") !== null);
  assert.ok(validateEmail("user@domain") !== null);
  assert.equal(validateEmail("designer@studio.co"), null);
});

test("validateFeedback enforces minimum message length and optional valid email", () => {
  assert.ok(validateFeedback("", "") !== null);
  assert.ok(validateFeedback("hi", "") !== null);
  assert.equal(validateFeedback("Add Figma plugin sync", ""), null);
  assert.ok(validateFeedback("Add Figma plugin sync", "bad-email") !== null);
  assert.equal(
    validateFeedback("Add Figma plugin sync", "alex@example.com"),
    null,
  );
});

test("Atlas data contains exact 12 feature items, 14 FAQs, and 7 sidebar collections", () => {
  assert.equal(FEATURE_ITEMS.length, 12);
  assert.equal(FAQ_ITEMS.length, 14);
  assert.equal(SIDEBAR_COLLECTIONS.length, 7);
  assert.equal(
    FEATURE_ITEMS.find((f) => f.id === "ios")?.badge,
    "COMING FALL '26",
  );
});
