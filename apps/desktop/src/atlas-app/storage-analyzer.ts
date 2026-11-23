import type { AppLocale } from "./i18n";
import type { LibraryItem } from "./library-engine";

export type StorageCategoryId =
  | "apps"
  | "developer"
  | "photos"
  | "movies"
  | "models3d"
  | "audio"
  | "fonts"
  | "gifs"
  | "documents"
  | "system"
  | "caches"
  | "trash";

export interface StorageSegment {
  id: StorageCategoryId;
  color: string;
  rgb: readonly [number, number, number];
  gb: number;
  itemCount: number;
  label: string;
  detail: string;
  samplePath: string;
  clearable?: boolean;
}

export interface StorageSnapshot {
  totalCapacityGb: number;
  usedGb: number;
  availableGb: number;
  segments: StorageSegment[];
  atlasLibraryGb: number;
  atlasItemCount: number;
}

export interface ColumnRange {
  id: StorageCategoryId;
  color: string;
  rgb: readonly [number, number, number];
  startCol: number;
  endCol: number; // exclusive
  gb: number;
}

export interface StorageCategorySpec {
  id: StorageCategoryId;
  color: string;
  rgb: readonly [number, number, number];
  baseGb: number;
  samplePath: string;
  clearable?: boolean;
}

export const STORAGE_CATEGORY_SPECS: readonly StorageCategorySpec[] = [
  {
    id: "apps",
    color: "#3b82f6",
    rgb: [59, 130, 246],
    baseGb: 68.4,
    samplePath: "/Applications/Xcode.app",
  },
  {
    id: "developer",
    color: "#16a34a",
    rgb: [22, 163, 74],
    baseGb: 52.6,
    samplePath: "~/Library/Developer/CoreSimulator/Devices",
  },
  {
    id: "photos",
    color: "#ec4899",
    rgb: [236, 72, 153],
    baseGb: 38.2,
    samplePath: "~/Pictures/Atlas Library.atlas/Originals",
  },
  {
    id: "movies",
    color: "#9333ea",
    rgb: [147, 51, 234],
    baseGb: 34.5,
    samplePath: "~/Movies/ProRes Exports",
  },
  {
    id: "models3d",
    color: "#0891b2",
    rgb: [8, 145, 178],
    baseGb: 18.6,
    samplePath: "~/Atlas Library/Models3D/StudioMeshes.glb",
  },
  {
    id: "audio",
    color: "#e11d48",
    rgb: [225, 29, 72],
    baseGb: 16.4,
    samplePath: "~/Atlas Library/Audio/Lossless Stems",
  },
  {
    id: "fonts",
    color: "#4f46e5",
    rgb: [79, 70, 229],
    baseGb: 6.8,
    samplePath: "~/Library/Fonts/Atlas Variable Foundry",
  },
  {
    id: "gifs",
    color: "#0284c7",
    rgb: [2, 132, 199],
    baseGb: 9.2,
    samplePath: "~/Atlas Library/Motion/GIF Loops",
  },
  {
    id: "documents",
    color: "#0d9488",
    rgb: [13, 148, 136],
    baseGb: 26.8,
    samplePath: "~/Documents/Design Systems & Specs",
  },
  {
    id: "system",
    color: "#64748b",
    rgb: [100, 116, 139],
    baseGb: 54.2,
    samplePath: "/System/Volumes/Data/Library",
  },
  {
    id: "caches",
    color: "#ea580c",
    rgb: [234, 88, 12],
    baseGb: 22.8,
    samplePath: "~/Library/Caches/com.atlas.studio",
    clearable: true,
  },
  {
    id: "trash",
    color: "#dc2626",
    rgb: [220, 38, 38],
    baseGb: 9.4,
    samplePath: "~/.Trash/Exported Renders",
    clearable: true,
  },
];

export const SCAN_DIRECTORY_STEPS: readonly string[] = [
  "/Applications/Atlas Studio.app",
  "~/Library/Developer/CoreSimulator/Devices",
  "~/Pictures/Atlas Library.atlas/Originals",
  "~/Movies/Spatial Reel Exports",
  "~/Atlas Library/Models3D/Meshes",
  "~/Atlas Library/Audio/Lossless",
  "~/Library/Fonts/Editorial Foundry",
  "~/Atlas Library/Motion/GIF Loops",
  "~/Documents/Product Architecture",
  "/System/Volumes/Data/VM",
  "~/Library/Caches/com.atlas.thumbnails",
  "~/.Trash",
];

export function formatGb(gb: number): string {
  const safe = Number.isFinite(gb) ? Math.max(0, gb) : 0;
  return `${safe.toFixed(1)} GB`;
}

