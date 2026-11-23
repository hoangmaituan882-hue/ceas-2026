import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { computeSharedGifPhase, HERO_MOTION_EASE } from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import { drawProceduralGifFrame } from "./RichMediaCardContent";
import type { LibraryItem, ThemeMode } from "./library-engine";

export interface GifQuickLookViewerProps {
  item: LibraryItem;
  theme: ThemeMode;
  locale: AppLocale;
}

const GIF_SPEEDS = [0.25, 0.5, 1, 2] as const;

export function GifQuickLookViewer({
  item,
  theme,
  locale,
}: GifQuickLookViewerProps) {
  const m = getMessages(locale);
  const meta = item.gifMeta!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalFrames = Math.max(12, meta.frames);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(meta.loop);
  // Start on the exact shared wall-clock phase so opening from Grid/Canvas has zero frame jump
  const [frame, setFrame] = useState(() =>
    Math.floor(
      computeSharedGifPhase(
        typeof performance !== "undefined" ? performance.now() : 0,
        2600,
      ) * totalFrames,
    ),
  );

  // Space toggles play/pause for GIF preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Frame clock for procedural GIF preview
  useEffect(() => {
    if (meta.gifUrl || !playing) return;
    const intervalMs = Math.max(16, 1000 / (meta.fps * speed));
    const timer = window.setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1;
        if (next >= totalFrames) {
          if (!loop) {
            setPlaying(false);
            return totalFrames - 1;
          }
          return 0;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [meta.gifUrl, meta.fps, playing, speed, totalFrames, loop]);

  // Paint active frame synchronously BEFORE browser paint (zero blank canvas flash!)
  useLayoutEffect(() => {
    if (meta.gifUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawProceduralGifFrame(
      ctx,
      canvas.width,
      canvas.height,
      meta.animationKind,
      frame / totalFrames,
      theme === "dark",
    );
  }, [meta.gifUrl, meta.animationKind, frame, totalFrames, theme]);

  const cycleSpeed = () => {
    const idx = GIF_SPEEDS.indexOf(speed as (typeof GIF_SPEEDS)[number]);
    setSpeed(GIF_SPEEDS[(idx + 1) % GIF_SPEEDS.length] ?? 1);
  };

  return (
    <div
      className="ql-gif-stage"
      data-testid="ql-gif-viewer"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ql-gif-viewport">
        {meta.gifUrl ? (
          <img
            src={meta.gifUrl}
            alt={item.title}
            className="ql-gif-native-img"
            draggable={false}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={960}
            height={720}
            className="ql-gif-canvas"
          />
        )}

        <motion.div
          className="ql-gif-spec-strip"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.08, ease: HERO_MOTION_EASE }}
        >
          <span>GIF</span>
          <span aria-hidden="true">·</span>
          <span>{meta.fps} FPS</span>
          <span aria-hidden="true">·</span>
          <span>
            {totalFrames} {m.gifFramesUnit}
          </span>
          <span aria-hidden="true">·</span>
          <span>{meta.fileSize}</span>
        </motion.div>
      </div>

      {/* Interactive Frame Scrubber & Playback Bar */}
      {!meta.gifUrl && (
        <motion.div
          className="ql-gif-controls"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.1, ease: HERO_MOTION_EASE }}
        >
          <button
            type="button"
            className="ql-media-chip ql-media-chip--primary"
            data-testid="ql-gif-play-btn"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? m.mediaPause : m.mediaPlay}
          </button>

          <button
            type="button"
            className="ql-media-chip"
            aria-label={m.gifPrevFrame}
            onClick={() => {
              setPlaying(false);
              setFrame((f) => (f - 1 + totalFrames) % totalFrames);
            }}
          >
            ‹
          </button>

          <ElasticMotionBar
            min={0}
            max={Math.max(1, totalFrames - 1)}
            step={1}
            value={frame}
            size="md"
            ariaLabel={m.gifScrubLabel}
            testId="ql-gif-scrubber"
            className="ql-gif-scrubber-bar"
            onChange={(nextFrame) => {
              setPlaying(false);
              setFrame(nextFrame);
            }}
          />

          <button
            type="button"
            className="ql-media-chip"
            aria-label={m.gifNextFrame}
            onClick={() => {
              setPlaying(false);
              setFrame((f) => (f + 1) % totalFrames);
            }}
          >
            ›
          </button>

          <span className="ql-gif-frame-counter" data-testid="ql-gif-frame-counter">
            {String(frame + 1).padStart(2, "0")} / {totalFrames}
          </span>

          <button
            type="button"
            className="ql-media-chip"
            onClick={cycleSpeed}
            data-testid="ql-gif-speed-btn"
          >
            {speed}×
          </button>

          <button
            type="button"
            className={`ql-media-chip ${loop ? "ql-media-chip--active" : ""}`}
            onClick={() => setLoop((v) => !v)}
          >
            {m.mediaLoop}
          </button>
        </motion.div>
      )}
    </div>
  );
}
