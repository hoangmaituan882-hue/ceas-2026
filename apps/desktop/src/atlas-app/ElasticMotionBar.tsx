import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildLinearFlexPath,
  buildMorphingTrackGeometry,
  clamp01,
  computeElasticBowOffset,
  computeOverstretchOffset,
  computeRadialProgressFromPoint,
  denormalizeBarValue,
  MOTION_BAR_ORANGE,
  MOTION_BAR_ORANGE_ACTIVE,
  normalizeBarValue,
} from "./elastic-motion-bar";

export type ElasticBarSize = "xs" | "sm" | "md" | "lg";

const SIZE_SPECS: Record<
  ElasticBarSize,
  {
    restStroke: number;
    activeStroke: number;
    dotRadius: number;
    svgHeight: number;
    maxBow: number;
    maxStretch: number;
  }
> = {
  xs: {
    restStroke: 7,
    activeStroke: 9,
    dotRadius: 2.35,
    svgHeight: 22,
    maxBow: 4,
    maxStretch: 3.5,
  },
  sm: {
    restStroke: 8,
    activeStroke: 10,
    dotRadius: 2.75,
    svgHeight: 24,
    maxBow: 5,
    maxStretch: 4.5,
  },
  md: {
    restStroke: 10,
    activeStroke: 12.5,
    dotRadius: 3.4,
    svgHeight: 28,
    maxBow: 6.5,
    maxStretch: 5.5,
  },
  lg: {
    restStroke: 12,
    activeStroke: 14.5,
    dotRadius: 4.1,
    svgHeight: 34,
    maxBow: 8,
    maxStretch: 6.5,
  },
};

export interface ElasticMotionBarProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: ElasticBarSize;
  ariaLabel: string;
  testId?: string;
  className?: string;
  width?: number | string;
  onChange: (nextValue: number) => void;
}

/**
 * Tactile Orange Elastic Motion Bar (#F2901B fill, #EEEEEE track, embedded #FFFFFF inner tip dot)
 * with live quadratic Bézier vertical flex, edge rubber-band overstretch, and harmonic spring release.
 */