export function formatBrowserQuota(usageBytes: number, quotaBytes: number): string {
  const usageMb = Math.max(0.1, usageBytes / (1024 * 1024));
  const quotaGb = Math.max(1, quotaBytes / (1024 * 1024 * 1024));
  const usageStr =
    usageMb >= 1024
      ? `${(usageMb / 1024).toFixed(2)} GB`
      : `${usageMb.toFixed(1)} MB`;
  return `${usageStr} / ${quotaGb.toFixed(0)} GB`;
}

function sampleTitles(items: readonly LibraryItem[], limit = 1): string {
  return items
    .slice(0, limit)
    .map((item) => item.title)
    .join("、");
}

function sampleTitlesEn(items: readonly LibraryItem[], limit = 1): string {
  return items
    .slice(0, limit)
    .map((item) => item.title)
    .join(", ");
}

export interface BuildDiskModelOptions {
  totalCapacityGb?: number;
  cachesCleared?: boolean;
  trashEmptied?: boolean;
  locale: AppLocale;
}

export function buildDiskStorageModel(
  items: readonly LibraryItem[],
  options: BuildDiskModelOptions,
): StorageSnapshot {
  const totalCapacityGb = options.totalCapacityGb ?? 512;
  const isZh = options.locale === "zh-CN";

  const activeItems = items.filter((it) => !it.trashed);
  const trashedItems = items.filter((it) => it.trashed);

  const photosItems = activeItems.filter(
    (it) => it.kind === "image" || it.kind === "link",
  );
  const moviesItems = activeItems.filter((it) => it.kind === "video");
  const modelsItems = activeItems.filter((it) => it.kind === "model3d");
  const audioItems = activeItems.filter((it) => it.kind === "audio");
  const fontsItems = activeItems.filter((it) => it.kind === "font");
  const gifsItems = activeItems.filter((it) => it.kind === "gif");

  const round1 = (val: number) => Math.round(val * 10) / 10;

  // Dynamic Atlas library contributions layered cleanly onto realistic local volume usage
  const photosDelta = photosItems.length * 0.14;
  const moviesDelta = moviesItems.length * 0.95;
  const modelsDelta = modelsItems.length * 0.85;
  const audioDelta = audioItems.length * 0.42;
  const fontsDelta = fontsItems.length * 0.18;
  const gifsDelta = gifsItems.length * 0.25;
  const trashDelta = trashedItems.length * 0.45;

  const atlasLibraryGb = round1(
    photosDelta + moviesDelta + modelsDelta + audioDelta + fontsDelta + gifsDelta,
  );

  const labelMap: Record<StorageCategoryId, string> = isZh
    ? {
        apps: "应用程序",
        developer: "代码和工具链",
        photos: "照片",
        movies: "电影",
        models3d: "3D 模型",
        audio: "音乐与音频",
        fonts: "字体",
        gifs: "GIF 动图",
        documents: "文档",
        system: "系统数据",
        caches: "缓存",
        trash: "废纸篓",
      }
    : {
        apps: "Apps",
        developer: "Developer",
        photos: "Photos",
        movies: "Movies",
        models3d: "3D Models",
        audio: "Audio & Music",
        fonts: "Fonts",
        gifs: "GIFs",
        documents: "Documents",
        system: "System data",
        caches: "Caches",
        trash: "Trash",
      };

  const detailMap: Record<StorageCategoryId, string> = isZh
    ? {
        apps: "Xcode、Blender、Figma、Atlas Studio 及本地应用包",
        developer: "Node/Rust 工具链、Docker 镜像与模拟器运行环境",
        photos:
          photosItems.length > 0
            ? `含资料库 ${photosItems.length} 份高清视觉参考与 RAW 原图`
            : "系统图库与高分辨率视觉参考原图",
        movies:
          moviesItems.length > 0
            ? `含资料库 ${moviesItems.length} 段高清影片与 ProRes 导出`
            : "本地影片素材、录屏与 ProRes 导出文件",
        models3d:
          modelsItems.length > 0
            ? `资料库 ${modelsItems.length} 组 PBR 模型（${sampleTitles(modelsItems)} 等）`
            : "GLB / OBJ 3D 网格资产与 HDRI 光照贴图",
        audio:
          audioItems.length > 0
            ? `资料库 ${audioItems.length} 份无损音轨（${sampleTitles(audioItems)} 等）`
            : "无损音频分轨、音效采样与离线曲库",
        fonts:
          fontsItems.length > 0
            ? `含 ${fontsItems.length} 套可变字体族（${sampleTitles(fontsItems)} 等）`
            : "OTF / WOFF2 商业字体族与系统字库",
        gifs:
          gifsItems.length > 0
            ? `资料库 ${gifsItems.length} 组高帧率循环动图与微交互参考`
            : "高帧率 GIF 动图与界面微交互序列帧",
        documents: "PDF 规范文档、设计提案与本地项目归档",
        system: "macOS 系统快照、Spotlight 索引与系统支持数据",
        caches: "缩略图金字塔、着色器缓存与临时数据，可安全清理",
        trash:
          trashedItems.length > 0
            ? `含资料库已删除的 ${trashedItems.length} 项素材与废纸篓文件`
            : "已删除的渲染归档与临时大文件，清倒后可立即释放",
      }
    : {
        apps: "Xcode, Blender, Figma, Atlas Studio & local bundles",
        developer: "Toolchains, simulators, Docker layers & local builds",
        photos:
          photosItems.length > 0
            ? `${photosItems.length} hi-res Atlas references + Photos originals`
            : "Photos library originals and RAW image references",
        movies:
          moviesItems.length > 0
            ? `${moviesItems.length} Atlas clips plus ProRes exports & recordings`
            : "Local video reels, ProRes renders & recordings",
        models3d:
          modelsItems.length > 0
            ? `${modelsItems.length} PBR meshes (${sampleTitlesEn(modelsItems)}, …) + HDRI`
            : "GLB / OBJ meshes, material libraries & HDRI maps",
        audio:
          audioItems.length > 0
            ? `${audioItems.length} lossless tracks (${sampleTitlesEn(audioItems)}, …) + Music`
            : "Lossless audio stems, synth samples & offline music",
        fonts:
          fontsItems.length > 0
            ? `${fontsItems.length} foundry specimens (${sampleTitlesEn(fontsItems)}, …) + system fonts`
            : "OTF / WOFF2 type families and variable font collections",
        gifs:
          gifsItems.length > 0
            ? `${gifsItems.length} looping motion studies & UI captures`
            : "High-framerate GIF loops and motion reference frames",
        documents: "Design specs, PDF archives & project notes",
        system: "macOS APFS snapshots, Spotlight indexes & system files",
        caches: "Thumbnail pyramids & shader caches. Safe to clear.",
        trash:
          trashedItems.length > 0
            ? `${trashedItems.length} deleted Atlas items + trashed archives`
            : "Previously deleted exports ready to reclaim",
      };

  const countMap: Record<StorageCategoryId, number> = {
    apps: 42,
    developer: 18,
    photos: photosItems.length,
    movies: moviesItems.length,
    models3d: modelsItems.length,
    audio: audioItems.length,
    fonts: fontsItems.length,
    gifs: gifsItems.length,
    documents: 136,
    system: 1,
    caches: options.cachesCleared ? 0 : 12,
    trash: options.trashEmptied ? 0 : Math.max(1, trashedItems.length),
  };

  const gbMap: Record<StorageCategoryId, number> = {
    apps: 68.4,
    developer: 52.6,
    photos: round1(38.2 + photosDelta),
    movies: round1(34.5 + moviesDelta),
    models3d: round1(18.6 + modelsDelta),
    audio: round1(16.4 + audioDelta),
    fonts: round1(6.8 + fontsDelta),
    gifs: round1(9.2 + gifsDelta),
    documents: 26.8,
    system: 54.2,
    caches: options.cachesCleared ? 0 : 22.8,
    trash: options.trashEmptied ? 0 : round1(9.4 + trashDelta),
  };

  const segments: StorageSegment[] = STORAGE_CATEGORY_SPECS.map((spec) => ({
    id: spec.id,
    color: spec.color,
    rgb: spec.rgb,
    gb: gbMap[spec.id],
    itemCount: countMap[spec.id],
    label: labelMap[spec.id],
    detail: detailMap[spec.id],
    samplePath: spec.samplePath,
    clearable: spec.clearable,
  }));

  const usedGb = round1(
    Math.min(
      totalCapacityGb,
      segments.reduce((sum, seg) => sum + seg.gb, 0),
    ),
  );
  const availableGb = round1(Math.max(0, totalCapacityGb - usedGb));

  return {
    totalCapacityGb,
    usedGb,
    availableGb,
    segments,
    atlasLibraryGb,
    atlasItemCount: activeItems.length,
  };
}

