import test from "node:test";
import assert from "node:assert/strict";
import {
  computePaletteSimilarity,
  distributeSimilarMasonry,
  generateSmartTitleSuggestion,
  parseHexRgb,
  rankSimilarItems,
} from "./inspector-similarity";
import type { LibraryItem } from "./library-engine";

function makeItem(overrides: Partial<LibraryItem>): LibraryItem {
  return {
    id: overrides.id ?? "it-1",
    title: overrides.title ?? "Untitled",
    filename: overrides.filename ?? "sample-poster.jpg",
    kind: overrides.kind ?? "image",
    src: overrides.src ?? "https://example.com/a.jpg",
    width: overrides.width ?? 1200,
    height: overrides.height ?? 1600,
    palette: overrides.palette ?? ["#3b66b0", "#11224d", "#d8e1f0"],
    tags: overrides.tags ?? ["poster", "typography"],
    collectionId: overrides.collectionId ?? "col-editorial",
    liked: overrides.liked ?? false,
    trashed: overrides.trashed ?? false,
    note: overrides.note ?? "",
    addedAt: overrides.addedAt ?? "2026-01-01",
    canvasX: 0,
    canvasY: 0,
    canvasW: 240,
    canvasZ: 1,
    ...overrides,
  };
}

test("parseHexRgb handles 3-digit, 6-digit, and invalid hex values", () => {
  assert.deepEqual(parseHexRgb("#fff"), [255, 255, 255]);
  assert.deepEqual(parseHexRgb("#1a2b3c"), [26, 43, 60]);
  assert.equal(parseHexRgb("not-a-color"), null);
});

test("computePaletteSimilarity scores identical palettes as 1 and opposing palettes low", () => {
  const blueA = ["#254d99", "#132957", "#89a8e0"];
  const blueB = ["#2850a1", "#142c5c", "#8eaee5"];
  const warmC = ["#f5d742", "#e85d04", "#fffae0"];

  assert.equal(computePaletteSimilarity(blueA, blueA), 1);
  assert.ok(
    computePaletteSimilarity(blueA, blueB) >
      computePaletteSimilarity(blueA, warmC) + 0.35,
  );
});

test("rankSimilarItems prioritizes shared palette/tags/collection and excludes self and trashed items", () => {
  const source = makeItem({
    id: "src",
    title: "Blue Note Jazz Festival Poster",
    palette: ["#3a62b0", "#0e224d", "#a8bde6"],
    tags: ["poster", "jazz", "typography"],
    collectionId: "col-editorial",
  });

  const bestMatch = makeItem({
    id: "m-best",
    title: "Blue Typography Print",
    palette: ["#3f68b5", "#122754", "#b0c4ea"],
    tags: ["poster", "typography"],
    collectionId: "col-editorial",
  });

  const weakMatch = makeItem({
    id: "m-weak",
    title: "Warm Sand Dunes",
    kind: "video",
    palette: ["#f2d399", "#d48c46", "#fff6e5"],
    tags: ["nature", "desert"],
    collectionId: "col-motion",
  });

  const trashedMatch = makeItem({
    id: "m-trashed",
    title: "Blue Note Duplicate",
    palette: ["#3a62b0", "#0e224d", "#a8bde6"],
    tags: ["poster", "jazz", "typography"],
    collectionId: "col-editorial",
    trashed: true,
  });

  const ranked = rankSimilarItems(source, [
    source,
    weakMatch,
    trashedMatch,
    bestMatch,
  ]);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]!.item.id, "m-best");
  assert.equal(ranked[1]!.item.id, "m-weak");
  assert.ok(ranked[0]!.score > ranked[1]!.score);
  assert.deepEqual(ranked[0]!.sharedTags, ["poster", "typography"]);
});

test("distributeSimilarMasonry balances column heights greedily across 2 columns", () => {
  const source = makeItem({ id: "src" });
  const pool = [
    makeItem({ id: "a", width: 1000, height: 1500 }), // tall 1.5
    makeItem({ id: "b", width: 1500, height: 1000 }), // wide 0.67
    makeItem({ id: "c", width: 1500, height: 1000 }), // wide 0.67
    makeItem({ id: "d", width: 1000, height: 1000 }), // square 1.0
  ];
  const ranked = rankSimilarItems(source, pool, 10);
  const [left, right] = distributeSimilarMasonry(ranked);

  assert.equal(left.length + right.length, 4);
  const leftTotal = left.reduce((acc, m) => acc + m.heightRatio, 0);
  const rightTotal = right.reduce((acc, m) => acc + m.heightRatio, 0);
  assert.ok(
    Math.abs(leftTotal - rightTotal) < 0.7,
    `Expected balanced columns, got left=${leftTotal}, right=${rightTotal}`,
  );
});

test("generateSmartTitleSuggestion produces clean distinct localized suggestions", () => {
  const item = makeItem({
    title: "IMG_9042",
    filename: "blue-note-jazz-poster.jpg",
    tags: ["poster", "jazz"],
  });

  const en0 = generateSmartTitleSuggestion(item, "en", 0);
  const en1 = generateSmartTitleSuggestion(item, "en", 1);
  const zh0 = generateSmartTitleSuggestion(item, "zh-CN", 0);

  assert.ok(en0.length > 0 && en0 !== item.title);
  assert.notEqual(en0, en1);
  assert.ok(zh0.length > 0);
});
