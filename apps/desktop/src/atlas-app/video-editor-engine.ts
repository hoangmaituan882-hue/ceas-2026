import type { LibraryItem } from "./library-engine";
import { parseDurationToSeconds } from "./atomic-dom-move";
import { generateDeterministicWaveform } from "./media-helpers";

export type VideoAspectRatio = "original" | "16:9" | "4:3" | "1:1" | "9:16";

export type VideoKeyframeTrack =
  | "positionX"
  | "positionY"
  | "opacity"
  | "rotation";

export interface VideoKeyframe {
  id: string;
  /** Local time in seconds relative to the clip's own timeline start. */
  timeSec: number;
  value: number;
}

export interface VideoColorGrade {
  /** -50 to +50 (0 = neutral) */
  brightness: number;
  /** -50 to +50 (0 = neutral) */
  contrast: number;
  /** 0 to 24 px (0 = sharp) */
  blur: number;
  /** -100 to +100 (0 = neutral) */
  saturation: number;
  /** -50 to +50 (0 = neutral) */
  exposure: number;
  /** -50 to +50 (0 = neutral) */
  warmth: number;
  autoBrightness: boolean;
  upscale: boolean;
  enabled: boolean;
  locked: boolean;
}

export interface VideoFrameTransform {
  aspectRatio: VideoAspectRatio;
  rotationDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
}

export interface VideoTimelineClip {
  id: string;
  sourceItemId: string;
  title: string;
  filename: string;
  posterSrc: string;
  sourceDurationSec: number;
  inSec: number;
  outSec: number;
  speed: number;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  volume: number;
  keyframes: Record<VideoKeyframeTrack, VideoKeyframe[]>;
}

export interface VideoAudioTrackClip {
  id: string;
  label: string;
  startSec: number;
  durationSec: number;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  volume: number;
  peaks: number[];
}

export interface VideoScriptMarker {
  id: string;
  timeSec: number;
  label: string;
  note: string;
}

export type VideoEasingPresetId =
  | "linear"
  | "ease-out"
  | "ease-in-out"
  | "expo-out"
  | "overshoot"
  | "custom";

export type CubicBezierCurve = [number, number, number, number];

export interface VideoEasingSpec {
  preset: VideoEasingPresetId;
  bezier: CubicBezierCurve;
}

export type VideoMotionPresetId =
  | "ken-burns"
  | "cinematic-reveal"
  | "micro-zoom"
  | "gentle-tilt"
  | "fade-pulse"
  | "clear";

export type VideoTimecodeMode = "timecode" | "frames" | "seconds";

export interface VideoEditRecipe {
  version: 1;
  clips: VideoTimelineClip[];
  audioTrack: VideoAudioTrackClip;
  sfxTracks?: VideoAudioTrackClip[];
  easing?: VideoEasingSpec;
  grade: VideoColorGrade;
  transform: VideoFrameTransform;
  markers: VideoScriptMarker[];
  workArea: {
    startSec: number;
    endSec: number;
  };
  updatedAt: number;
}

export interface EvaluatedClipTransform {
  positionX: number;
  positionY: number;
  opacity: number;
  rotation: number;
}

export interface ActiveClipResolution {
  clip: VideoTimelineClip;
  clipIndex: number;
  clipTimelineStartSec: number;
  clipTimelineDurationSec: number;
  localTimeSec: number;
  sourceTimeSec: number;
}

export const MIN_CLIP_DURATION_SEC = 0.5;
export const KEYFRAME_TRACKS: readonly VideoKeyframeTrack[] = [
  "positionX",
  "positionY",
  "opacity",
  "rotation",
] as const;

export const KEYFRAME_DEFAULTS: Record<VideoKeyframeTrack, number> = {
  positionX: 0,
  positionY: 0,
  opacity: 100,
  rotation: 0,
};

export const KEYFRAME_BOUNDS: Record<
  VideoKeyframeTrack,
  { min: number; max: number; unit: string }
> = {
  positionX: { min: -160, max: 160, unit: "px" },
  positionY: { min: -120, max: 120, unit: "px" },
  opacity: { min: 0, max: 100, unit: "%" },
  rotation: { min: -180, max: 180, unit: "°" },
};

export const EASING_PRESETS: Record<
  Exclude<VideoEasingPresetId, "custom">,
  CubicBezierCurve