/**
 * Allocates contiguous, non-overlapping integer column bands across a fixed-width
 * dot-matrix canvas (`totalCols`) proportional to each category's GB.
 */
export function computeMatrixColumnLayout(
  segments: readonly Pick<StorageSegment, "id" | "color" | "rgb" | "gb">[],
  totalCapacityGb: number,
  totalCols: number,
): ColumnRange[] {
  if (totalCapacityGb <= 0 || totalCols <= 0) return [];

  const nonZero = segments.filter((seg) => seg.gb > 0.05);
  if (nonZero.length === 0) return [];

  const usedGb = nonZero.reduce((sum, s) => sum + s.gb, 0);
  const targetUsedCols = Math.min(
    totalCols,
    Math.max(nonZero.length, Math.round((usedGb / totalCapacityGb) * totalCols)),
  );

  // Start with proportional widths, guaranteeing at least 1 visible column per active segment
  const rawWidths = nonZero.map((seg) => (seg.gb / usedGb) * targetUsedCols);
  const widths = rawWidths.map((w) => Math.max(1, Math.floor(w)));
  let assigned = widths.reduce((sum, w) => sum + w, 0);

  // Distribute remaining fractional columns by largest remainder
  if (assigned < targetUsedCols) {
    const order = rawWidths
      .map((w, idx) => ({ idx, frac: w - Math.floor(w) }))
      .sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (assigned < targetUsedCols && order.length > 0) {
      const target = order[cursor % order.length]!;
      widths[target.idx] = (widths[target.idx] ?? 1) + 1;
      assigned += 1;
      cursor += 1;
    }
  } else if (assigned > targetUsedCols) {
    // Trim from widest columns first if minimum-1 clamping overshot
    while (assigned > targetUsedCols) {
      let widestIdx = -1;
      let widestVal = 1;
      for (let i = 0; i < widths.length; i += 1) {
        if ((widths[i] ?? 0) > widestVal) {
          widestVal = widths[i] ?? 0;
          widestIdx = i;
        }
      }
      if (widestIdx < 0) break;
      widths[widestIdx] = (widths[widestIdx] ?? 2) - 1;
      assigned -= 1;
    }
  }

  const ranges: ColumnRange[] = [];
  let colCursor = 0;
  for (let i = 0; i < nonZero.length; i += 1) {
    const seg = nonZero[i]!;
    const width = widths[i] ?? 0;
    if (width <= 0 || colCursor >= totalCols) continue;
    const endCol = Math.min(totalCols, colCursor + width);
    ranges.push({
      id: seg.id,
      color: seg.color,
      rgb: seg.rgb,
      startCol: colCursor,
      endCol,
      gb: seg.gb,
    });
    colCursor = endCol;
  }

  return ranges;
}

