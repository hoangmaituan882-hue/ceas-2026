import test from "node:test";
import assert from "node:assert/strict";
import {
  clampRadius,
  clampSpacing,
  clampZoom,
  computeFlatGridLayout,
  computeInfinityWallTiles,
  computeJustifiedRows,
  createTagFolder,
  filterLibraryItems,
  getSmartCounts,
  getTagFolderItemCount,
  nestTagIntoFolder,
  reorderItemsById,
  shuffleItems,
  unnestTag,
  type LibraryItem,
  type TagFolder,
} from "./library-engine";

function makeItem(overrides: Partial<LibraryItem> & { id: string }): LibraryItem {
  return {
    title: "Reference",
    filename: "ref.jpg",
    src: "/ref.jpg",
    width: 1600,
    height: 1200,
    kind: "image",
    collectionId: "hardware",
    tags: ["app"],
    liked: false,
    trashed: false,
    palette: ["#111111"],
    note: "",
    addedAt: "Today",
    canvasX: 0,
    canvasY: 0,
    canvasW: 240,
    canvasZ: 1,
    ...overrides,
  };
}

test("computeJustifiedRows preserves aspect ratios and fills full row width", () => {
  const items = [
    makeItem({ id: "1", width: 1600, height: 1200 }),
    makeItem({ id: "2", width: 1200, height: 1600 }),
    makeItem({ id: "3", width: 1600, height: 900 }),
    makeItem({ id: "4", width: 1000, height: 1000 }),
  ];
  const rows = computeJustifiedRows(items, 900, 220, 12);
  assert.ok(rows.length >= 1);
  const firstRow = rows[0]!;
  const totalWidth =
    firstRow.items.reduce((sum, entry) => sum + entry.width, 0) +
    12 * (firstRow.items.length - 1);
  assert.ok(Math.abs(totalWidth - 900) < 2);
});

test("createTagFolder & nestTagIntoFolder replicate Video 4 folder nesting and live counts", () => {
  const items = [
    makeItem({ id: "1", tags: ["app", "onboarding"] }),
    makeItem({ id: "2", tags: ["mac app"] }),
    makeItem({ id: "3", tags: ["hardware"] }),
  ];

  const emptyErr = createTagFolder([], "   ");
  assert.ok(emptyErr.error !== null);

  const createdRes = createTagFolder([], "Mac apps");
  assert.equal(createdRes.error, null);
  assert.equal(createdRes.folders.length, 1);
  const folderId = createdRes.created!.id;

  const dupErr = createTagFolder(createdRes.folders, "mac apps");
  assert.ok(dupErr.error !== null);

  let folders: TagFolder[] = nestTagIntoFolder(createdRes.folders, "app", folderId);
  assert.equal(getTagFolderItemCount(items, folders[0]!), 1);

  folders = nestTagIntoFolder(folders, "mac app", folderId);
  assert.equal(getTagFolderItemCount(items, folders[0]!), 2);

  const filtered = filterLibraryItems(
    items,
    `tag-folder:${folderId}`,
    "",
    false,
    folders,
  );
  assert.equal(filtered.length, 2);

  folders = unnestTag(folders, "app");
  assert.equal(getTagFolderItemCount(items, folders[0]!), 1);
});

test("filterLibraryItems & getSmartCounts handle Inbox, Likes, Links, Untagged, Trash, Media types, and Search", () => {
  const items = [
    makeItem({ id: "1", title: "Braun Speaker", collectionId: null, tags: [], liked: true }),
    makeItem({ id: "2", title: "CineStill 800T", kind: "link", domain: "cinestill.com", tags: ["film"] }),
    makeItem({ id: "3", title: "Deleted Shot", trashed: true, liked: true }),
    makeItem({ id: "4", title: "Analog Pad", kind: "audio", tags: ["audio"] }),
    makeItem({ id: "5", title: "Camera 3D", kind: "model3d", tags: ["3d"] }),
    makeItem({ id: "6", title: "Fraunces Font", kind: "font", tags: ["typography"] }),
    makeItem({ id: "7", title: "Kinetic Loop", kind: "gif", tags: ["gif"] }),
  ];

  const counts = getSmartCounts(items);
  assert.deepEqual(counts, {
    all: 6,
    inbox: 1,
    likes: 1,
    links: 1,
    untagged: 1,
    trash: 1,
    audio: 1,
    model3d: 1,
    font: 1,
    gif: 1,
  });

  assert.equal(filterLibraryItems(items, "all", "braun", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "links", "", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "trash", "", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "all", "", true, []).length, 1);
  assert.equal(filterLibraryItems(items, "media:audio", "", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "media:model3d", "", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "media:font", "", false, []).length, 1);
  assert.equal(filterLibraryItems(items, "media:gif", "", false, []).length, 1);
});

test("appearance clampers bound zoom, spacing, and corner radius", () => {
  assert.equal(clampZoom(0.2), 0.65);
  assert.equal(clampZoom(5), 2.4);
  assert.equal(clampSpacing(2), 4);
  assert.equal(clampSpacing(80), 28);
  assert.equal(clampRadius(-5), 0);
  assert.equal(clampRadius(50), 20);
});

test("shuffleItems produces deterministic permutations without mutating source", () => {
  const source = [1, 2, 3, 4, 5, 6, 7, 8];
  const s1 = shuffleItems(source, 42);
  const s2 = shuffleItems(source, 42);
  const s3 = shuffleItems(source, 99);

  assert.deepEqual(source, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort((a, b) => a - b), source);
  assert.notDeepEqual(s1, s3);
});

test("computeFlatGridLayout reflows smoothly across justified, square, and fit modes", () => {
  const items = [
    makeItem({ id: "1", width: 1600, height: 900 }),
    makeItem({ id: "2", width: 1200, height: 1200 }),
    makeItem({ id: "3", width: 1200, height: 1600 }),
    makeItem({ id: "4", width: 1600, height: 1200 }),
  ];

  const zoomedOut = computeFlatGridLayout(items, 1000, 0.85, 12, "justified");
  const zoomedIn = computeFlatGridLayout(items, 1000, 1.85, 12, "justified");
  const square = computeFlatGridLayout(items, 1000, 1.1, 12, "square");

  assert.equal(zoomedOut.cards.length, 4);
  assert.equal(zoomedIn.cards.length, 4);
  assert.ok(zoomedIn.totalHeight > zoomedOut.totalHeight);
  assert.equal(square.cards[0]!.width, square.cards[0]!.height);
});

test("reorderItemsById moves item immutably to target slot", () => {
  const items = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })];
  const moved = reorderItemsById(items, "c", "a");
  assert.deepEqual(
    moved.map((it) => it.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    items.map((it) => it.id),
    ["a", "b", "c"],
  );
});

test("computeInfinityWallTiles fills viewport densely in all directions with unique keys", () => {
  const items = [
    makeItem({ id: "1", width: 1600, height: 900 }),
    makeItem({ id: "2", width: 1200, height: 1200 }),
    makeItem({ id: "3", width: 1600, height: 1200 }),
  ];
  const tiles = computeInfinityWallTiles(items, 1440, 900, -180, -120, 1.1, 12);
  assert.ok(tiles.length > 15);
  const uniqueKeys = new Set(tiles.map((t) => t.key));
  assert.equal(uniqueKeys.size, tiles.length);
  // Tiles exist covering top-left and bottom-right of viewport
  assert.ok(tiles.some((t) => t.x < 100 && t.y < 100));
  assert.ok(tiles.some((t) => t.x + t.width > 1300 && t.y + t.height > 800));
});