export function ElasticMotionBar({
  value,
  min,
  max,
  step = 1,
  size = "md",
  ariaLabel,
  testId,
  className = "",
  width,
  onChange,
}: ElasticMotionBarProps) {
  const spec = SIZE_SPECS[size];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(140);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const targetRatio = normalizeBarValue(value, min, max);

  // Spring-driven visual state (zero idle RAF once settled)
  const animRef = useRef({
    ratio: targetRatio,
    ratioVel: 0,
    bowY: 0,
    bowVel: 0,
    targetBowY: 0,
    stretchX: 0,
    stretchVel: 0,
    targetStretchX: 0,
    active: 0,
    activeVel: 0,
    targetActive: 0,
    dragging: false,
    targetRatio,
  });
  const rafRef = useRef<number | null>(null);
  const [, setRenderTick] = useState(0);

  const scheduleSpring = useCallback(() => {
    if (rafRef.current !== null) return;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      const s = animRef.current;

      // 1. Value ratio spring (1:1 immediate while dragging; crisp spring glide on click/keyboard)
      if (s.dragging) {
        s.ratio = s.targetRatio;
        s.ratioVel = 0;
      } else {
        const f = (s.targetRatio - s.ratio) * 340 - s.ratioVel * 26;
        s.ratioVel += f * dt;
        s.ratio += s.ratioVel * dt;
      }

      // 2. Vertical elastic bow spring (slightly underdamped for organic twang on release!)
      const bowStiff = s.dragging ? 420 : 280;
      const bowDamp = s.dragging ? 28 : 15;
      const bowF = (s.targetBowY - s.bowY) * bowStiff - s.bowVel * bowDamp;
      s.bowVel += bowF * dt;
      s.bowY += s.bowVel * dt;

      // 3. Horizontal edge overstretch spring
      const strF = (s.targetStretchX - s.stretchX) * 300 - s.stretchVel * 20;
      s.stretchVel += strF * dt;
      s.stretchX += s.stretchVel * dt;

      // 4. Hover/drag breathing spring (stroke thickness + inner white dot reveal)
      const actF = (s.targetActive - s.active) * 360 - s.activeVel * 26;
      s.activeVel += actF * dt;
      s.active = clamp01(s.active + s.activeVel * dt);

      setRenderTick((t) => (t + 1) & 0xffff);

      const settled =
        !s.dragging &&
        Math.abs(s.targetRatio - s.ratio) < 0.0008 &&
        Math.abs(s.ratioVel) < 0.003 &&
        Math.abs(s.targetBowY - s.bowY) < 0.04 &&
        Math.abs(s.bowVel) < 0.08 &&
        Math.abs(s.targetStretchX - s.stretchX) < 0.04 &&
        Math.abs(s.stretchVel) < 0.08 &&
        Math.abs(s.targetActive - s.active) < 0.005 &&
        Math.abs(s.activeVel) < 0.01;

      if (settled) {
        s.ratio = s.targetRatio;
        s.bowY = s.targetBowY;
        s.stretchX = s.targetStretchX;
        s.active = s.targetActive;
        rafRef.current = null;
        setRenderTick((t) => (t + 1) & 0xffff);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Measure real pixel width so SVG caps & dot remain mathematically circular
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 12) setMeasuredWidth(w);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  useEffect(() => {
    animRef.current.targetRatio = targetRatio;
    scheduleSpring();
  }, [targetRatio, scheduleSpring]);

  useEffect(() => {
    animRef.current.targetActive = hovered || dragging ? 1 : 0;
    scheduleSpring();
  }, [hovered, dragging, scheduleSpring]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number, isDragMove: boolean) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const padX = spec.activeStroke * 0.5 + 2;
      const usableW = Math.max(8, rect.width - padX * 2);
      const rawRatio = (clientX - rect.left - padX) / usableW;
      const clamped = clamp01(rawRatio);
      const nextVal = denormalizeBarValue(clamped, min, max, step);

      const centerY = rect.top + rect.height * 0.5;
      const dy = clientY - centerY;
      animRef.current.targetBowY = isDragMove
        ? computeElasticBowOffset(dy, spec.maxBow)
        : 0;
      animRef.current.targetStretchX = isDragMove
        ? computeOverstretchOffset(rawRatio, spec.maxStretch)
        : 0;
      const nextRatio = normalizeBarValue(nextVal, min, max);
      animRef.current.targetRatio = nextRatio;
      if (animRef.current.dragging) {
        animRef.current.ratio = nextRatio;
        animRef.current.ratioVel = 0;
      }
      scheduleSpring();

      if (nextVal !== value) {
        onChange(nextVal);
      } else {
        setRenderTick((t) => (t + 1) & 0xffff);
      }
    },
    [min, max, step, value, onChange, spec.activeStroke, spec.maxBow, spec.maxStretch, scheduleSpring],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    animRef.current.dragging = true;
    setDragging(true);
    updateFromPointer(e.clientX, e.clientY, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!animRef.current.dragging) return;
    e.stopPropagation();
    updateFromPointer(e.clientX, e.clientY, true);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!animRef.current.dragging) return;
    e.stopPropagation();
    animRef.current.dragging = false;
    animRef.current.targetBowY = 0;
    animRef.current.targetStretchX = 0;
    setDragging(false);
    scheduleSpring();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const bigStep = step * 5;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = Math.min(max, Number((value + step).toFixed(4)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = Math.max(min, Number((value - step).toFixed(4)));
    } else if (e.key === "PageUp") {
      next = Math.min(max, Number((value + bigStep).toFixed(4)));
    } else if (e.key === "PageDown") {
      next = Math.max(min, Number((value - bigStep).toFixed(4)));
    } else if (e.key === "Home") {
      next = min;
    } else if (e.key === "End") {
      next = max;
    }
    if (next !== null) {
      e.preventDefault();
      e.stopPropagation();
      onChange(denormalizeBarValue(normalizeBarValue(next, min, max), min, max, step));
    }
  };

  const s = animRef.current;
  const strokeWidth =
    spec.restStroke + (spec.activeStroke - spec.restStroke) * s.active;
  const padX = spec.activeStroke * 0.5 + 2;
  const centerY = spec.svgHeight * 0.5;
  const geom = buildLinearFlexPath(
    measuredWidth,
    centerY,
    s.ratio,
    s.bowY,
    padX,
  );
  const dotR = spec.dotRadius * (0.72 + 0.28 * s.active);
  const dotOpacity = 0.72 + 0.28 * s.active;
  const fillStrokeColor = dragging ? MOTION_BAR_ORANGE_ACTIVE : MOTION_BAR_ORANGE;

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      data-testid={testId}
      data-value={value}
      data-dragging={dragging ? "true" : "false"}
      className={`emb-root emb-root--${size} ${dragging ? "emb-root--dragging" : ""} ${className}`}
      style={{
        height: `${spec.svgHeight}px`,
        ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
        transform:
          Math.abs(s.stretchX) > 0.05
            ? `translateX(${s.stretchX.toFixed(2)}px)`
            : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <svg
        className="emb-svg"
        width={measuredWidth}
        height={spec.svgHeight}
        viewBox={`0 0 ${measuredWidth} ${spec.svgHeight}`}
        aria-hidden="true"
      >
        {/* Soft Matte Gray Pill Track (#EEEEEE light / subtle translucent dark) */}
        <path
          d={geom.trackD}
          fill="none"
          className="emb-track-path"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Vibrant Tactile Orange Active Fill (#F2901B) */}
        <path
          d={geom.fillD}
          fill="none"
          stroke={fillStrokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Embedded Luminous White Inner Tip Dot (exact video 00:00 / 00:01 / 00:06 signature) */}
        <circle
          cx={geom.tipX}
          cy={geom.tipY}
          r={dotR}
          fill="#FFFFFF"
          opacity={dotOpacity}
        />
      </svg>
    </div>
  );
}

export interface MorphingAudioDialBarProps {
  progress: number;
  isPlaying: boolean;
  formattedTime: string;
  kicker: string;
  playLabel: string;
  pauseLabel: string;
  resetLabel: string;
  scrubLabel: string;
  onTogglePlay: () => void;
  onReset: () => void;
  onSeek: (ratio: number) => void;
}

/**
 * Hero Linear-Bar <-> 360° Circular-Ring Morphing Motion Bar for Audio Playback
 * (Exact structural & color replica of the reference video 00:00 - 00:23:
 *  Paused -> straight horizontal #F2901B bar with flanking circular Play / Reset buttons;
 *  Playing -> continuous constant-length ribbon curl into a 360° #F2901B ring enclosing MM:SS & controls,
 *  with live radial scrubbing right around the ring!).
 */
export function MorphingAudioDialBar({
  progress,
  isPlaying,
  formattedTime,
  kicker,
  playLabel,
  pauseLabel,
  resetLabel,
  scrubLabel,
  onTogglePlay,
  onReset,
  onSeek,
}: MorphingAudioDialBarProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredTrack, setHoveredTrack] = useState(false);
  const [dragging, setDragging] = useState(false);

  const stageW = 360;
  const stageH = 248;
  const cx = stageW * 0.5;
  const ringRadius = 104;
  const ringCy = 124;
  const linearWidth = 304;
  const linearY = 186;

  const animRef = useRef({
    morph: isPlaying ? 1 : 0,
    morphVel: 0,
    targetMorph: isPlaying ? 1 : 0,
    progress: clamp01(progress),
    targetProgress: clamp01(progress),
    dotScale: 0.72,
    dotVel: 0,
    targetDotScale: 0.72,
    dragging: false,
  });
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  const scheduleSpring = useCallback(() => {
    if (rafRef.current !== null) return;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (now - last) / 1000));
      last = now;
      const s = animRef.current;

      // Smooth damped spring for the signature Linear <-> Circular ribbon curl
      const mf = (s.targetMorph - s.morph) * 145 - s.morphVel * 18.5;
      s.morphVel += mf * dt;
      s.morph = Math.max(0, Math.min(1.02, s.morph + s.morphVel * dt));

      // Progress chases smoothly (1:1 instant while dragging)
      if (s.dragging) {
        s.progress = s.targetProgress;
      } else {
        s.progress += (s.targetProgress - s.progress) * Math.min(1, dt * 18);
      }

      // Inner white dot reveal spring
      const df = (s.targetDotScale - s.dotScale) * 280 - s.dotVel * 22;
      s.dotVel += df * dt;
      s.dotScale = Math.max(0, s.dotScale + s.dotVel * dt);

      setTick((t) => (t + 1) & 0xffff);

      const settled =
        !s.dragging &&
        Math.abs(s.targetMorph - s.morph) < 0.0015 &&
        Math.abs(s.morphVel) < 0.004 &&
        Math.abs(s.targetProgress - s.progress) < 0.001 &&
        Math.abs(s.targetDotScale - s.dotScale) < 0.005;

      if (settled) {
        s.morph = s.targetMorph;
        s.progress = s.targetProgress;
        s.dotScale = s.targetDotScale;
        rafRef.current = null;
        setTick((t) => (t + 1) & 0xffff);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    animRef.current.targetMorph = isPlaying ? 1 : 0;
    scheduleSpring();
  }, [isPlaying, scheduleSpring]);

  useEffect(() => {
    animRef.current.targetProgress = clamp01(progress);
    scheduleSpring();
  }, [progress, scheduleSpring]);

  useEffect(() => {
    animRef.current.targetDotScale = hoveredTrack || dragging ? 1 : 0.72;
    scheduleSpring();
  }, [hoveredTrack, dragging, scheduleSpring]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const seekFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sx = ((clientX - rect.left) / Math.max(1, rect.width)) * stageW;
      const sy = ((clientY - rect.top) / Math.max(1, rect.height)) * stageH;
      const s = animRef.current;

      const nextRatio =
        s.morph >= 0.55
          ? computeRadialProgressFromPoint(sx, sy, cx, ringCy)
          : clamp01((sx - (cx - linearWidth * 0.5)) / linearWidth);

      s.targetProgress = nextRatio;
      s.progress = nextRatio;
      scheduleSpring();
      onSeek(nextRatio);
    },
    [onSeek, scheduleSpring],
  );

  const handleTrackPointerDown = (e: React.PointerEvent<SVGPathElement | SVGCircleElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    animRef.current.dragging = true;
    setDragging(true);
    seekFromClientPoint(e.clientX, e.clientY);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!animRef.current.dragging) return;
    e.stopPropagation();
    seekFromClientPoint(e.clientX, e.clientY);
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!animRef.current.dragging) return;
    e.stopPropagation();
    animRef.current.dragging = false;
    setDragging(false);
    scheduleSpring();
  };

  const s = animRef.current;
  const clampedMorph = clamp01(s.morph);
  const geom = buildMorphingTrackGeometry(
    clampedMorph,
    s.progress,
    linearWidth,
    linearY,
    ringRadius,
    cx,
    ringCy,
    76,
  );
  const strokeW = hoveredTrack || dragging ? 13 : 11.5;

  return (
    <div
      className="emb-dial-stage"
      data-testid="ql-audio-morph-dial"
      data-morph-mode={isPlaying ? "ring" : "linear"}
    >
      {/* Continuous Parametric SVG Ribbon: Linear Bar <-> 360° Ring */}
      <svg
        ref={svgRef}
        className="emb-dial-svg"
        width={stageW}
        height={stageH}
        viewBox={`0 0 ${stageW} ${stageH}`}
        role="slider"
        tabIndex={0}
        aria-label={scrubLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.progress * 100)}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek(clamp01(s.progress + 0.05));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek(clamp01(s.progress - 0.05));
          }
        }}
      >
        {/* Wide invisible hit target for effortless scrubbing in both linear & ring modes */}
        <path
          d={geom.trackD}
          fill="none"
          stroke="transparent"
          strokeWidth={34}
          strokeLinecap="round"
          className="emb-dial-hit"
          onMouseEnter={() => setHoveredTrack(true)}
          onMouseLeave={() => setHoveredTrack(false)}
          onPointerDown={handleTrackPointerDown}
        />

        {/* Matte Soft Gray Track (#EEEEEE) */}
        <path
          d={geom.trackD}
          fill="none"
          className="emb-track-path"
          strokeWidth={strokeW}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />

        {/* Vibrant Tactile Orange Progress Arc (#F2901B) */}
        <path
          d={geom.fillD}
          fill="none"
          stroke={dragging ? MOTION_BAR_ORANGE_ACTIVE : MOTION_BAR_ORANGE}
          strokeWidth={strokeW}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />

        {/* Embedded Pure-White Inner Tip Dot */}
        <circle
          cx={geom.tipX}
          cy={geom.tipY}
          r={Math.max(1.8, 3.8 * s.dotScale)}
          fill="#FFFFFF"
          opacity={0.78 + 0.22 * Math.min(1, s.dotScale)}
          className="emb-dial-hit"
          onMouseEnter={() => setHoveredTrack(true)}
          onMouseLeave={() => setHoveredTrack(false)}
          onPointerDown={handleTrackPointerDown}
        />
      </svg>

      {/* Center Readout + Tactile Circular Control Bubbles (morphing layout exactly like video 00:00 -> 00:03) */}
      <div className="emb-dial-center">
        <motion.div
          className="emb-dial-readout"
          animate={{ y: isPlaying ? -16 : -22 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
        >
          <span className="emb-dial-kicker">
            <span className="emb-dial-kicker-dot" aria-hidden="true" />
            <span>{kicker}</span>
          </span>
          <span className="emb-dial-time" data-testid="ql-audio-elapsed">
            {formattedTime}
          </span>
        </motion.div>

        <motion.button
          type="button"
          className="emb-circle-btn emb-circle-btn--play"
          data-testid="ql-audio-play-btn"
          aria-label={isPlaying ? pauseLabel : playLabel}
          animate={{
            x: isPlaying ? -26 : -106,
            y: isPlaying ? 34 : -18,
            scale: isPlaying ? 0.86 : 1,
          }}
          whileHover={{ scale: isPlaying ? 0.92 : 1.05 }}
          whileTap={{ scale: isPlaying ? 0.8 : 0.94 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3.2" y="2.4" width="3.4" height="11.2" rx="1.1" />
              <rect x="9.4" y="2.4" width="3.4" height="11.2" rx="1.1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4.4 2.4L13.4 8L4.4 13.6V2.4Z" />
            </svg>
          )}
        </motion.button>

        <motion.button
          type="button"
          className="emb-circle-btn emb-circle-btn--reset"
          data-testid="ql-audio-reset-btn"
          aria-label={resetLabel}
          title={resetLabel}
          animate={{
            x: isPlaying ? 26 : 106,
            y: isPlaying ? 34 : -18,
            scale: isPlaying ? 0.86 : 1,
          }}
          whileHover={{ scale: isPlaying ? 0.92 : 1.05 }}
          whileTap={{ scale: isPlaying ? 0.8 : 0.94 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          onClick={onReset}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4L3 6.2" />
            <path d="M3 3.2v3h3" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