export function hitTestMatrixColumn(
  col: number,
  ranges: readonly ColumnRange[],
): StorageCategoryId | null {
  if (!Number.isFinite(col) || col < 0) return null;
  for (const r of ranges) {
    if (col >= r.startCol && col < r.endCol) return r.id;
  }
  return null;
}

export function hashPixelCell(col: number, row: number, salt = 0): number {
  const h =
    Math.imul((col + 17) * 73856093 ^ (row + 31) * 19349663 ^ (salt + 7) * 83492791, 2654435761) >>>
    0;
  return (h % 10000) / 10000;
}

/**
 * Smoothly advances per-segment hover focus values (0..1) so switching between
 * segments creates a lush, organic pixel-cascade transition instead of an abrupt snap.
 */
export function stepSegmentFocusMap(
  current: Readonly<Record<StorageCategoryId, number>>,
  targetId: StorageCategoryId | null,
  dtSec: number,
): { next: Record<StorageCategoryId, number>; settled: boolean } {
  const safeDt = Math.min(0.06, Math.max(0.001, dtSec));
  const riseSpeed = 7.4; // snappy ~180ms entry
  const fallSpeed = 5.2; // gentle ~260ms pixel decay
  const next = { ...current };
  let settled = true;

  for (const spec of STORAGE_CATEGORY_SPECS) {
    const id = spec.id;
    const prev = current[id] ?? 0;
    const target = id === targetId ? 1 : 0;
    const diff = target - prev;
    if (Math.abs(diff) < 0.008) {
      next[id] = target;
    } else {
      const rate = diff > 0 ? riseSpeed : fallSpeed;
      const factor = 1 - Math.exp(-rate * safeDt);
      const val = Math.min(1, Math.max(0, prev + diff * factor));
      next[id] = Math.abs(target - val) < 0.008 ? target : val;
      if (next[id] !== target) settled = false;
    }
  }

  return { next, settled };
}

export interface PixelCellRenderState {
  /** Normalized intensity 0..1 controlling fill alpha & vividness */
  intensity: number;
  /** True when the cell is a bright "active data" pixel rather than soft matrix backdrop */
  isActivePixel: boolean;
  /** Wavefront spark intensity 0..1 for brief crisp pixel flip glint during hover sweep */
  spark: number;
}

