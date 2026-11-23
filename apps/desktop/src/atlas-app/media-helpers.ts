export type LibraryItemKind =
  | "image"
  | "video"
  | "link"
  | "audio"
  | "model3d"
  | "font"
  | "gif";

export type AudioSynthPreset = "ambient-pad" | "modular-arp" | "vinyl-chords";
export type Model3DPreset =
  | "optical-camera"
  | "braun-turntable"
  | "sculptural-vessel";
export type GifAnimationKind = "kinetic-type" | "fluid-orb" | "iso-grid";

export interface AudioMeta {
  artist: string;
  bpm: number;
  sampleRate: string;
  format: "WAV" | "FLAC" | "MP3" | "AIFF" | "OGG";
  durationSec: number;
  peaks: number[];
  synthPreset: AudioSynthPreset;
  /** Optional object URL when user drops/imports a local audio file */
  audioUrl?: string;
}

export interface Model3DMeta {
  format: "GLB" | "GLTF" | "OBJ" | "USDZ";
  preset: Model3DPreset;
  vertices: number;
  triangles: number;
  materialsCount: number;
  fileSize: string;
  /** Optional object URL when user drops/imports a local .glb/.gltf/.obj file */
  modelUrl?: string;
}

export interface FontMeta {
  family: string;
  foundry: string;
  format: "OTF" | "WOFF2" | "TTF" | "WOFF";
  styleCount: number;
  weights: number[];
  sampleGlyph: string;
  sampleHeadline: string;
  sampleBody: string;
  cssFontFamily: string;
  specimenTone: "paper" | "ink" | "cobalt";
  /** Optional object URL when user drops/imports a local font file */
  fontUrl?: string;
}

export interface GifMeta {
  fps: number;
  frames: number;
  loop: boolean;
  fileSize: string;
  animationKind: GifAnimationKind;
  /** Optional object URL when user drops/imports a local .gif file */
  gifUrl?: string;
}

const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aiff", "aac"]);
const MODEL_EXTS = new Set(["glb", "gltf", "obj", "usdz", "stl"]);
const FONT_EXTS = new Set(["ttf", "otf", "woff", "woff2"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "m4v"]);

/**
 * Pure filename + MIME-type classifier for multi-format drag-and-drop & import.
 */
export function detectAssetKindFromFilename(
  filename: string,
  mimeType = "",
): LibraryItemKind {
  const ext = filename.split(".").pop()?.toLowerCase().trim() ?? "";
  const mime = mimeType.toLowerCase().trim();

  if (ext === "gif" || mime === "image/gif") return "gif";
  if (AUDIO_EXTS.has(ext) || mime.startsWith("audio/")) return "audio";
  if (MODEL_EXTS.has(ext) || mime.startsWith("model/")) return "model3d";
  if (FONT_EXTS.has(ext) || mime.startsWith("font/")) return "font";
  if (VIDEO_EXTS.has(ext) || mime.startsWith("video/")) return "video";
  return "image";
}

/**
 * Formats seconds into crisp tabular media player time ("0:42" or "1:08").
 */
export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Generates deterministic, musical-looking amplitude envelope peaks in [0.16, 1.0].
 */
export function generateDeterministicWaveform(
  seed: number,
  bars: number,
): number[] {
  const count = Math.max(8, Math.min(128, Math.round(bars)));
  const out: number[] = [];
  let s = (Math.abs(Math.floor(seed)) || 17) >>> 0;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const rand = (s & 0xffff) / 0xffff;
    const t = i / Math.max(1, count - 1);
    // Natural phrase envelope (soft attack, rhythmic mid-section, gentle tail)
    const env =
      0.38 +
      0.42 * Math.sin(t * Math.PI) +
      0.18 * Math.sin(t * Math.PI * 5 + seed * 0.7);
    const val = Math.min(1, Math.max(0.16, env * (0.58 + rand * 0.62)));
    out.push(Math.round(val * 1000) / 1000);
  }
  return out;
}

export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.round(Math.min(2, Math.max(0.25, rate)) * 100) / 100;
}

export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function isRichInteractiveKind(kind: LibraryItemKind): boolean {
  return (
    kind === "audio" ||
    kind === "model3d" ||
    kind === "font" ||
    kind === "gif"
  );
}
