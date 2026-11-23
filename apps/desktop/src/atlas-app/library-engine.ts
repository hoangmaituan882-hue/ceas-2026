import type {
  AudioMeta,
  FontMeta,
  GifMeta,
  LibraryItemKind,
  Model3DMeta,
} from "./media-helpers";

export type ViewMode = "grid" | "canvas" | "infinity";
export type GridLayoutMode = "justified" | "square" | "fit";
export type ThemeMode = "light" | "dark";

export interface LibraryItem {
  id: string;
  title: string;
  filename: string;
  src: string;
  width: number;
  height: number;
  kind: LibraryItemKind;
  duration?: string;
  domain?: string;
  audioMeta?: AudioMeta;
  modelMeta?: Model3DMeta;
  fontMeta?: FontMeta;
  gifMeta?: GifMeta;
  collectionId: string | null;
  tags: string[];
  liked: boolean;
  trashed: boolean;
  palette: string[];
  note: string;
  addedAt: string;
  canvasX: number;
  canvasY: number;
  canvasW: number;
  canvasZ: number;
}

export interface CollectionItem {
  id: string;
  name: string;
  color: string;
}

export interface TagFolder {
  id: string;
  name: string;
  tags: string[];
  collapsed: boolean;
}

export interface JustifiedRowItem {
  item: LibraryItem;
  width: number;
  height: number;
}

export interface JustifiedRow {
  height: number;
  items: JustifiedRowItem[];
}

export interface AppearancePrefs {
  theme: ThemeMode;
  zoom: number;
  spacing: number;
  radius: number;
  gridLayout: GridLayoutMode;
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1.15;
  return Math.round(Math.min(2.4, Math.max(0.65, value)) * 20) / 20;
}

export function clampSpacing(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.round(Math.min(28, Math.max(4, value)));
}

export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.round(Math.min(20, Math.max(0, value)));
}

/**
 * Computes Atlas-style justified horizontal rows where every row preserves
 * natural aspect ratios while cleanly spanning 100% of containerWidth.
 */
export function computeJustifiedRows(
  items: readonly LibraryItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): JustifiedRow[] {
  if (items.length === 0 || containerWidth <= 0) return [];
  const safeTarget = Math.max(90, targetRowHeight);
  const rows: JustifiedRow[] = [];
  let bucket: LibraryItem[] = [];
  let aspectSum = 0;

  for (const item of items) {
    const ratio = item.height > 0 ? item.width / item.height : 1;
    bucket.push(item);
    aspectSum += ratio;

    const totalGap = gap * Math.max(0, bucket.length - 1);
    const idealWidth = aspectSum * safeTarget + totalGap;

    if (idealWidth >= containerWidth) {
      const exactHeight = (containerWidth - totalGap) / aspectSum;
      const clampedHeight = Math.max(84, Math.min(safeTarget * 1.55, exactHeight));
      rows.push({
        height: clampedHeight,
        items: bucket.map((entry) => {
          const r = entry.height > 0 ? entry.width / entry.height : 1;
          return {
            item: entry,
            width: Math.max(60, r * clampedHeight),
            height: clampedHeight,
          };
        }),
      });
      bucket = [];
      aspectSum = 0;
    }
  }

  if (bucket.length > 0) {
    const totalGap = gap * Math.max(0, bucket.length - 1);
    const naturalWidth = aspectSum * safeTarget + totalGap;
    // Only justify the trailing row if it's at least 62% full; otherwise keep target height.
    const height =
      naturalWidth >= containerWidth * 0.62
        ? Math.min(safeTarget * 1.25, (containerWidth - totalGap) / aspectSum)
        : safeTarget;

    rows.push({
      height,
      items: bucket.map((entry) => {
        const r = entry.height > 0 ? entry.width / entry.height : 1;
        return {
          item: entry,
          width: Math.max(60, r * height),
          height,
        };
      }),
    });
  }

  return rows;
}

export function collectAllTags(items: readonly LibraryItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.trashed) continue;
    for (const tag of item.tags) set.add(tag);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function getTagItemCount(
  items: readonly LibraryItem[],
  tagName: string,
): number {
  return items.filter((item) => !item.trashed && item.tags.includes(tagName))
    .length;
}

export function getTagFolderItemCount(
  items: readonly LibraryItem[],
  folder: TagFolder,
): number {
  if (folder.tags.length === 0) return 0;
  const tagSet = new Set(folder.tags);
  return items.filter(
    (item) => !item.trashed && item.tags.some((t) => tagSet.has(t)),
  ).length;
}

export function createTagFolder(
  folders: readonly TagFolder[],
  name: string,
): { folders: TagFolder[]; created: TagFolder | null; error: string | null } {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      folders: [...folders],
      created: null,
      error: "Folder name cannot be empty.",
    };
  }
  if (
    folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())
  ) {
    return {
      folders: [...folders],
      created: null,
      error: "A folder with this name already exists.",
    };
  }
  const created: TagFolder = {
    id: `tf-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${folders.length + 1}`,
    name: trimmed,
    tags: [],
    collapsed: false,
  };
  return {
    folders: [created, ...folders],
    created,
    error: null,
  };
}