> = {
  linear: [0, 0, 1, 1],
  "ease-out": [0.22, 1, 0.36, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  "expo-out": [0.16, 1, 0.3, 1],
  overshoot: [0.34, 1.36, 0.64, 1],
};

export const DEFAULT_EASING_SPEC: VideoEasingSpec = {
  preset: "ease-in-out",
  bezier: EASING_PRESETS["ease-in-out"],
};

const roundMs = (sec: number) => Math.round(sec * 1000) / 1000;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function createNeutralColorGrade(): VideoColorGrade {
  return {
    brightness: 0,
    contrast: 0,
    blur: 0,
    saturation: 0,
    exposure: 0,
    warmth: 0,
    autoBrightness: false,
    upscale: false,
    enabled: true,
    locked: false,
  };
}

export function createDefaultKeyframes(
  clipId: string,
  durationSec: number,
): Record<VideoKeyframeTrack, VideoKeyframe[]> {
  const safeDur = Math.max(MIN_CLIP_DURATION_SEC, durationSec);
  const t1 = roundMs(safeDur * 0.25);
  const t2 = roundMs(safeDur * 0.72);
  return {
    positionX: [
      { id: `${clipId}-px-0`, timeSec: 0, value: 0 },
      { id: `${clipId}-px-1`, timeSec: t2, value: 0 },
    ],
    positionY: [
      { id: `${clipId}-py-0`, timeSec: 0, value: 0 },
      { id: `${clipId}-py-1`, timeSec: t1, value: 0 },
    ],
    opacity: [
      { id: `${clipId}-op-0`, timeSec: 0, value: 100 },
      { id: `${clipId}-op-1`, timeSec: roundMs(safeDur * 0.85), value: 100 },
    ],
    rotation: [
      { id: `${clipId}-rt-0`, timeSec: 0, value: 0 },
      { id: `${clipId}-rt-1`, timeSec: t2, value: 0 },
    ],
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 17;
}

export function getClipEffectiveDuration(clip: VideoTimelineClip): number {
  const raw = Math.max(MIN_CLIP_DURATION_SEC, clip.outSec - clip.inSec);
  const safeSpeed = clampNumber(clip.speed, 0.25, 4);
  return roundMs(Math.max(MIN_CLIP_DURATION_SEC, raw / safeSpeed));
}

export function computeTimelineTotalDuration(recipe: VideoEditRecipe): number {
  if (recipe.clips.length === 0) return MIN_CLIP_DURATION_SEC;
  const total = recipe.clips.reduce(
    (sum, clip) => sum + getClipEffectiveDuration(clip),
    0,
  );
  return roundMs(Math.max(MIN_CLIP_DURATION_SEC, total));
}

export function createDefaultVideoEditRecipe(item: LibraryItem): VideoEditRecipe {
  const durationSec = Math.max(4, parseDurationToSeconds(item.duration));
  const clipId = `clip-${item.id}-main`;
  const audioLabel = `${item.filename.replace(/\.[^.]+$/, "")}_mix.wav`;
  return {
    version: 1,
    clips: [
      {
        id: clipId,
        sourceItemId: item.id,
        title: item.title,
        filename: item.filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".mp4"),
        posterSrc: item.src,
        sourceDurationSec: durationSec,
        inSec: 0,
        outSec: durationSec,
        speed: 1,
        muted: false,
        hidden: false,
        locked: false,
        volume: 0.85,
        keyframes: createDefaultKeyframes(clipId, durationSec),
      },
    ],
    audioTrack: {
      id: `audio-${item.id}`,
      label: audioLabel,
      startSec: 0,
      durationSec: roundMs(Math.min(durationSec, Math.max(3.6, durationSec * 0.42))),
      muted: false,
      hidden: false,
      locked: false,
      volume: 0.8,
      peaks: generateDeterministicWaveform(hashSeed(item.id), 88),
    },
    sfxTracks: [
      {
        id: `sfx-${item.id}-foley`,
        label: "Ambient Foley",
        startSec: roundMs(durationSec * 0.12),
        durationSec: roundMs(Math.min(durationSec * 0.28, 3.2)),
        muted: false,
        hidden: true,
        locked: false,
        volume: 0.65,
        peaks: generateDeterministicWaveform(hashSeed(`${item.id}-sfx`), 56),
      },
    ],
    easing: { ...DEFAULT_EASING_SPEC },
    grade: createNeutralColorGrade(),
    transform: {
      aspectRatio: "original",
      rotationDeg: 0,
      flipH: false,
    },
    markers: [
      {
        id: `mk-${item.id}-1`,
        timeSec: roundMs(durationSec * 0.14),
        label: "Opening Beat",
        note: "Establish framing and ambient lighting",
      },
      {
        id: `mk-${item.id}-2`,
        timeSec: roundMs(durationSec * 0.56),
        label: "Hero Transition",
        note: "Key motion beat and color lift",
      },
    ],
    workArea: {
      startSec: 0,
      endSec: durationSec,
    },
    updatedAt: 0,
  };
}

export function hasNonDestructiveEdits(
  recipe: VideoEditRecipe | undefined,
  item: LibraryItem,
): boolean {
  if (!recipe) return false;
  const g = recipe.grade;
  const hasGrade =
    g.brightness !== 0 ||
    g.contrast !== 0 ||
    g.blur !== 0 ||
    g.saturation !== 0 ||
    g.exposure !== 0 ||
    g.warmth !== 0 ||
    g.autoBrightness ||
    g.upscale ||
    !g.enabled;
  if (hasGrade) return true;

  const t = recipe.transform;
  if (t.aspectRatio !== "original" || t.rotationDeg !== 0 || t.flipH) return true;

  if (recipe.clips.length !== 1) return true;
  const main = recipe.clips[0];
  if (!main) return false;
  const origDur = Math.max(4, parseDurationToSeconds(item.duration));
  if (
    Math.abs(main.inSec) > 0.05 ||
    Math.abs(main.outSec - origDur) > 0.05 ||
    main.speed !== 1 ||
    main.muted ||
    main.hidden
  ) {
    return true;
  }
  if (recipe.audioTrack.muted || recipe.audioTrack.hidden) return true;

  for (const track of KEYFRAME_TRACKS) {
    const def = KEYFRAME_DEFAULTS[track];
    if (main.keyframes[track].some((kf) => Math.abs(kf.value - def) > 0.01)) {
      return true;
    }
  }
  return false;
}

export function resolveActiveClipAtTime(
  recipe: VideoEditRecipe,
  playheadSec: number,
): ActiveClipResolution | null {
  if (recipe.clips.length === 0) return null;
  const total = computeTimelineTotalDuration(recipe);
  const clampedTime = clampNumber(playheadSec, 0, total);
  let cursor = 0;

  for (let i = 0; i < recipe.clips.length; i++) {
    const clip = recipe.clips[i]!;
    const dur = getClipEffectiveDuration(clip);
    const isLast = i === recipe.clips.length - 1;
    if (clampedTime < cursor + dur || isLast) {
      const localTimeSec = roundMs(clampNumber(clampedTime - cursor, 0, dur));
      const sourceTimeSec = roundMs(
        clampNumber(clip.inSec + localTimeSec * clip.speed, clip.inSec, clip.outSec),
      );
      return {
        clip,
        clipIndex: i,
        clipTimelineStartSec: roundMs(cursor),
        clipTimelineDurationSec: dur,
        localTimeSec,
        sourceTimeSec,
      };
    }
    cursor += dur;
  }
  return null;
}

export function splitVideoClipAtTime(
  recipe: VideoEditRecipe,
  playheadSec: number,
): { recipe: VideoEditRecipe; newClipId: string | null } {
  const active = resolveActiveClipAtTime(recipe, playheadSec);
  if (!active || active.clip.locked) {
    return { recipe, newClipId: null };
  }

  const { clip, clipIndex, localTimeSec, clipTimelineDurationSec } = active;
  if (
    localTimeSec < MIN_CLIP_DURATION_SEC * 0.7 ||
    clipTimelineDurationSec - localTimeSec < MIN_CLIP_DURATION_SEC * 0.7
  ) {
    return { recipe, newClipId: null };
  }

  const splitSourceSec = roundMs(
    clampNumber(
      clip.inSec + localTimeSec * clip.speed,
      clip.inSec + MIN_CLIP_DURATION_SEC * 0.5,
      clip.outSec - MIN_CLIP_DURATION_SEC * 0.5,
    ),
  );
  if (
    splitSourceSec - clip.inSec < 0.25 ||
    clip.outSec - splitSourceSec < 0.25
  ) {
    return { recipe, newClipId: null };
  }

  const evaluatedAtSplit = evaluateClipKeyframes(clip, localTimeSec);
  const secondId = `${clip.id}-s${recipe.clips.length + 1}`;
  const firstKfs = {} as Record<VideoKeyframeTrack, VideoKeyframe[]>;
  const secondKfs = {} as Record<VideoKeyframeTrack, VideoKeyframe[]>;

  for (const track of KEYFRAME_TRACKS) {
    const sorted = [...clip.keyframes[track]].sort((a, b) => a.timeSec - b.timeSec);
    const left = sorted.filter((k) => k.timeSec <= localTimeSec + 0.001);
    const right = sorted
      .filter((k) => k.timeSec >= localTimeSec - 0.001)
      .map((k) => ({
        ...k,
        id: `${secondId}-${track}-${Math.round(k.timeSec * 100)}`,
        timeSec: roundMs(Math.max(0, k.timeSec - localTimeSec)),
      }));

    if (!left.some((k) => Math.abs(k.timeSec - localTimeSec) < 0.02)) {
      left.push({
        id: `${clip.id}-${track}-split`,
        timeSec: roundMs(localTimeSec),
        value: evaluatedAtSplit[track],
      });
    }
    if (!right.some((k) => k.timeSec <= 0.02)) {
      right.unshift({
        id: `${secondId}-${track}-start`,
        timeSec: 0,
        value: evaluatedAtSplit[track],
      });
    }

    firstKfs[track] = left;
    secondKfs[track] = right;
  }

  const leftClip: VideoTimelineClip = {
    ...clip,
    outSec: splitSourceSec,
    keyframes: firstKfs,
  };
  const rightClip: VideoTimelineClip = {
    ...clip,
    id: secondId,
    inSec: splitSourceSec,
    keyframes: secondKfs,
  };

  const nextClips = [...recipe.clips];
  nextClips.splice(clipIndex, 1, leftClip, rightClip);

  return {
    newClipId: secondId,
    recipe: {
      ...recipe,
      clips: nextClips,
      updatedAt: Date.now(),
    },
  };
}

export function trimVideoClipEdge(
  recipe: VideoEditRecipe,
  clipId: string,
  edge: "start" | "end",
  deltaSec: number,
): VideoEditRecipe {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return recipe;
  const clip = recipe.clips[idx]!;
  if (clip.locked || !Number.isFinite(deltaSec) || Math.abs(deltaSec) < 0.005) {
    return recipe;
  }

  const sourceDelta = deltaSec * clip.speed;
  const minSourceSpan = MIN_CLIP_DURATION_SEC * clip.speed;

  let nextIn = clip.inSec;
  let nextOut = clip.outSec;
  if (edge === "start") {
    nextIn = roundMs(
      clampNumber(clip.inSec + sourceDelta, 0, clip.outSec - minSourceSpan),
    );
  } else {
    nextOut = roundMs(
      clampNumber(
        clip.outSec + sourceDelta,
        clip.inSec + minSourceSpan,
        clip.sourceDurationSec,
      ),
    );
  }

  if (nextIn === clip.inSec && nextOut === clip.outSec) return recipe;

  const newDuration = getClipEffectiveDuration({
    ...clip,
    inSec: nextIn,
    outSec: nextOut,
  });
  const shiftLocal = edge === "start" ? (nextIn - clip.inSec) / clip.speed : 0;

  const nextKeyframes = {} as Record<VideoKeyframeTrack, VideoKeyframe[]>;
  for (const track of KEYFRAME_TRACKS) {
    nextKeyframes[track] = clip.keyframes[track].map((kf) => ({
      ...kf,
      timeSec: roundMs(clampNumber(kf.timeSec - shiftLocal, 0, newDuration)),
    }));
  }

  const nextClips = [...recipe.clips];
  nextClips[idx] = {
    ...clip,
    inSec: nextIn,
    outSec: nextOut,
    keyframes: nextKeyframes,
  };

  const nextTotal = computeTimelineTotalDuration({ ...recipe, clips: nextClips });
  return {
    ...recipe,
    clips: nextClips,
    workArea: {
      startSec: Math.min(recipe.workArea.startSec, Math.max(0, nextTotal - 0.5)),
      endSec: Math.min(nextTotal, Math.max(recipe.workArea.endSec, Math.min(nextTotal, recipe.workArea.startSec + 0.5))),
    },
    updatedAt: Date.now(),
  };
}

export function duplicateVideoClip(
  recipe: VideoEditRecipe,
  clipId: string,
): { recipe: VideoEditRecipe; duplicatedId: string | null } {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return { recipe, duplicatedId: null };
  const clip = recipe.clips[idx]!;
  const copyId = `${clip.id}-dup-${recipe.clips.length + 1}`;
  const copiedKfs = {} as Record<VideoKeyframeTrack, VideoKeyframe[]>;
  for (const track of KEYFRAME_TRACKS) {
    copiedKfs[track] = clip.keyframes[track].map((kf, kIdx) => ({
      ...kf,
      id: `${copyId}-${track}-${kIdx}`,
    }));
  }
  const copy: VideoTimelineClip = {
    ...clip,
    id: copyId,
    locked: false,
    keyframes: copiedKfs,
  };
  const nextClips = [...recipe.clips];
  nextClips.splice(idx + 1, 0, copy);
  const nextTotal = computeTimelineTotalDuration({ ...recipe, clips: nextClips });
  return {
    duplicatedId: copyId,
    recipe: {
      ...recipe,
      clips: nextClips,
      workArea: { startSec: recipe.workArea.startSec, endSec: nextTotal },
      updatedAt: Date.now(),
    },
  };
}

export function deleteVideoClip(
  recipe: VideoEditRecipe,
  clipId: string,
): VideoEditRecipe {
  if (recipe.clips.length <= 1) return recipe;
  const target = recipe.clips.find((c) => c.id === clipId);
  if (!target || target.locked) return recipe;
  const nextClips = recipe.clips.filter((c) => c.id !== clipId);
  const nextTotal = computeTimelineTotalDuration({ ...recipe, clips: nextClips });
  return {
    ...recipe,
    clips: nextClips,
    workArea: {
      startSec: Math.min(recipe.workArea.startSec, Math.max(0, nextTotal - 0.5)),
      endSec: Math.min(recipe.workArea.endSec, nextTotal),
    },
    updatedAt: Date.now(),
  };
}

export function appendMediaToTimeline(
  recipe: VideoEditRecipe,
  item: LibraryItem,
): { recipe: VideoEditRecipe; addedClipId: string } {
  const clipDuration =
    item.kind === "video"
      ? Math.max(3, parseDurationToSeconds(item.duration))
      : 4;
  const addedClipId = `clip-${item.id}-${recipe.clips.length + 1}`;
  const newClip: VideoTimelineClip = {
    id: addedClipId,
    sourceItemId: item.id,
    title: item.title,
    filename: item.filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".mp4"),
    posterSrc: item.src,
    sourceDurationSec: clipDuration,
    inSec: 0,
    outSec: clipDuration,
    speed: 1,
    muted: false,
    hidden: false,
    locked: false,
    volume: 0.85,
    keyframes: createDefaultKeyframes(addedClipId, clipDuration),
  };
  const nextClips = [...recipe.clips, newClip];
  const nextTotal = computeTimelineTotalDuration({ ...recipe, clips: nextClips });
  return {
    addedClipId,
    recipe: {
      ...recipe,
      clips: nextClips,
      audioTrack: {
        ...recipe.audioTrack,
        durationSec: Math.max(recipe.audioTrack.durationSec, nextTotal),
      },
      workArea: {
        startSec: recipe.workArea.startSec,
        endSec: nextTotal,
      },
      updatedAt: Date.now(),
    },
  };
}

