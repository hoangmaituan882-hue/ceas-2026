import type { LibraryItem } from "./library-engine";

export interface SimilarItemMatch {
  item: LibraryItem;
  score: number;
  sharedTags: string[];
  paletteScore: number;
  sameKind: boolean;
  sameCollection: boolean;
  /** Clamped height/width ratio used for balanced 2-column masonry placement. */
  heightRatio: number;
}

/**
 * Parses a 3-digit or 6-digit hex color into [r, g, b] in 0..255.
 */
export function parseHexRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    const g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    const b = parseInt(cleaned[2]! + cleaned[2]!, 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/**
 * Computes perceptual color similarity in [0, 1] between two RGB triples
 * using a redmean-weighted Euclidean distance metric.
 */
export function rgbPerceptualSimilarity(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const rMean = (a[0] + b[0]) * 0.5;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  const dist = Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db,
  );
  // Max redmean distance between #000000 and #ffffff is ~764.83
  return Math.max(0, Math.min(1, 1 - dist / 765));
}

/**
 * Symmetric palette similarity in [0, 1] between two lists of hex swatches.
 */
export function computePaletteSimilarity(
  paletteA: readonly string[],
  paletteB: readonly string[],
): number {
  const rgbA = paletteA
    .map(parseHexRgb)
    .filter((v): v is [number, number, number] => v !== null);
  const rgbB = paletteB
    .map(parseHexRgb)
    .filter((v): v is [number, number, number] => v !== null);
  if (rgbA.length === 0 || rgbB.length === 0) return 0;

  let sumA = 0;
  for (const ca of rgbA) {
    let best = 0;
    for (const cb of rgbB) {
      const sim = rgbPerceptualSimilarity(ca, cb);
      if (sim > best) best = sim;
    }
    sumA += best;
  }

  let sumB = 0;
  for (const cb of rgbB) {
    let best = 0;
    for (const ca of rgbA) {
      const sim = rgbPerceptualSimilarity(cb, ca);
      if (sim > best) best = sim;
    }
    sumB += best;
  }

  return (sumA / rgbA.length + sumB / rgbB.length) * 0.5;
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

/**
 * Computes a clamped aspect ratio (height / width) suitable for compact
 * 2-column inspector masonry cards so ultra-tall or ultra-wide items stay balanced.
 */
export function computeInspectorCardHeightRatio(item: LibraryItem): number {
  if (item.kind === "audio") return 0.92;
  if (item.kind === "font") return 1.05;
  if (item.kind === "model3d") return 1.0;
  const w = item.width > 0 ? item.width : 1200;
  const h = item.height > 0 ? item.height : 1200;
  const raw = h / w;
  return Math.max(0.66, Math.min(1.52, raw));
}

/**
 * Scores how visually & semantically similar `candidate` is to `source`.
 */
export function computeItemSimilarity(
  source: LibraryItem,
  candidate: LibraryItem,
): SimilarItemMatch {
  const srcTags = new Set(source.tags.map((t) => t.toLowerCase()));
  const sharedTags: string[] = [];
  for (const tag of candidate.tags) {
    if (srcTags.has(tag.toLowerCase())) {
      sharedTags.push(tag);
    }
  }

  const unionTagSize = new Set([
    ...source.tags.map((t) => t.toLowerCase()),
    ...candidate.tags.map((t) => t.toLowerCase()),
  ]).size;
  const tagJaccard = unionTagSize > 0 ? sharedTags.length / unionTagSize : 0;

  const paletteScore = computePaletteSimilarity(
    source.palette,
    candidate.palette,
  );
  const sameKind = source.kind === candidate.kind;
  const sameCollection =
    Boolean(source.collectionId) &&
    source.collectionId === candidate.collectionId;

  const srcTokens = tokenize(`${source.title} ${source.note}`);
  const candTokens = tokenize(`${candidate.title} ${candidate.note}`);
  let tokenMatches = 0;
  for (const t of srcTokens) {
    if (candTokens.has(t)) tokenMatches += 1;
  }
  const tokenOverlap =
    srcTokens.size > 0 ? Math.min(1, tokenMatches / Math.max(2, srcTokens.size)) : 0;

  const srcRatio = computeInspectorCardHeightRatio(source);
  const candRatio = computeInspectorCardHeightRatio(candidate);
  const ratioProximity = Math.max(
    0,
    1 - Math.abs(Math.log(candRatio / srcRatio)) / 1.1,
  );

  // Weighted composite score in [0, 1]
  const score =
    paletteScore * 0.34 +
    tagJaccard * 0.28 +
    (sameCollection ? 0.16 : 0) +
    (sameKind ? 0.12 : 0) +
    tokenOverlap * 0.06 +
    ratioProximity * 0.04;

  return {
    item: candidate,
    score: Math.round(score * 1000) / 1000,
    sharedTags,
    paletteScore: Math.round(paletteScore * 100) / 100,
    sameKind,
    sameCollection,
    heightRatio: candRatio,
  };
}

/**
 * Ranks visually and semantically similar library items for the QuickLook
 * Inspector "Similar" tab. Excludes trashed items and the source item itself.
 */
export function rankSimilarItems(
  source: LibraryItem,
  pool: readonly LibraryItem[],
  limit = 12,
): SimilarItemMatch[] {
  const scored: SimilarItemMatch[] = [];
  for (const candidate of pool) {
    if (candidate.id === source.id) continue;
    if (candidate.trashed) continue;
    scored.push(computeItemSimilarity(source, candidate));
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.title.localeCompare(b.item.title);
  });

  return scored.slice(0, Math.max(0, limit));
}