export function nestTagIntoFolder(
  folders: readonly TagFolder[],
  tagName: string,
  targetFolderId: string,
): TagFolder[] {
  const cleanTag = tagName.trim();
  if (!cleanTag) return [...folders];

  return folders.map((folder) => {
    const withoutTag = folder.tags.filter((t) => t !== cleanTag);
    if (folder.id !== targetFolderId) {
      return { ...folder, tags: withoutTag };
    }
    return {
      ...folder,
      collapsed: false,
      tags: [cleanTag, ...withoutTag],
    };
  });
}

export function unnestTag(
  folders: readonly TagFolder[],
  tagName: string,
): TagFolder[] {
  return folders.map((folder) => ({
    ...folder,
    tags: folder.tags.filter((t) => t !== tagName),
  }));
}

export function filterLibraryItems(
  items: readonly LibraryItem[],
  activeNav: string,
  searchQuery: string,
  likedOnly: boolean,
  tagFolders: readonly TagFolder[],
): LibraryItem[] {
  const q = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (activeNav === "trash") {
      if (!item.trashed) return false;
    } else {
      if (item.trashed) return false;
    }

    if (activeNav === "inbox" && item.collectionId !== null) return false;
    if (activeNav === "likes" && !item.liked) return false;
    if (activeNav === "links" && item.kind !== "link") return false;
    if (activeNav === "untagged" && item.tags.length > 0) return false;

    if (activeNav.startsWith("media:")) {
      const targetKind = activeNav.slice("media:".length);
      if (item.kind !== targetKind) return false;
    } else if (activeNav.startsWith("collection:")) {
      const colId = activeNav.slice("collection:".length);
      if (item.collectionId !== colId) return false;
    } else if (activeNav.startsWith("tag:")) {
      const tag = activeNav.slice("tag:".length);
      if (!item.tags.includes(tag)) return false;
    } else if (activeNav.startsWith("tag-folder:")) {
      const folderId = activeNav.slice("tag-folder:".length);
      const folder = tagFolders.find((f) => f.id === folderId);
      if (!folder) return false;
      const folderTagSet = new Set(folder.tags);
      if (!item.tags.some((t) => folderTagSet.has(t))) return false;
    }

    if (likedOnly && !item.liked) return false;

    if (q) {
      const kindKeywords: Record<LibraryItemKind, string> = {
        image: "image photo 图片",
        video: "video motion 视频",
        link: "link bookmark 链接",
        audio: "audio sound music wav flac mp3 音频 音乐 播放器",
        model3d: "3d model glb obj mesh 模型 三维",
        font: "font typeface typography otf woff2 ttf 字体 排印",
        gif: "gif animation loop 动图 动画",
      };
      const haystack = [
        item.title,
        item.filename,
        item.domain ?? "",
        item.note,
        kindKeywords[item.kind],
        item.audioMeta?.artist ?? "",
        item.audioMeta?.format ?? "",
        item.modelMeta?.format ?? "",
        item.fontMeta?.family ?? "",
        item.fontMeta?.foundry ?? "",
        item.fontMeta?.format ?? "",
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function getSmartCounts(items: readonly LibraryItem[]) {
  let all = 0;
  let inbox = 0;
  let likes = 0;
  let links = 0;
  let untagged = 0;
  let trash = 0;
  let audio = 0;
  let model3d = 0;
  let font = 0;
  let gif = 0;

  for (const item of items) {
    if (item.trashed) {
      trash += 1;
      continue;
    }
    all += 1;
    if (item.collectionId === null) inbox += 1;
    if (item.liked) likes += 1;
    if (item.kind === "link") links += 1;
    if (item.kind === "audio") audio += 1;
    if (item.kind === "model3d") model3d += 1;
    if (item.kind === "font") font += 1;
    if (item.kind === "gif") gif += 1;
    if (item.tags.length === 0) untagged += 1;
  }

  return { all, inbox, likes, links, untagged, trash, audio, model3d, font, gif };
}

/**
 * Deterministic Fisher-Yates shuffle for Atlas Grid Shuffle control.
 */
export function shuffleItems<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = (Math.abs(Math.floor(seed)) || 1) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i];
    const swap = out[j];
    if (tmp !== undefined && swap !== undefined) {
      out[i] = swap;
      out[j] = tmp;
    }
  }
  return out;
}

