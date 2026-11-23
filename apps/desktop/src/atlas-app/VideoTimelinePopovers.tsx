import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AtlasMessages } from "./i18n";
import {
  clampNumber,
  EASING_PRESETS,
  evaluateCubicBezier,
  type CubicBezierCurve,
  type VideoEasingPresetId,
  type VideoEasingSpec,
  type VideoMotionPresetId,
  type VideoTimecodeMode,
} from "./video-editor-engine";

/**
 * Custom eyelid visibility toggle icon matching the studio timeline aesthetic:
 * open arched eye with subtle lashes when visible; closed downward eyelid curve when hidden.
 */
export function EyelidVisibilityIcon({
  hidden,
  size = 13,
}: {
  hidden: boolean;
  size?: number;
}) {
  if (hidden) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.6 6.8c1.4 3.1 3.4 4.4 5.4 4.4s4-1.3 5.4-4.4" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.6 9.8c1.4-3.1 3.4-4.4 5.4-4.4s4 1.3 5.4 4.4" />
      <circle cx="8" cy="9.2" r="1.45" fill="currentColor" stroke="none" />
      <path d="M8 3.2v1.3M4.4 4.4l.8 1M11.6 4.4l-.8 1" strokeWidth="1.25" />
    </svg>
  );
}

export interface EasingCurvePopoverProps {
  easing: VideoEasingSpec;
  m: AtlasMessages;
  onChange: (next: VideoEasingSpec) => void;
  onClose: () => void;
}

const SVG_W = 196;
const SVG_H = 128;
const PAD_X = 20;
const PAD_TOP = 24;
const PAD_BOTTOM = 20;
const BOX_W = SVG_W - PAD_X * 2;
const BOX_H = SVG_H - PAD_TOP - PAD_BOTTOM;

function toSvgX(nx: number): number {
  return PAD_X + nx * BOX_W;
}
function toSvgY(ny: number): number {
  return PAD_TOP + (1 - ny) * BOX_H;
}

