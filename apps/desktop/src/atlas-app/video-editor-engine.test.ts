import assert from "node:assert/strict";
import test from "node:test";
import type { LibraryItem } from "./library-engine";
import {
  appendMediaToTimeline,
  applyMotionPresetToClip,
  buildVideoCssFilter,
  buildVideoPreviewTransform,
  computeAutoBrightnessGrade,
  computeTimelineTotalDuration,
  createDefaultVideoEditRecipe,
  deleteClipKeyframe,
  deleteVideoClip,
  duplicateVideoClip,
  EASING_PRESETS,
  evaluateClipKeyframes,
  evaluateCubicBezier,
  formatPreciseTimecode,
  formatShortTimecode,
  formatTimecodeByMode,
  hasNonDestructiveEdits,
  moveClipKeyframe,
  resolveActiveClipAtTime,
  splitVideoClipAtTime,
  trimVideoClipEdge,
  upsertClipKeyframe,
} from "./video-editor-engine";

const SAMPLE_VIDEO: LibraryItem = {
  id: "vid-01",
  title: "Modern Thatched Pavilion",
  filename: "modern_thatched_house.mp4",
  src: "/mock-video.jpg",
  width: 1600,
  height: 900,
  kind: "video",
  duration: "0:14",
  collectionId: "architecture",
  tags: ["motion"],
  liked: true,
  trashed: false,
  palette: ["#94a3b8", "#1e293b", "#f8fafc"],
  note: "",
  addedAt: "Today",
  canvasX: 0,
  canvasY: 0,
  canvasW: 320,
  canvasZ: 1,
};

const SAMPLE_BROLL: LibraryItem = {
  ...SAMPLE_VIDEO,
  id: "vid-02",
  title: "Botanical Glass Orb",
  filename: "botanical_orb.mp4",
  duration: "0:08",
};

test("default non-destructive recipe reports zero edits until modified", () => {
  const recipe = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  assert.equal(recipe.clips.length, 1);
  assert.equal(computeTimelineTotalDuration(recipe), 14);
  assert.equal(hasNonDestructiveEdits(recipe, SAMPLE_VIDEO), false);

  const graded = {
    ...recipe,
    grade: computeAutoBrightnessGrade(recipe.grade),
  };
  assert.equal(hasNonDestructiveEdits(graded, SAMPLE_VIDEO), true);
  assert.ok(buildVideoCssFilter(graded.grade).includes("brightness("));
  assert.equal(buildVideoCssFilter(graded.grade, true), "none");
});

test("splitVideoClipAtTime splits a clip cleanly at playhead while preserving total duration", () => {
  const recipe = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  const { recipe: split, newClipId } = splitVideoClipAtTime(recipe, 5.5);

  assert.ok(newClipId);
  assert.equal(split.clips.length, 2);
  assert.equal(split.clips[0]!.inSec, 0);
  assert.equal(split.clips[0]!.outSec, 5.5);
  assert.equal(split.clips[1]!.inSec, 5.5);
  assert.equal(split.clips[1]!.outSec, 14);
  assert.equal(computeTimelineTotalDuration(split), 14);

  const activeSecond = resolveActiveClipAtTime(split, 8.2);
  assert.ok(activeSecond);
  assert.equal(activeSecond.clipIndex, 1);
  assert.equal(activeSecond.localTimeSec, 2.7);
  assert.equal(activeSecond.sourceTimeSec, 8.2);
});

test("trimVideoClipEdge respects source bounds and minimum clip length", () => {
  const recipe = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  const clipId = recipe.clips[0]!.id;

  const trimmedIn = trimVideoClipEdge(recipe, clipId, "start", 2.0);
  assert.equal(trimmedIn.clips[0]!.inSec, 2);
  assert.equal(computeTimelineTotalDuration(trimmedIn), 12);

  const trimmedOut = trimVideoClipEdge(trimmedIn, clipId, "end", -3.0);
  assert.equal(trimmedOut.clips[0]!.outSec, 11);
  assert.equal(computeTimelineTotalDuration(trimmedOut), 9);

  // Over-trimming clamps to minimum span instead of inverting
  const overTrimmed = trimVideoClipEdge(trimmedOut, clipId, "start", 50);
  assert.ok(overTrimmed.clips[0]!.outSec - overTrimmed.clips[0]!.inSec >= 0.5);
});