export interface PositionedGridCard {
  item: LibraryItem;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes flat absolute (x, y, width, height) coordinates for every card across
 * Justified, Square, and Fit modes so zooming, shuffling, mode-switching, and
 * drag-reordering animate smoothly across rows in one unified coordinate space.
 */
export function computeFlatGridLayout(
  items: readonly LibraryItem[],
  containerWidth: number,
  zoom: number,
  spacing: number,
  layoutMode: GridLayoutMode,
): { cards: PositionedGridCard[]; totalHeight: number } {
  if (items.length === 0 || containerWidth <= 0) {
    return { cards: [], totalHeight: 0 };
  }

  const cards: PositionedGridCard[] = [];

  if (layoutMode === "justified") {
    const targetRowHeight = Math.round(196 * zoom);
    const rows = computeJustifiedRows(items, containerWidth, targetRowHeight, spacing);
    let cursorY = 0;

    for (const row of rows) {
      let cursorX = 0;
      const rowHeight = Math.round(row.height);
      for (let i = 0; i < row.items.length; i++) {
        const entry = row.items[i]!;
        const isLastInFullRow =
          i === row.items.length - 1 &&
          cursorX + entry.width >= containerWidth - 6;
        const w = isLastInFullRow
          ? Math.max(60, Math.round(containerWidth - cursorX))
          : Math.round(entry.width);
        cards.push({
          item: entry.item,
          x: Math.round(cursorX),
          y: Math.round(cursorY),
          width: w,
          height: rowHeight,
        });
        cursorX += w + spacing;
      }
      cursorY += rowHeight + spacing;
    }

    return {
      cards,
      totalHeight: Math.max(0, cursorY - spacing),
    };
  }

  const idealTile = 190 * zoom;
  const cols = Math.max(2, Math.min(8, Math.round(containerWidth / idealTile)));
  const tileW = (containerWidth - spacing * (cols - 1)) / cols;
  const tileH = layoutMode === "square" ? tileW : tileW * 0.75;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    cards.push({
      item,
      x: Math.round(col * (tileW + spacing)),
      y: Math.round(row * (tileH + spacing)),
      width: Math.round(tileW),
      height: Math.round(tileH),
    });
  }

  const totalRows = Math.ceil(items.length / cols);
  return {
    cards,
    totalHeight: Math.max(0, Math.round(totalRows * tileH + Math.max(0, totalRows - 1) * spacing)),
  };
}

/**
 * Pure immutable drag-to-reorder helper: moves sourceId to targetId's slot.
 */
export function reorderItemsById<T extends { id: string }>(
  items: readonly T[],
  sourceId: string,
  targetId: string,
): T[] {
  if (sourceId === targetId) return [...items];
  const fromIdx = items.findIndex((it) => it.id === sourceId);
  const toIdx = items.findIndex((it) => it.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return [...items];
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  if (!moved) return [...items];
  next.splice(toIdx, 0, moved);
  return next;
}

export interface InfinityWallTile {
  key: string;
  item: LibraryItem;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes Atlas's tightly-packed infinite justified-row brickwork wall
 * (Video WgLLRuGigB9MVkJj 00:11–00:18) extending seamlessly in all directions.
 */
export function computeInfinityWallTiles(
  items: readonly LibraryItem[],
  viewportWidth: number,
  viewportHeight: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  spacing: number,
): InfinityWallTile[] {
  if (items.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return [];
  }

  const rowH = Math.max(110, Math.round(214 * zoom));
  const rowPitch = rowH + spacing;

  // Precompute natural aspect-preserving widths for one full item cycle
  const itemWidths = items.map((item) => {
    const rawAspect = item.height > 0 ? item.width / item.height : 1;
    const clampedAspect = Math.max(0.68, Math.min(1.75, rawAspect));
    return Math.round(rowH * clampedAspect);
  });

  const cycleWidth = itemWidths.reduce((sum, w) => sum + w + spacing, 0);
  if (cycleWidth <= 0) return [];

  const bufferY = rowPitch;
  const bufferX = Math.max(260, Math.round(rowH * 1.4));

  const startRow = Math.floor((-offsetY - bufferY) / rowPitch);
  const endRow = Math.ceil((viewportHeight - offsetY + bufferY) / rowPitch);

  const tiles: InfinityWallTile[] = [];

  for (let row = startRow; row <= endRow; row++) {
    // Deterministic row-dependent horizontal stagger + permutation offset so rows never line up
    const rowShift = (((row * 373) % cycleWidth) + cycleWidth) % cycleWidth;
    const itemStartOffset = (((row * 5) % items.length) + items.length) % items.length;

    const minWorldX = -offsetX - bufferX - rowShift;
    const maxWorldX = viewportWidth - offsetX + bufferX - rowShift;

    const startCycle = Math.floor(minWorldX / cycleWidth);
    const endCycle = Math.floor(maxWorldX / cycleWidth);
    const screenY = Math.round(row * rowPitch + offsetY);

    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      let localX = cycle * cycleWidth + rowShift;
      for (let i = 0; i < items.length; i++) {
        const idx = (i + itemStartOffset) % items.length;
        const item = items[idx]!;
        const w = itemWidths[idx]!;
        const screenX = Math.round(localX + offsetX);

        if (screenX + w >= -bufferX && screenX <= viewportWidth + bufferX) {
          tiles.push({
            key: `inf-${row}-${cycle}-${idx}`,
            item,
            x: screenX,
            y: screenY,
            width: w,
            height: rowH,
          });
        }
        localX += w + spacing;
      }
    }
  }

  return tiles;
}