export function EasingCurvePopover({
  easing,
  m,
  onChange,
  onClose,
}: EasingCurvePopoverProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<null | "p1" | "p2">(null);
  const [previewProgress, setPreviewProgress] = useState(0);

  // Smooth looping preview dot showing exact easing velocity along the curve
  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const cycleMs = 1750;
    const tick = (now: number) => {
      const phase = ((now - start) % cycleMs) / cycleMs;
      // Hold briefly at start and end so the easing curve is visually unmistakable
      const active = clampNumber((phase - 0.1) / 0.72, 0, 1);
      setPreviewProgress(active);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const [x1, y1, x2, y2] = easing.bezier;

  const updateHandleFromEvent = useCallback(
    (clientX: number, clientY: number, handle: "p1" | "p2") => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const sx = ((clientX - rect.left) / rect.width) * SVG_W;
      const sy = ((clientY - rect.top) / rect.height) * SVG_H;
      const nx = Math.round(clampNumber((sx - PAD_X) / BOX_W, 0, 1) * 100) / 100;
      const ny =
        Math.round(clampNumber(1 - (sy - PAD_TOP) / BOX_H, -0.35, 1.45) * 100) /
        100;
      const nextCurve: CubicBezierCurve =
        handle === "p1" ? [nx, ny, x2, y2] : [x1, y1, nx, ny];
      onChange({ preset: "custom", bezier: nextCurve });
    },
    [onChange, x1, y1, x2, y2],
  );

  const handlePointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    handle: "p1" | "p2",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingHandle(handle);
    const onMove = (ev: PointerEvent) =>
      updateHandleFromEvent(ev.clientX, ev.clientY, handle);
    const onUp = () => {
      setDraggingHandle(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const presetItems: {
    id: Exclude<VideoEasingPresetId, "custom">;
    label: string;
  }[] = [
    { id: "linear", label: m.veEasingLinear },
    { id: "ease-out", label: m.veEasingEaseOut },
    { id: "ease-in-out", label: m.veEasingEaseInOut },
    { id: "expo-out", label: m.veEasingExpoOut },
    { id: "overshoot", label: m.veEasingOvershoot },
  ];

  const easedY = evaluateCubicBezier(previewProgress, easing.bezier);
  const dotX = toSvgX(previewProgress);
  const dotY = toSvgY(easedY);

  const pathD = `M ${toSvgX(0)} ${toSvgY(0)} C ${toSvgX(x1)} ${toSvgY(y1)}, ${toSvgX(x2)} ${toSvgY(y2)}, ${toSvgX(1)} ${toSvgY(1)}`;

  return (
    <motion.div
      className="ve-popover ve-curve-popover"
      data-testid="ve-curve-popover"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ve-sheet-grabber" aria-hidden="true" />
      <div className="ve-popover-head">
        <span className="ve-popover-title">{m.veEasingCurve}</span>
        <div className="ve-popover-head-right">
          <span className="ve-curve-coords">
            {x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)}, {y2.toFixed(2)}
          </span>
          <button
            type="button"
            className="ve-popover-close-btn"
            onClick={onClose}
            aria-label="Close curve editor"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ve-curve-stage">
        <svg
          ref={svgRef}
          className="ve-curve-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-label={m.veEasingCurve}
        >
          {/* Subtle coordinate grid */}
          <rect
            x={PAD_X}
            y={PAD_TOP}
            width={BOX_W}
            height={BOX_H}
            rx="6"
            className="ve-curve-grid-box"
          />
          <line
            x1={toSvgX(0.5)}
            y1={PAD_TOP}
            x2={toSvgX(0.5)}
            y2={PAD_TOP + BOX_H}
            className="ve-curve-grid-line"
          />
          <line
            x1={PAD_X}
            y1={toSvgY(0.5)}
            x2={PAD_X + BOX_W}
            y2={toSvgY(0.5)}
            className="ve-curve-grid-line"
          />
          {/* Linear reference diagonal */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(1)}
            y2={toSvgY(1)}
            className="ve-curve-diagonal"
          />

          {/* Tangent handle stems */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(x1)}
            y2={toSvgY(y1)}
            className="ve-curve-tangent"
          />
          <line
            x1={toSvgX(1)}
            y1={toSvgY(1)}
            x2={toSvgX(x2)}
            y2={toSvgY(y2)}
            className="ve-curve-tangent"
          />

          {/* Main cubic-bezier spline */}
          <path d={pathD} className="ve-curve-path" />

          {/* Live animated easing velocity preview dot */}
          <circle cx={dotX} cy={dotY} r="3.6" className="ve-curve-live-dot" />

          {/* Anchor endpoints */}
          <circle cx={toSvgX(0)} cy={toSvgY(0)} r="3" className="ve-curve-anchor" />
          <circle cx={toSvgX(1)} cy={toSvgY(1)} r="3" className="ve-curve-anchor" />

          {/* Draggable P1 / P2 Bezier Control Handles */}
          <circle
            cx={toSvgX(x1)}
            cy={toSvgY(y1)}
            r={draggingHandle === "p1" ? 6 : 4.8}
            className="ve-curve-handle"
            data-testid="ve-curve-handle-p1"
            onPointerDown={(e) => handlePointerDown(e, "p1")}
          />
          <circle
            cx={toSvgX(x2)}
            cy={toSvgY(y2)}
            r={draggingHandle === "p2" ? 6 : 4.8}
            className="ve-curve-handle"
            data-testid="ve-curve-handle-p2"
            onPointerDown={(e) => handlePointerDown(e, "p2")}
          />
        </svg>

        {/* Horizontal motion velocity preview rail */}
        <div className="ve-curve-rail" aria-hidden="true">
          <div
            className="ve-curve-rail-dot"
            style={{
              left: `${clampNumber(easedY, -0.1, 1.1) * 86 + 7}%`,
            }}
          />
        </div>
      </div>

      <div className="ve-curve-presets">
        {presetItems.map((p) => {
          const active = easing.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`ve-curve-preset-btn ${active ? "ve-curve-preset-btn--active" : ""}`}
              data-testid={`ve-easing-preset-${p.id}`}
              onClick={() => {
                onChange({ preset: p.id, bezier: EASING_PRESETS[p.id] });
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="ve-popover-close-sr"
        onClick={onClose}
        aria-label="Close curve editor"
      />
    </motion.div>
  );
}

export interface MotionPresetsPopoverProps {
  m: AtlasMessages;
  onApplyPreset: (presetId: VideoMotionPresetId, label: string) => void;
  onClose?: () => void;
}

export function MotionPresetsPopover({
  m,
  onApplyPreset,
  onClose,
}: MotionPresetsPopoverProps) {
  const presets: {
    id: VideoMotionPresetId;
    label: string;
    tag: string;
    danger?: boolean;
  }[] = [
    { id: "ken-burns", label: m.vePresetKenBurns, tag: "X · Y · Rot" },
    { id: "cinematic-reveal", label: m.vePresetCinematicReveal, tag: "Expo Out" },
    { id: "micro-zoom", label: m.vePresetMicroZoom, tag: "Spring" },
    { id: "gentle-tilt", label: m.vePresetGentleTilt, tag: "Rotation" },
    { id: "fade-pulse", label: m.vePresetFadePulse, tag: "Opacity" },
    { id: "clear", label: m.vePresetClear, tag: "Reset", danger: true },
  ];

  return (
    <motion.div
      className="ve-popover ve-presets-popover"
      data-testid="ve-presets-popover"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ve-sheet-grabber" aria-hidden="true" />
      <div className="ve-popover-head">
        <span className="ve-popover-title">{m.veMotionPresets}</span>
        {onClose && (
          <button
            type="button"
            className="ve-popover-close-btn"
            onClick={onClose}
            aria-label="Close motion presets"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
      <div className="ve-preset-list">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`ve-preset-row ${p.danger ? "ve-preset-row--danger" : ""}`}
            data-testid={`ve-motion-preset-${p.id}`}
            onClick={() => onApplyPreset(p.id, p.label)}
          >
            <span className="ve-preset-row-name">{p.label}</span>
            <span className="ve-preset-row-tag">{p.tag}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export interface TimecodeModePopoverProps {
  mode: VideoTimecodeMode;
  m: AtlasMessages;
  onSelect: (mode: VideoTimecodeMode) => void;
  onClose?: () => void;
}

export function TimecodeModePopover({
  mode,
  m,
  onSelect,
  onClose,
}: TimecodeModePopoverProps) {
  const options: { id: VideoTimecodeMode; label: string; sample: string }[] = [
    { id: "timecode", label: m.veTimecodeModeTc, sample: "00:03:262" },
    { id: "frames", label: m.veTimecodeModeFrames, sample: "0098f" },
    { id: "seconds", label: m.veTimecodeModeSec, sample: "3.26s" },
  ];

  return (
    <motion.div
      className="ve-popover ve-tc-popover"
      data-testid="ve-timecode-popover"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 480, damping: 34 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ve-sheet-grabber" aria-hidden="true" />
      <div className="ve-popover-head">
        <span className="ve-popover-title">{m.veTimecodeModeLabel}</span>
        {onClose && (
          <button
            type="button"
            className="ve-popover-close-btn"
            onClick={onClose}
            aria-label="Close timecode options"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
      <div className="ve-preset-list">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`ve-preset-row ${mode === opt.id ? "ve-preset-row--active" : ""}`}
            data-testid={`ve-tc-mode-${opt.id}`}
            onClick={() => onSelect(opt.id)}
          >
            <span className="ve-preset-row-name">{opt.label}</span>
            <span className="ve-preset-row-tag ve-tc-sample">{opt.sample}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