test("keyframe upsert, move, delete, and smooth cubic evaluation work accurately", () => {
  let recipe = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  const clipId = recipe.clips[0]!.id;

  recipe = upsertClipKeyframe(recipe, clipId, "positionX", 0, 0);
  recipe = upsertClipKeyframe(recipe, clipId, "positionX", 4, 100);
  recipe = upsertClipKeyframe(recipe, clipId, "rotation", 4, 30);

  const mid = evaluateClipKeyframes(recipe.clips[0]!, 2);
  assert.equal(mid.positionX, 50);

  const targetKf = recipe.clips[0]!.keyframes.positionX.find((k) => k.value === 100);
  assert.ok(targetKf);
  recipe = moveClipKeyframe(recipe, clipId, "positionX", targetKf.id, 6);
  const movedKf = recipe.clips[0]!.keyframes.positionX.find((k) => k.id === targetKf.id);
  assert.equal(movedKf?.timeSec, 6);

  const transformCss = buildVideoPreviewTransform(
    { aspectRatio: "16:9", rotationDeg: 90, flipH: true },
    mid,
  );
  assert.ok(transformCss.includes("translate3d(50.0px, 0.0px, 0)"));
  assert.ok(transformCss.includes("scaleX(-1)"));

  const beforeLen = recipe.clips[0]!.keyframes.positionX.length;
  recipe = deleteClipKeyframe(recipe, clipId, "positionX", targetKf.id);
  assert.equal(recipe.clips[0]!.keyframes.positionX.length, beforeLen - 1);
});

test("appendMediaToTimeline, duplicateVideoClip, and deleteVideoClip manage multi-clip sequence safely", () => {
  const base = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  const { recipe: withBroll, addedClipId } = appendMediaToTimeline(base, SAMPLE_BROLL);
  assert.equal(withBroll.clips.length, 2);
  assert.equal(computeTimelineTotalDuration(withBroll), 22);

  const { recipe: withDup, duplicatedId } = duplicateVideoClip(withBroll, addedClipId);
  assert.ok(duplicatedId);
  assert.equal(withDup.clips.length, 3);
  assert.equal(computeTimelineTotalDuration(withDup), 30);

  const afterDel = deleteVideoClip(withDup, duplicatedId);
  assert.equal(afterDel.clips.length, 2);

  // Deleting down to 1 clip stops safely at 1 clip
  const single = deleteVideoClip(afterDel, addedClipId);
  assert.equal(single.clips.length, 1);
  const stillSingle = deleteVideoClip(single, single.clips[0]!.id);
  assert.equal(stillSingle.clips.length, 1);
});

test("timecode formatters output precise MM:SS:mmm, frames, and seconds strings", () => {
  assert.equal(formatPreciseTimecode(28.262), "00:28:262");
  assert.equal(formatPreciseTimecode(5.562), "00:05:562");
  assert.equal(formatShortTimecode(92.4), "01:32");
  assert.equal(formatShortTimecode(0), "00:00");
  assert.equal(formatTimecodeByMode(3.262, "timecode"), "00:03:262");
  assert.equal(formatTimecodeByMode(3.262, "frames", 30), "0098f");
  assert.equal(formatTimecodeByMode(3.262, "seconds"), "3.26s");
});

test("evaluateCubicBezier and applyMotionPresetToClip drive custom easing and presets accurately", () => {
  assert.equal(evaluateCubicBezier(0, EASING_PRESETS["ease-out"]), 0);
  assert.equal(evaluateCubicBezier(1, EASING_PRESETS["ease-out"]), 1);
  assert.equal(evaluateCubicBezier(0.5, EASING_PRESETS.linear), 0.5);
  assert.ok(evaluateCubicBezier(0.5, EASING_PRESETS["ease-out"]) > 0.7);
  assert.ok(evaluateCubicBezier(0.75, EASING_PRESETS.overshoot) > 1);

  const base = createDefaultVideoEditRecipe(SAMPLE_VIDEO);
  const clipId = base.clips[0]!.id;
  const withKb = applyMotionPresetToClip(base, clipId, "ken-burns");
  assert.equal(hasNonDestructiveEdits(withKb, SAMPLE_VIDEO), true);
  assert.equal(withKb.clips[0]!.keyframes.positionX[0]!.value, -18);
  assert.equal(withKb.clips[0]!.keyframes.positionX[1]!.value, 18);

  const cleared = applyMotionPresetToClip(withKb, clipId, "clear");
  assert.equal(hasNonDestructiveEdits(cleared, SAMPLE_VIDEO), false);
});