function cubicBezierCoord(t: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

/**
 * Evaluates a CSS-compatible cubic-bezier(x1, y1, x2, y2) timing curve at progress `x` in [0, 1].
 * Supports overshoot curves (y1/y2 > 1 or < 0) smoothly.
 */
export function evaluateCubicBezier(
  x: number,
  bezier: CubicBezierCurve = DEFAULT_EASING_SPEC.bezier,
): number {
  const clamped = clampNumber(x, 0, 1);
  if (clamped <= 0) return 0;
  if (clamped >= 1) return 1;
  const [x1, y1, x2, y2] = bezier;
  if (x1 === y1 && x2 === y2) return clamped;

  let lo = 0;
  let hi = 1;
  let mid = clamped;
  for (let i = 0; i < 14; i++) {
    mid = (lo + hi) * 0.5;
    const estX = cubicBezierCoord(mid, x1, x2);
    if (Math.abs(estX - clamped) < 1e-4) break;
    if (estX < clamped) lo = mid;
    else hi = mid;
  }
  return cubicBezierCoord(mid, y1, y2);
}

function interpolateTrack(
  keyframes: readonly VideoKeyframe[],
  localTimeSec: number,
  fallbackValue: number,
  bezier: CubicBezierCurve = DEFAULT_EASING_SPEC.bezier,
): number {
  if (keyframes.length === 0) return fallbackValue;
  const sorted = [...keyframes].sort((a, b) => a.timeSec - b.timeSec);
  if (localTimeSec <= sorted[0]!.timeSec) return sorted[0]!.value;
  const last = sorted[sorted.length - 1]!;
  if (localTimeSec >= last.timeSec) return last.value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (localTimeSec >= a.timeSec && localTimeSec <= b.timeSec) {
      const span = Math.max(0.0001, b.timeSec - a.timeSec);
      const t = (localTimeSec - a.timeSec) / span;
      const eased = evaluateCubicBezier(t, bezier);
      return Math.round((a.value + (b.value - a.value) * eased) * 100) / 100;
    }
  }
  return fallbackValue;
}

