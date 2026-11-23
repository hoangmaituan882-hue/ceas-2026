import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPlaybackRate,
  detectAssetKindFromFilename,
  formatAudioTime,
  formatCompactCount,
  generateDeterministicWaveform,
  isRichInteractiveKind,
} from "./media-helpers";

test("detectAssetKindFromFilename classifies audio, 3d models, fonts, gifs, videos, and images", () => {
  assert.equal(detectAssetKindFromFilename("ambient-loop.wav"), "audio");
  assert.equal(detectAssetKindFromFilename("sketch.flac"), "audio");
  assert.equal(detectAssetKindFromFilename("song", "audio/mpeg"), "audio");

  assert.equal(detectAssetKindFromFilename("camera-assembly.glb"), "model3d");
  assert.equal(detectAssetKindFromFilename("chair.obj"), "model3d");
  assert.equal(detectAssetKindFromFilename("sculpture.usdz"), "model3d");

  assert.equal(detectAssetKindFromFilename("Fraunces.woff2"), "font");
  assert.equal(detectAssetKindFromFilename("NeueHaas.otf"), "font");
  assert.equal(detectAssetKindFromFilename("Mono.ttf"), "font");

  assert.equal(detectAssetKindFromFilename("kinetic-grid.gif"), "gif");
  assert.equal(detectAssetKindFromFilename("anim", "image/gif"), "gif");

  assert.equal(detectAssetKindFromFilename("demo.mp4"), "video");
  assert.equal(detectAssetKindFromFilename("poster.jpg"), "image");
});

test("formatAudioTime & clampPlaybackRate format and bound values safely", () => {
  assert.equal(formatAudioTime(0), "0:00");
  assert.equal(formatAudioTime(9.4), "0:09");
  assert.equal(formatAudioTime(42), "0:42");
  assert.equal(formatAudioTime(125.9), "2:05");
  assert.equal(formatAudioTime(-4), "0:00");
  assert.equal(formatAudioTime(Number.NaN), "0:00");

  assert.equal(clampPlaybackRate(0.1), 0.25);
  assert.equal(clampPlaybackRate(1.25), 1.25);
  assert.equal(clampPlaybackRate(5), 2);
  assert.equal(clampPlaybackRate(Number.NaN), 1);
  assert.equal(formatCompactCount(14820), "14.8K");
  assert.equal(isRichInteractiveKind("model3d"), true);
  assert.equal(isRichInteractiveKind("image"), false);
});

test("generateDeterministicWaveform produces repeatable bounded peak arrays", () => {
  const a = generateDeterministicWaveform(42, 48);
  const b = generateDeterministicWaveform(42, 48);
  const c = generateDeterministicWaveform(99, 48);

  assert.equal(a.length, 48);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const peak of a) {
    assert.ok(peak >= 0.16 && peak <= 1, `Peak out of range: ${peak}`);
  }
});