/**
 * Distributes similar matches into 2 visually balanced masonry columns by
 * always placing the next highest-ranked item into the currently shorter column.
 */
export function distributeSimilarMasonry(
  matches: readonly SimilarItemMatch[],
): [SimilarItemMatch[], SimilarItemMatch[]] {
  const left: SimilarItemMatch[] = [];
  const right: SimilarItemMatch[] = [];
  let leftH = 0;
  let rightH = 0;
  const cardGapWeight = 0.08;

  for (const match of matches) {
    if (leftH <= rightH) {
      left.push(match);
      leftH += match.heightRatio + cardGapWeight;
    } else {
      right.push(match);
      rightH += match.heightRatio + cardGapWeight;
    }
  }

  return [left, right];
}

function toTitleCase(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Generates deterministic, curated title refinements for the Inspector magic-wand
 * button based on the item's tags, media kind, and filename.
 */
export function generateSmartTitleSuggestion(
  item: LibraryItem,
  locale: "en" | "zh-CN",
  cycleIndex: number,
): string {
  const primaryTag = item.tags[0];
  const secondaryTag = item.tags[1];
  const cleanFile = toTitleCase(item.filename);

  const kindSuffixEn: Record<LibraryItem["kind"], string> = {
    image: "Visual Study",
    video: "Motion Clip",
    audio: "Soundscape",
    model3d: "3D Object",
    font: "Type Specimen",
    gif: "Motion Loop",
    link: "Web Reference",
  };

  const kindSuffixZh: Record<LibraryItem["kind"], string> = {
    image: "视觉参考",
    video: "动态影像",
    audio: "声景片段",
    model3d: "三维模型",
    font: "字体样本",
    gif: "循环动效",
    link: "网页灵感",
  };

  const candidates: string[] = [];
  if (locale === "zh-CN") {
    if (primaryTag && secondaryTag) {
      candidates.push(`${item.title} · ${primaryTag}`);
      candidates.push(`${toTitleCase(primaryTag)} / ${toTitleCase(secondaryTag)} ${kindSuffixZh[item.kind]}`);
    } else if (primaryTag) {
      candidates.push(`${item.title} · ${primaryTag}`);
    }
    candidates.push(`${cleanFile} · ${kindSuffixZh[item.kind]}`);
    candidates.push(cleanFile);
  } else {
    if (primaryTag && secondaryTag) {
      candidates.push(`${toTitleCase(primaryTag)} ${toTitleCase(secondaryTag)} ${kindSuffixEn[item.kind]}`);
    } else if (primaryTag) {
      candidates.push(`${cleanFile} · ${toTitleCase(primaryTag)}`);
    }
    candidates.push(`${cleanFile} — ${kindSuffixEn[item.kind]}`);
    candidates.push(cleanFile);
  }

  const deduped = Array.from(
    new Set(candidates.map((c) => c.trim()).filter(Boolean)),
  );
  if (deduped.length === 0) return item.title;

  const idx = ((cycleIndex % deduped.length) + deduped.length) % deduped.length;
  const pick = deduped[idx]!;
  if (pick === item.title && deduped.length > 1) {
    return deduped[(idx + 1) % deduped.length]!;
  }
  return pick;
}