export function evaluateClipKeyframes(
  clip: VideoTimelineClip,
  localTimeSec: number,
  bezier: CubicBezierCurve = DEFAULT_EASING_SPEC.bezier,
): EvaluatedClipTransform {
  return {
    positionX: interpolateTrack(
      clip.keyframes.positionX,
      localTimeSec,
      KEYFRAME_DEFAULTS.positionX,
      bezier,
    ),
    positionY: interpolateTrack(
      clip.keyframes.positionY,
      localTimeSec,
      KEYFRAME_DEFAULTS.positionY,
      bezier,
    ),
    opacity: clampNumber(
      interpolateTrack(
        clip.keyframes.opacity,
        localTimeSec,
        KEYFRAME_DEFAULTS.opacity,
        bezier,
      ),
      0,
      100,
    ),
    rotation: interpolateTrack(
      clip.keyframes.rotation,
      localTimeSec,
      KEYFRAME_DEFAULTS.rotation,
      bezier,
    ),
  };
}

/**
 * Applies a curated non-destructive keyframe animation preset onto a target clip.
 */
export function applyMotionPresetToClip(
  recipe: VideoEditRecipe,
  clipId: string,
  presetId: VideoMotionPresetId,
): VideoEditRecipe {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return recipe;
  const clip = recipe.clips[idx]!;
  if (clip.locked) return recipe;

  const dur = getClipEffectiveDuration(clip);
  const tMid = roundMs(dur * 0.5);
  const tEnd = roundMs(dur * 0.92);
  const stamp = Date.now();

  let nextKfs: Record<VideoKeyframeTrack, VideoKeyframe[]>;
  let nextEasing: VideoEasingSpec = recipe.easing ?? { ...DEFAULT_EASING_SPEC };

  if (presetId === "clear") {
    nextKfs = createDefaultKeyframes(clip.id, dur);
  } else if (presetId === "ken-burns") {
    nextEasing = { preset: "ease-in-out", bezier: EASING_PRESETS["ease-in-out"] };
    nextKfs = {
      positionX: [
        { id: `${clip.id}-kb-px0-${stamp}`, timeSec: 0, value: -18 },
        { id: `${clip.id}-kb-px1-${stamp}`, timeSec: tEnd, value: 18 },
      ],
      positionY: [
        { id: `${clip.id}-kb-py0-${stamp}`, timeSec: 0, value: -8 },
        { id: `${clip.id}-kb-py1-${stamp}`, timeSec: tEnd, value: 10 },
      ],
      opacity: [
        { id: `${clip.id}-kb-op0-${stamp}`, timeSec: 0, value: 100 },
        { id: `${clip.id}-kb-op1-${stamp}`, timeSec: tEnd, value: 100 },
      ],
      rotation: [
        { id: `${clip.id}-kb-rt0-${stamp}`, timeSec: 0, value: -1 },
        { id: `${clip.id}-kb-rt1-${stamp}`, timeSec: tEnd, value: 1 },
      ],
    };
  } else if (presetId === "cinematic-reveal") {
    nextEasing = { preset: "expo-out", bezier: EASING_PRESETS["expo-out"] };
    nextKfs = {
      positionX: [{ id: `${clip.id}-cr-px0-${stamp}`, timeSec: 0, value: 0 }],
      positionY: [
        { id: `${clip.id}-cr-py0-${stamp}`, timeSec: 0, value: 26 },
        { id: `${clip.id}-cr-py1-${stamp}`, timeSec: roundMs(Math.min(1.8, dur * 0.35)), value: 0 },
      ],
      opacity: [
        { id: `${clip.id}-cr-op0-${stamp}`, timeSec: 0, value: 18 },
        { id: `${clip.id}-cr-op1-${stamp}`, timeSec: roundMs(Math.min(1.5, dur * 0.28)), value: 100 },
      ],
      rotation: [{ id: `${clip.id}-cr-rt0-${stamp}`, timeSec: 0, value: 0 }],
    };
  } else if (presetId === "micro-zoom") {
    nextEasing = { preset: "overshoot", bezier: EASING_PRESETS.overshoot };
    nextKfs = {
      positionX: [
        { id: `${clip.id}-mz-px0-${stamp}`, timeSec: 0, value: -10 },
        { id: `${clip.id}-mz-px1-${stamp}`, timeSec: tMid, value: 12 },
        { id: `${clip.id}-mz-px2-${stamp}`, timeSec: tEnd, value: 0 },
      ],
      positionY: [
        { id: `${clip.id}-mz-py0-${stamp}`, timeSec: 0, value: 6 },
        { id: `${clip.id}-mz-py1-${stamp}`, timeSec: tMid, value: -6 },
        { id: `${clip.id}-mz-py2-${stamp}`, timeSec: tEnd, value: 0 },
      ],
      opacity: [{ id: `${clip.id}-mz-op0-${stamp}`, timeSec: 0, value: 100 }],
      rotation: [{ id: `${clip.id}-mz-rt0-${stamp}`, timeSec: 0, value: 0 }],
    };
  } else if (presetId === "gentle-tilt") {
    nextEasing = { preset: "ease-out", bezier: EASING_PRESETS["ease-out"] };
    nextKfs = {
      positionX: [{ id: `${clip.id}-gt-px0-${stamp}`, timeSec: 0, value: 0 }],
      positionY: [{ id: `${clip.id}-gt-py0-${stamp}`, timeSec: 0, value: 0 }],
      opacity: [{ id: `${clip.id}-gt-op0-${stamp}`, timeSec: 0, value: 100 }],
      rotation: [
        { id: `${clip.id}-gt-rt0-${stamp}`, timeSec: 0, value: -5 },
        { id: `${clip.id}-gt-rt1-${stamp}`, timeSec: tMid, value: 5 },
        { id: `${clip.id}-gt-rt2-${stamp}`, timeSec: tEnd, value: 0 },
      ],
    };
  } else {
    // fade-pulse
    nextEasing = { preset: "ease-in-out", bezier: EASING_PRESETS["ease-in-out"] };
    nextKfs = {
      positionX: [{ id: `${clip.id}-fp-px0-${stamp}`, timeSec: 0, value: 0 }],
      positionY: [{ id: `${clip.id}-fp-py0-${stamp}`, timeSec: 0, value: 0 }],
      opacity: [
        { id: `${clip.id}-fp-op0-${stamp}`, timeSec: 0, value: 15 },
        { id: `${clip.id}-fp-op1-${stamp}`, timeSec: roundMs(dur * 0.2), value: 100 },
        { id: `${clip.id}-fp-op2-${stamp}`, timeSec: roundMs(dur * 0.8), value: 100 },
        { id: `${clip.id}-fp-op3-${stamp}`, timeSec: dur, value: 15 },
      ],
      rotation: [{ id: `${clip.id}-fp-rt0-${stamp}`, timeSec: 0, value: 0 }],
    };
  }

  const nextClips = [...recipe.clips];
  nextClips[idx] = { ...clip, keyframes: nextKfs };
  return {
    ...recipe,
    clips: nextClips,
    easing: nextEasing,
    updatedAt: Date.now(),
  };
}

