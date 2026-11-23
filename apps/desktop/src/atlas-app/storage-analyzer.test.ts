import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LibraryItem } from "./library-engine";
import {
  buildDiskStorageModel,
  computeMatrixColumnLayout,
  computePixelCellState,
  formatGb,
  hitTestMatrixColumn,
  stepSegmentFocusMap,
  STORAGE_CATEGORY_SPECS,
  type StorageCategoryId,
} from "./storage-analyzer";

function makeItem(
  id: string,
  title: string,
  kind: LibraryItem["kind"],
  trashed = false,
): LibraryItem {
  return {
    id,
    title,
    filename: `${id}.bin`,
    src: "",
    width: 1200,
    height: 900,
    kind,
    collectionId: null,
    tags: [],
    liked: false,
    trashed,
    palette: ["#111111"],
    note: "",
    addedAt: "Today",
    canvasX: 0,
    canvasY: 0,
    canvasW: 240,
    canvasZ: 1,
  };
}

const SAMPLE_ITEMS: LibraryItem[] = [
  makeItem("img-1", "Kyoto Concrete", "image"),
  makeItem("img-2", "Brutalist Glass", "image"),
  makeItem("vid-1", "Spatial Reel", "video"),
  makeItem("m3d-1", "Leica Optical Camera", "model3d"),
  makeItem("m3d-2", "Acoustic Monitor", "model3d"),
  makeItem("m3d-3", "Ceramic Vessel", "model3d"),
  makeItem("m3d-4", "Tactile Dial", "model3d"),
  makeItem("aud-1", "Tokyo Rain", "audio"),
  makeItem("aud-2", "Analog Tape", "audio"),
  makeItem("aud-3", "Studio Reverb", "audio"),
  makeItem("aud-4", "Sub Bass Stem", "audio"),
  makeItem("fnt-1", "Inter Variable", "font"),
  makeItem("fnt-2", "Cormorant Serif", "font"),
  makeItem("gif-1", "Fluid Orb", "gif"),
  makeItem("gif-2", "Kinetic Grid", "gif"),
  makeItem("tr-1", "Old Export", "video", true),
];

describe("storage-analyzer pure logic", () => {
  it("builds a complete 12-category disk snapshot reflecting live Atlas rich-media items", () => {
    const snapshot = buildDiskStorageModel(SAMPLE_ITEMS, {
      locale: "zh-CN",
      cachesCleared: false,
      trashEmptied: false,
    });

    assert.equal(snapshot.totalCapacityGb, 512);
    assert.equal(snapshot.segments.length, 12);

    const byId = new Map(snapshot.segments.map((s) => [s.id, s]));
    assert.equal(byId.get("models3d")?.itemCount, 4);
    assert.equal(byId.get("audio")?.itemCount, 4);
    assert.equal(byId.get("fonts")?.itemCount, 2);
    assert.equal(byId.get("gifs")?.itemCount, 2);
    assert.ok((byId.get("caches")?.gb ?? 0) > 20);
    assert.ok((byId.get("trash")?.gb ?? 0) > 9);
    assert.ok(byId.get("models3d")?.detail.includes("Leica Optical Camera"));
    assert.equal(
      Math.round((snapshot.usedGb + snapshot.availableGb) * 10) / 10,
      snapshot.totalCapacityGb,
    );

    const cleared = buildDiskStorageModel(SAMPLE_ITEMS, {
      locale: "en",
      cachesCleared: true,
      trashEmptied: true,
    });
    const clearedById = new Map(cleared.segments.map((s) => [s.id, s]));
    assert.equal(clearedById.get("caches")?.gb, 0);
    assert.equal(clearedById.get("trash")?.gb, 0);
    assert.ok(cleared.availableGb > snapshot.availableGb + 25);
  });

  it("allocates contiguous non-overlapping column ranges bounded within totalCols", () => {
    const snapshot = buildDiskStorageModel(SAMPLE_ITEMS, {
      locale: "en",
      cachesCleared: false,
      trashEmptied: false,
    });
    const ranges = computeMatrixColumnLayout(
      snapshot.segments,
      snapshot.totalCapacityGb,
      68,
    );

    assert.equal(ranges.length, 12);
    assert.equal(ranges[0]?.startCol, 0);
    for (let i = 1; i < ranges.length; i += 1) {
      assert.equal(ranges[i]!.startCol, ranges[i - 1]!.endCol);
      assert.ok(ranges[i]!.endCol > ranges[i]!.startCol);
    }
    const last = ranges[ranges.length - 1]!;
    assert.ok(last.endCol <= 68);
    assert.ok(last.endCol >= 40);

    // Zero-GB categories are omitted cleanly from rendered bands
    const cleared = buildDiskStorageModel(SAMPLE_ITEMS, {
      locale: "en",
      cachesCleared: true,
      trashEmptied: true,
    });
    const clearedRanges = computeMatrixColumnLayout(
      cleared.segments,
      cleared.totalCapacityGb,
      68,
    );
    assert.equal(clearedRanges.length, 10);
    assert.equal(
      clearedRanges.some((r) => r.id === "caches" || r.id === "trash"),
      false,
    );
  });

  it("hit-tests matrix columns accurately and returns null for free space", () => {
    const snapshot = buildDiskStorageModel(SAMPLE_ITEMS, {
      locale: "en",
    });
    const ranges = computeMatrixColumnLayout(
      snapshot.segments,
      snapshot.totalCapacityGb,
      68,
    );

    const first = ranges[0]!;
    const models = ranges.find((r) => r.id === "models3d")!;
    const last = ranges[ranges.length - 1]!;

    assert.equal(hitTestMatrixColumn(first.startCol, ranges), first.id);
    assert.equal(hitTestMatrixColumn(models.startCol, ranges), "models3d");
    assert.equal(hitTestMatrixColumn(last.endCol - 1, ranges), last.id);
    assert.equal(hitTestMatrixColumn(last.endCol, ranges), null);
    assert.equal(hitTestMatrixColumn(-1, ranges), null);
    assert.equal(formatGb(357.84), "357.8 GB");
  });

  it("smoothly steps per-segment hover focus and intensifies pixelated cells along the sweep wave", () => {
    const initialFocus = Object.fromEntries(
      STORAGE_CATEGORY_SPECS.map((s) => [s.id, 0]),
    ) as Record<StorageCategoryId, number>;

    const step1 = stepSegmentFocusMap(initialFocus, "developer", 0.05);
    assert.equal(step1.settled, false);
    assert.ok(step1.next.developer > 0.2 && step1.next.developer < 0.9);
    assert.equal(step1.next.apps, 0);

    // Switching hover target decays previous segment smoothly while rising new target
    const step2 = stepSegmentFocusMap(step1.next, "models3d", 0.05);
    assert.ok(step2.next.developer < step1.next.developer);
    assert.ok(step2.next.developer > 0);
    assert.ok(step2.next.models3d > 0.2);

    const restingCell = computePixelCellState({
      col: 12,
      row: 6,
      totalRows: 14,
      startCol: 8,
      endCol: 20,
      focus: 0,
      waveProgress: 0,
      waveOriginCol: 8,
      cursorCol: null,
      shimmerTick: 0,
    });
    const hoveredCell = computePixelCellState({
      col: 12,
      row: 6,
      totalRows: 14,
      startCol: 8,
      endCol: 20,
      focus: 1,
      waveProgress: 1,
      waveOriginCol: 8,
      cursorCol: 12,
      shimmerTick: 2,
    });

    assert.ok(hoveredCell.intensity > restingCell.intensity);
    assert.equal(hoveredCell.isActivePixel, true);
  });
});