/**
 * Computes the crisp pixelated visual state for a single (col, row) square inside
 * a category segment:
 * - Resting state: distinct stippled pixel grid with scattered high-contrast data pixels
 *   and solid/alternating top & bottom pixel rails (matching the reference Light design).
 * - Hovered state (focus -> 1): pixel wave cascades outward from `waveOriginCol`, flipping
 *   into a dense, vibrant checkerboard pixel field with lively micro-shimmer.
 */
export function computePixelCellState(params: {
  col: number;
  row: number;
  totalRows: number;
  startCol: number;
  endCol: number;
  focus: number;
  waveProgress: number; // 0..1 sweep wave across segment
  waveOriginCol: number;
  cursorCol: number | null;
  shimmerTick: number;
}): PixelCellRenderState {
  const {
    col,
    row,
    totalRows,
    startCol,
    endCol,
    focus,
    waveProgress,
    waveOriginCol,
    cursorCol,
    shimmerTick,
  } = params;

  const isTopRail = row === 0;
  const isBottomRail = row === totalRows - 1;
  const isRail = isTopRail || isBottomRail;
  const baseNoise = hashPixelCell(col, row, 1);
  const clusterNoise = hashPixelCell(Math.floor(col / 2), Math.floor(row / 2), 3);

  // Staggered per-pixel activation threshold driven by distance from waveOriginCol
  const segSpan = Math.max(1, endCol - startCol);
  const distNorm = Math.min(1, Math.abs(col - waveOriginCol) / segSpan);
  const cellDelay = distNorm * 0.58 + baseNoise * 0.28;
  const waveRaw = (waveProgress * 1.32 - cellDelay) / 0.32;
  const waveGate = Math.min(1, Math.max(0, waveRaw));

  // Effective activation merges smooth focus and directional pixel wave
  const activeMix = Math.min(1, focus * (0.32 + 0.68 * waveGate));

  // Crisp 1-beat digital spark right along the sweeping activation wavefront
  const spark =
    focus > 0.15 && waveRaw > 0.05 && waveRaw < 0.85
      ? Math.sin(waveRaw * Math.PI) * focus
      : 0;

  // Top & bottom edge rails: alternating crisp pixel rhythm when resting, dense solid when hovered
  if (isRail) {
    const checker = (col + (isBottomRail ? 1 : 0)) % 2 === 0;
    const restActive = checker || baseNoise > 0.72;
    const hoverActive = checker || activeMix > 0.45;
    return {
      intensity: restActive
        ? 0.78 + activeMix * 0.22
        : 0.34 + activeMix * 0.62,
      isActivePixel: activeMix > 0.35 ? hoverActive : restActive,
      spark: spark * 0.7,
    };
  }

  // Interior pixels:
  // Resting pattern: organic scattered data pixels (weighted subtly toward bottom/top like real disk blocks)
  const edgeBias =
    row === 1 || row === totalRows - 2
      ? 0.12
      : row >= totalRows - 4
        ? 0.08
        : 0;
  const isRestingDataPixel = baseNoise + clusterNoise * 0.25 + edgeBias > 0.96;

  // Hovered lively checkerboard + cursor-proximity organic pixel dance
  const isCheckerOn = (col + row) % 2 === 0;
  const twinkleHash = hashPixelCell(col, row, shimmerTick);
  const cursorBoost =
    cursorCol !== null
      ? Math.max(0, 1 - Math.abs(col - cursorCol) / 3.5) * 0.26
      : 0;

  const isHoveredDensePixel =
    isCheckerOn
      ? baseNoise > 0.14 || twinkleHash > 0.72
      : baseNoise + cursorBoost > 0.76 || twinkleHash > 0.91;

  if (activeMix > 0.38) {
    if (isHoveredDensePixel) {
      const livelyLift = twinkleHash > 0.84 ? 0.14 : 0;
      return {
        intensity: Math.min(1, 0.76 + activeMix * 0.22 + cursorBoost * 0.3 + livelyLift),
        isActivePixel: true,
        spark,
      };
    }
    return {
      intensity: 0.24 + activeMix * 0.16 + cursorBoost * 0.25,
      isActivePixel: false,
      spark: spark * 0.5,
    };
  }

  if (isRestingDataPixel) {
    return {
      intensity: 0.62 + activeMix * 0.32,
      isActivePixel: true,
      spark,
    };
  }

  return {
    intensity: 0.18 + baseNoise * 0.09 + activeMix * 0.15,
    isActivePixel: false,
    spark: spark * 0.4,
  };
}