export function upsertClipKeyframe(
  recipe: VideoEditRecipe,
  clipId: string,
  track: VideoKeyframeTrack,
  localTimeSec: number,
  value: number,
): VideoEditRecipe {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return recipe;
  const clip = recipe.clips[idx]!;
  if (clip.locked) return recipe;

  const bounds = KEYFRAME_BOUNDS[track];
  const clampedValue = Math.round(clampNumber(value, bounds.min, bounds.max));
  const dur = getClipEffectiveDuration(clip);
  const clampedTime = roundMs(clampNumber(localTimeSec, 0, dur));

  const existing = clip.keyframes[track];
  const matchIdx = existing.findIndex(
    (kf) => Math.abs(kf.timeSec - clampedTime) <= 0.12,
  );
  let nextTrackKfs: VideoKeyframe[];
  if (matchIdx >= 0) {
    nextTrackKfs = existing.map((kf, i) =>
      i === matchIdx ? { ...kf, value: clampedValue } : kf,
    );
  } else {
    nextTrackKfs = [
      ...existing,
      {
        id: `${clip.id}-${track}-${Date.now()}-${existing.length}`,
        timeSec: clampedTime,
        value: clampedValue,
      },
    ].sort((a, b) => a.timeSec - b.timeSec);
  }

  const nextClips = [...recipe.clips];
  nextClips[idx] = {
    ...clip,
    keyframes: {
      ...clip.keyframes,
      [track]: nextTrackKfs,
    },
  };
  return {
    ...recipe,
    clips: nextClips,
    updatedAt: Date.now(),
  };
}

