import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  atomicMediaPlayerManager,
  AtomicVideoSlot,
  useAtomicMediaVersion,
} from "./AtomicMediaPlayerHost";
import { atlasAudioEngine, type AudioPlaybackSnapshot } from "./audio-synth-engine";
import { MOTION_BAR_ORANGE } from "./elastic-motion-bar";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { computeSharedGifPhase } from "./hero-transition";
import { formatAudioTime, type GifAnimationKind } from "./media-helpers";
import { renderModelThumbnail } from "./model3d-engine";
import type { LibraryItem, ThemeMode } from "./library-engine";
import {
  buildVideoCssFilter,
  buildVideoPreviewTransform,
  hasNonDestructiveEdits,
} from "./video-editor-engine";

export function drawProceduralGifFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: GifAnimationKind,
  progress: number,
  dark: boolean,
) {
  const t = progress * Math.PI * 2;
  ctx.clearRect(0, 0, width, height);

  if (kind === "kinetic-type") {
    // Swiss kinetic typographic poster loop
    ctx.fillStyle = dark ? "#141518" : "#f4f1ea";
    ctx.fillRect(0, 0, width, height);

    const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(17,17,17,0.06)";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const gx = (width / 6) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }

    const rows = 4;
    const rowH = height / rows;
    ctx.font = `700 ${Math.round(rowH * 0.62)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.textBaseline = "middle";

    const words = ["ATLAS", "MOTION", "SWISS", "GRID"];
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      const shift = ((progress * dir + r * 0.17) % 1 + 1) % 1;
      const y = rowH * r + rowH * 0.52;
      const word = words[r % words.length]!;
      ctx.fillStyle =
        r === 1
          ? "#e11d48"
          : dark
            ? "rgba(248,250,252,0.92)"
            : "rgba(17,17,17,0.9)";

      const stride = width * 0.72;
      for (let k = -1; k <= 2; k++) {
        const x = k * stride + shift * stride - width * 0.3;
        ctx.fillText(word, x, y);
      }
    }

    // Orbiting Swiss focal circle
    const cx = width * 0.5 + Math.cos(t) * (width * 0.24);
    const cy = height * 0.5 + Math.sin(t) * (height * 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(width, height) * 0.085, 0, Math.PI * 2);
    ctx.fillStyle = "#007aff";
    ctx.fill();
    return;
  }

  if (kind === "iso-grid") {
    // Rhythmic Dieter Rams tactile pulse matrix
    ctx.fillStyle = dark ? "#191a1d" : "#eceef2";
    ctx.fillRect(0, 0, width, height);

    const cols = 7;
    const rows = 5;
    const padX = width * 0.12;
    const padY = height * 0.14;
    const cellW = (width - padX * 2) / cols;
    const cellH = (height - padY * 2) / rows;
    const maxR = Math.min(cellW, cellH) * 0.36;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = padX + (c + 0.5) * cellW;
        const cy = padY + (r + 0.5) * cellH;
        const dist = Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2);
        const wave = 0.5 + 0.5 * Math.sin(t - dist * 0.85);
        const radius = maxR * (0.34 + wave * 0.66);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        if (c === 3 && r === 2) {
          ctx.fillStyle = "#ea580c";
        } else if (wave > 0.78) {
          ctx.fillStyle = dark ? "#f8fafc" : "#18181b";
        } else {
          ctx.fillStyle = dark
            ? `rgba(255,255,255,${0.18 + wave * 0.38})`
            : `rgba(17,17,17,${0.14 + wave * 0.42})`;
        }
        ctx.fill();
      }
    }
    return;
  }

  // "fluid-orb": luminous optical prism rings
  const grad = ctx.createLinearGradient(0, 0, width, height);
  if (dark) {
    grad.addColorStop(0, "#141821");
    grad.addColorStop(1, "#1e1b29");
  } else {
    grad.addColorStop(0, "#eef4ff");
    grad.addColorStop(1, "#fdf3e7");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const baseR = Math.min(width, height) * 0.28;

  const orbs = [
    { angle: t, dist: baseR * 0.46, r: baseR * 0.78, color: "rgba(0, 122, 255, 0.58)" },
    { angle: t + (Math.PI * 2) / 3, dist: baseR * 0.5, r: baseR * 0.72, color: "rgba(255, 138, 43, 0.56)" },
    { angle: t + (Math.PI * 4) / 3, dist: baseR * 0.42, r: baseR * 0.68, color: "rgba(52, 199, 89, 0.48)" },
  ];

  for (const orb of orbs) {
    const ox = cx + Math.cos(orb.angle) * orb.dist;
    const oy = cy + Math.sin(orb.angle) * orb.dist;
    const rg = ctx.createRadialGradient(ox, oy, orb.r * 0.05, ox, oy, orb.r);
    rg.addColorStop(0, orb.color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(ox, oy, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp optical refraction ring
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.78)";
  ctx.lineWidth = Math.max(1.5, Math.min(width, height) * 0.01);
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy,
    baseR * 1.05,
    baseR * (0.48 + 0.16 * Math.sin(t)),
    t * 0.5,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
}

function ProceduralGifThumb({
  kind,
  fps,
  theme,
}: {
  kind: GifAnimationKind;
  fps: number;
  theme: ThemeMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Paint current wall-clock phase synchronously BEFORE first browser paint (zero blank canvas flash)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const phase = computeSharedGifPhase(performance.now(), 2600);
    drawProceduralGifFrame(
      ctx,
      canvas.width,
      canvas.height,
      kind,
      phase,
      theme === "dark",
    );
  }, [kind, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastDraw = 0;
    const frameMs = 1000 / Math.max(8, Math.min(30, fps));
    const loopDurationMs = 2600;

    const tick = (now: number) => {
      if (now - lastDraw >= frameMs) {
        lastDraw = now;
        const progress = computeSharedGifPhase(now, loopDurationMs);
        drawProceduralGifFrame(
          ctx,
          canvas.width,
          canvas.height,
          kind,
          progress,
          theme === "dark",
        );
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [kind, fps, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={270}
      className="rich-gif-canvas"
      aria-hidden="true"
    />
  );
}

export interface RichMediaCardContentProps {
  item: LibraryItem;
  theme: ThemeMode;
  imgFit?: "cover" | "contain";
  interactiveAudio?: boolean;
}

export function RichMediaCardContent({
  item,
  theme,
  imgFit = "cover",
  interactiveAudio = true,
}: RichMediaCardContentProps) {
  const [audioSnap, setAudioSnap] = useState<AudioPlaybackSnapshot>(() =>
    atlasAudioEngine.getSnapshot(),
  );
  useAtomicMediaVersion();

  useEffect(() => {
    if (item.kind !== "audio") return;
    return atlasAudioEngine.subscribe(setAudioSnap);
  }, [item.kind]);

  const modelThumb = useMemo(() => {
    if (item.kind !== "model3d" || !item.modelMeta) return null;
    return renderModelThumbnail(item.modelMeta.preset, theme);
  }, [item.kind, item.modelMeta, theme]);

  // ── 1. AUDIO CARD ──
  if (item.kind === "audio" && item.audioMeta) {
    const meta = item.audioMeta;
    const isActiveTrack = audioSnap.activeItemId === item.id;
    const isPlaying = isActiveTrack && audioSnap.isPlaying;
    const progressRatio =
      isActiveTrack && audioSnap.duration > 0
        ? Math.min(1, audioSnap.currentTime / audioSnap.duration)
        : 0;
    const accent = MOTION_BAR_ORANGE;

    return (
      <div
        className={`rich-card rich-card--audio ${isPlaying ? "rich-card--playing" : ""}`}
        style={{
          ["--audio-accent" as string]: accent,
        }}
      >
        <div className="rich-audio-top">
          <button
            type="button"
            className="rich-audio-play-btn"
            data-testid={`card-audio-play-${item.id}`}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (interactiveAudio) {
                atlasAudioEngine.toggle(item.id, meta);
              }
            }}
          >
            {isPlaying ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path d="M3 1.7L10.3 6L3 10.3V1.7Z" />
              </svg>
            )}
          </button>
          <span className="rich-audio-meta-top">
            {meta.format} · {isActiveTrack ? formatAudioTime(audioSnap.currentTime) : formatAudioTime(meta.durationSec)}
          </span>
        </div>

        <div className="rich-audio-wave" aria-hidden="true">
          {meta.peaks.slice(0, 36).map((peak, idx, arr) => {
            const frac = idx / Math.max(1, arr.length - 1);
            const passed = isActiveTrack && frac <= progressRatio;
            const liveBoost =
              isPlaying && Math.abs(frac - progressRatio) < 0.08 ? 1.12 : 1;
            const pct = Math.min(100, Math.round(peak * 86 * liveBoost));
            return (
              <span
                key={idx}
                className={`rich-audio-bar ${passed ? "rich-audio-bar--active" : ""}`}
                style={{ height: `${Math.max(14, pct)}%` }}
              />
            );
          })}
        </div>

        {interactiveAudio && (
          <div
            className="rich-audio-scrub-row"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ElasticMotionBar
              min={0}
              max={100}
              step={1}
              value={Math.round(progressRatio * 100)}
              size="xs"
              width="100%"
              ariaLabel={`${item.title} playback progress`}
              onChange={(pct) => {
                if (!isActiveTrack) atlasAudioEngine.loadTrack(item.id, meta, false);
                const dur = isActiveTrack && audioSnap.duration > 0 ? audioSnap.duration : meta.durationSec;
                atlasAudioEngine.seek((pct / 100) * dur);
              }}
            />
          </div>
        )}

        <div className="rich-audio-footer">
          <span className="rich-audio-title">{item.title}</span>
          <span className="rich-audio-sub">
            {meta.artist} · {meta.bpm} BPM
          </span>
        </div>
      </div>
    );
  }

  // ── 2. 3D MODEL CARD ──
  if (item.kind === "model3d" && item.modelMeta) {
    return (
      <div className="rich-card rich-card--model3d">
        {modelThumb ? (
          <img
            src={modelThumb}
            alt={item.title}
            draggable={false}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="rich-model3d-fallback">
            <span>3D</span>
            <small>{item.modelMeta.format}</small>
          </div>
        )}
      </div>
    );
  }

  // ── 3. FONT SPECIMEN CARD ──
  if (item.kind === "font" && item.fontMeta) {
    const meta = item.fontMeta;
    return (
      <div className={`rich-card rich-card--font rich-card--font-${meta.specimenTone}`}>
        <div
          className="rich-font-glyph"
          style={{ fontFamily: meta.cssFontFamily }}
        >
          {meta.sampleGlyph}
        </div>
        <div
          className="rich-font-sample-line"
          style={{ fontFamily: meta.cssFontFamily }}
        >
          {meta.sampleHeadline}
        </div>
        <div className="rich-font-footer">
          <span className="rich-font-family">{meta.family}</span>
          <span className="rich-font-spec">
            {meta.format} · {meta.styleCount} styles
          </span>
        </div>
      </div>
    );
  }

  // ── 4. ANIMATED GIF CARD ──
  if (item.kind === "gif" && item.gifMeta) {
    if (item.gifMeta.gifUrl) {
      return (
        <img
          src={item.gifMeta.gifUrl}
          alt={item.title}
          draggable={false}
          style={{
            objectFit: imgFit,
            padding: imgFit === "contain" ? "10px" : undefined,
          }}
        />
      );
    }
    return (
      <div className="rich-card rich-card--gif">
        <ProceduralGifThumb
          kind={item.gifMeta.animationKind}
          fps={item.gifMeta.fps}
          theme={theme}
        />
      </div>
    );
  }

  // ── 5. LIVE ATOMIC VIDEO / EMBED CARD (seamless moveBefore() slot) ──
  if (item.kind === "video") {
    const videoActive =
      interactiveAudio && atomicMediaPlayerManager.isItemActive(item.id);
    const isEdited = hasNonDestructiveEdits(item.videoEdit, item);
    const cardFilter = item.videoEdit
      ? buildVideoCssFilter(item.videoEdit.grade)
      : undefined;
    const cardTransform = item.videoEdit
      ? buildVideoPreviewTransform(item.videoEdit.transform)
      : undefined;
    return (
      <div
        className="rich-card rich-card--video"
        style={{
          filter: cardFilter,
          transform: cardTransform,
        }}
      >
        <img
          src={item.src}
          alt={item.title}
          draggable={false}
          style={{
            objectFit: imgFit,
            padding: imgFit === "contain" ? "10px" : undefined,
          }}
        />
        {videoActive && <AtomicVideoSlot item={item} slotKind="card" />}
        {isEdited && (
          <span
            className="rich-video-edited-dot"
            title="Non-destructive edits active"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  // ── 6. STANDARD IMAGE / LINK ──
  return (
    <img
      src={item.src}
      alt={item.title}
      draggable={false}
      style={{
        objectFit: imgFit,
        padding: imgFit === "contain" ? "10px" : undefined,
      }}
    />
  );
}