export function moveClipKeyframe(
  recipe: VideoEditRecipe,
  clipId: string,
  track: VideoKeyframeTrack,
  keyframeId: string,
  nextLocalTimeSec: number,
): VideoEditRecipe {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return recipe;
  const clip = recipe.clips[idx]!;
  if (clip.locked) return recipe;

  const dur = getClipEffectiveDuration(clip);
  const clampedTime = roundMs(clampNumber(nextLocalTimeSec, 0, dur));
  const nextTrackKfs = clip.keyframes[track]
    .map((kf) => (kf.id === keyframeId ? { ...kf, timeSec: clampedTime } : kf))
    .sort((a, b) => a.timeSec - b.timeSec);

  const nextClips = [...recipe.clips];
  nextClips[idx] = {
    ...clip,
    keyframes: {
      ...clip.keyframes,
      [track]: nextTrackKfs,
    },
  };
  return {
    ...recipe,
    clips: nextClips,
    updatedAt: Date.now(),
  };
}

export function deleteClipKeyframe(
  recipe: VideoEditRecipe,
  clipId: string,
  track: VideoKeyframeTrack,
  keyframeId: string,
): VideoEditRecipe {
  const idx = recipe.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return recipe;
  const clip = recipe.clips[idx]!;
  if (clip.locked) return recipe;
  if (clip.keyframes[track].length <= 1) return recipe;

  const nextTrackKfs = clip.keyframes[track].filter((kf) => kf.id !== keyframeId);
  const nextClips = [...recipe.clips];
  nextClips[idx] = {
    ...clip,
    keyframes: {
      ...clip.keyframes,
      [track]: nextTrackKfs,
    },
  };
  return {
    ...recipe,
    clips: nextClips,
    updatedAt: Date.now(),
  };
}

export function computeAutoBrightnessGrade(
  current: VideoColorGrade,
): VideoColorGrade {
  if (current.autoBrightness) {
    return {
      ...current,
      autoBrightness: false,
      brightness: 0,
      contrast: 0,
      exposure: 0,
      saturation: 0,
    };
  }
  return {
    ...current,
    enabled: true,
    autoBrightness: true,
    brightness: 10,
    contrast: 6,
    exposure: 3,
    saturation: 8,
  };
}

export function buildVideoCssFilter(
  grade: VideoColorGrade | undefined,
  bypassOriginal = false,
): string {
  if (!grade || !grade.enabled || bypassOriginal) return "none";

  const brightnessFactor =
    1 + grade.brightness * 0.0055 + grade.exposure * 0.004 + (grade.upscale ? 0.015 : 0);
  const contrastFactor =
    1 + grade.contrast * 0.0065 + (grade.upscale ? 0.05 : 0);
  const saturateFactor =
    1 + grade.saturation * 0.0085 + (grade.upscale ? 0.05 : 0);
  const blurPx = Math.max(0, grade.blur);
  const warmthSepia = grade.warmth > 0 ? Math.min(0.45, grade.warmth / 120) : 0;
  const coolHueDeg = grade.warmth < 0 ? Math.max(-24, grade.warmth * 0.45) : 0;

  const parts: string[] = [];
  if (Math.abs(brightnessFactor - 1) > 0.004) {
    parts.push(`brightness(${clampNumber(brightnessFactor, 0.45, 1.65).toFixed(3)})`);
  }
  if (Math.abs(contrastFactor - 1) > 0.004) {
    parts.push(`contrast(${clampNumber(contrastFactor, 0.5, 1.75).toFixed(3)})`);
  }
  if (Math.abs(saturateFactor - 1) > 0.004) {
    parts.push(`saturate(${clampNumber(saturateFactor, 0, 2.2).toFixed(3)})`);
  }
  if (blurPx > 0.05) {
    parts.push(`blur(${clampNumber(blurPx, 0, 24).toFixed(1)}px)`);
  }
  if (warmthSepia > 0.005) {
    parts.push(`sepia(${warmthSepia.toFixed(3)})`);
  }
  if (Math.abs(coolHueDeg) > 0.1) {
    parts.push(`hue-rotate(${coolHueDeg.toFixed(1)}deg)`);
  }

  return parts.length > 0 ? parts.join(" ") : "none";
}

export function buildVideoPreviewTransform(
  transform: VideoFrameTransform | undefined,
  kf?: EvaluatedClipTransform,
  bypassOriginal = false,
): string {
  if (bypassOriginal) return "none";
  const tx = kf?.positionX ?? 0;
  const ty = kf?.positionY ?? 0;
  const rot = (transform?.rotationDeg ?? 0) + (kf?.rotation ?? 0);
  const flip = transform?.flipH ? -1 : 1;

  const parts: string[] = [];
  if (Math.abs(tx) > 0.05 || Math.abs(ty) > 0.05) {
    parts.push(`translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`);
  }
  if (Math.abs(rot) > 0.05) {
    parts.push(`rotate(${rot.toFixed(1)}deg)`);
  }
  if (flip < 0) {
    parts.push("scaleX(-1)");
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

export function getAspectRatioNumber(
  aspectRatio: VideoAspectRatio,
  sourceWidth: number,
  sourceHeight: number,
): number {
  if (aspectRatio === "16:9") return 16 / 9;
  if (aspectRatio === "4:3") return 4 / 3;
  if (aspectRatio === "1:1") return 1;
  if (aspectRatio === "9:16") return 9 / 16;
  return sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
}

/**
 * Formats seconds as `00:05:562` (MM:SS:mmm) matching the studio timecode readout.
 */
export function formatPreciseTimecode(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalMs = Math.round(safe * 1000);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(ms).padStart(3, "0")}`;
}

/**
 * Formats seconds as `00:12` (MM:SS) for ruler markers and preview scrub bar.
 */
export function formatShortTimecode(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalSec = Math.floor(safe);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatTimecodeByMode(
  sec: number,
  mode: VideoTimecodeMode,
  fps = 30,
): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  if (mode === "frames") {
    const frame = Math.round(safe * fps);
    return `${String(frame).padStart(4, "0")}f`;
  }
  if (mode === "seconds") {
    return `${safe.toFixed(2)}s`;
  }
  return formatPreciseTimecode(safe);
}

export function exportNonDestructiveEdlJson(
  item: LibraryItem,
  recipe: VideoEditRecipe,
): string {
  return JSON.stringify(
    {
      format: "atlas.nondestructive.video.v1",
      exportedAt: new Date().toISOString(),
      sourceAsset: {
        id: item.id,
        filename: item.filename,
        title: item.title,
        dimensions: `${item.width}x${item.height}`,
      },
      totalDurationSec: computeTimelineTotalDuration(recipe),
      recipe,
    },
    null,
    2,
  );
}
