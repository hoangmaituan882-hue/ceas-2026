import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AtomicVideoSlot,
  atomicMediaPlayerManager,
  useAtomicMediaVersion,
} from "./AtomicMediaPlayerHost";
import { HERO_MOTION_EASE } from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import type { LibraryItem, ThemeMode } from "./library-engine";
import {
  appendMediaToTimeline,
  applyMotionPresetToClip,
  buildVideoCssFilter,
  buildVideoPreviewTransform,
  clampNumber,
  computeAutoBrightnessGrade,
  computeTimelineTotalDuration,
  createDefaultVideoEditRecipe,
  DEFAULT_EASING_SPEC,
  deleteClipKeyframe,
  deleteVideoClip,
  duplicateVideoClip,
  evaluateClipKeyframes,
  exportNonDestructiveEdlJson,
  formatShortTimecode,
  formatTimecodeByMode,
  getAspectRatioNumber,
  getClipEffectiveDuration,
  hasNonDestructiveEdits,
  KEYFRAME_BOUNDS,
  KEYFRAME_TRACKS,
  moveClipKeyframe,
  resolveActiveClipAtTime,
  splitVideoClipAtTime,
  trimVideoClipEdge,
  upsertClipKeyframe,
  type VideoAspectRatio,
  type VideoColorGrade,
  type VideoEasingSpec,
  type VideoEditRecipe,
  type VideoKeyframeTrack,
  type VideoMotionPresetId,
  type VideoTimecodeMode,
} from "./video-editor-engine";
import {
  EasingCurvePopover,
  EyelidVisibilityIcon,
  MotionPresetsPopover,
  TimecodeModePopover,
} from "./VideoTimelinePopovers";

export interface VideoNonDestructiveEditorProps {
  item: LibraryItem;
  libraryItems: readonly LibraryItem[];
  theme: ThemeMode;
  locale: AppLocale;
  onSaveRecipe: (itemId: string, recipe: VideoEditRecipe | undefined) => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}

type EditorWorkspaceTab = "studio" | "color" | "motion";

const SPEED_PRESETS = [0.5, 1, 1.5, 2] as const;
const ASPECT_PRESETS: readonly VideoAspectRatio[] = [
  "original",
  "16:9",
  "4:3",
  "1:1",
  "9:16",
];

interface PillSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  signed?: boolean;
  icon: ReactNode;
  testId?: string;
  keyframeActive?: boolean;
  onToggleKeyframe?: () => void;
  onChange: (next: number) => void;
  onCommitHistory?: () => void;
}

/**
 * Signature tactile full-width pill slider matching Reference Image 1:
 * rounded frosted capsule track, soft filled progress bar with vertical thumb notch,
 * icon + label on left, tabular numeric readout on right, double-click to reset.
 */
function StudioPillSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  signed = true,
  icon,
  testId,
  keyframeActive,
  onToggleKeyframe,
  onChange,
  onCommitHistory,
}: PillSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const ratio = max > min ? clampNumber((value - min) / (max - min), 0, 1) : 0;
  const formattedVal = `${signed && value > 0 ? "+" : ""}${Math.round(value)}${suffix}`;

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = clampNumber((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + pct * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(clampNumber(snapped, min, max));
    },
    [min, max, step, onChange],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    draggingRef.current = true;
    onCommitHistory?.();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore capture failure
    }
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore capture release failure
    }
  };

  const handleDoubleClick = () => {
    onCommitHistory?.();
    const neutral = min < 0 && max > 0 ? 0 : max === 100 && min === 0 ? 100 : min;
    onChange(neutral);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = e.shiftKey ? step * 5 : step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onCommitHistory?.();
      onChange(clampNumber(value + delta, min, max));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onCommitHistory?.();
      onChange(clampNumber(value - delta, min, max));
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      data-testid={testId}
      className="ve-pill-slider"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {ratio > 0.01 && (
        <div
          className="ve-pill-slider-fill"
          style={{ width: `calc(${Math.max(10, ratio * 100)}% - 4px)` }}
        >
          <span className="ve-pill-slider-notch" aria-hidden="true" />
        </div>
      )}
      <div className="ve-pill-slider-content">
        <span className="ve-pill-slider-left">
          <span className="ve-pill-slider-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="ve-pill-slider-label">{label}</span>
        </span>
        <span className="ve-pill-slider-right">
          {onToggleKeyframe && (
            <button
              type="button"
              className={`ve-kf-inline-btn ${keyframeActive ? "ve-kf-inline-btn--active" : ""}`}
              aria-label={`Keyframe ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleKeyframe();
              }}
            >
              ◆
            </button>
          )}
          <span className="ve-pill-slider-val">{formattedVal}</span>
        </span>
      </div>
    </div>
  );
}

export function VideoNonDestructiveEditor({
  item,
  libraryItems,
  theme,
  locale,
  onSaveRecipe,
  onClose,
  onNotify,
}: VideoNonDestructiveEditorProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  useAtomicMediaVersion();

  const initialRecipe = useMemo(
    () => item.videoEdit ?? createDefaultVideoEditRecipe(item),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id],
  );

  const [recipe, setRecipe] = useState<VideoEditRecipe>(initialRecipe);
  const [undoStack, setUndoStack] = useState<VideoEditRecipe[]>([]);
  const [redoStack, setRedoStack] = useState<VideoEditRecipe[]>([]);

  const [workspaceTab, setWorkspaceTab] = useState<EditorWorkspaceTab>("studio");
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [cropToolOpen, setCropToolOpen] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [isAnimatingMode, setIsAnimatingMode] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [timecodeMode, setTimecodeMode] = useState<VideoTimecodeMode>("timecode");
  const [activePopover, setActivePopover] = useState<
    null | "curve" | "presets" | "timecode"
  >(null);
  const [timelineZoom, setTimelineZoom] = useState(1);

  const [selectedClipId, setSelectedClipId] = useState<string>(
    () => initialRecipe.clips[0]?.id ?? "",
  );
  const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeKeyframeTrack, setActiveKeyframeTrack] =
    useState<VideoKeyframeTrack>("positionX");
  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    clipId: string;
    track: VideoKeyframeTrack;
    keyframeId: string;
  } | null>(null);
  const [audioSelected, setAudioSelected] = useState(false);

  const totalDuration = useMemo(
    () => computeTimelineTotalDuration(recipe),
    [recipe],
  );
  const [playheadSec, setPlayheadSec] = useState<number>(() => {
    const snap = atomicMediaPlayerManager.getPlaybackState(item.id);
    return snap ? clampNumber(snap.elapsed, 0, totalDuration) : 0;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const playheadRef = useRef(playheadSec);
  playheadRef.current = playheadSec;
  const loopPlaybackRef = useRef(loopPlayback);
  loopPlaybackRef.current = loopPlayback;
  const activePopoverRef = useRef(activePopover);
  activePopoverRef.current = activePopover;
  const tracksAreaRef = useRef<HTMLDivElement | null>(null);
  const rulerAreaRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);

  const pushHistorySnapshot = useCallback((snapshot?: VideoEditRecipe) => {
    const base = snapshot ?? recipeRef.current;
    setUndoStack((prev) => [...prev.slice(-29), base]);
    setRedoStack([]);
  }, []);

  const commitRecipeChange = useCallback(
    (updater: (prev: VideoEditRecipe) => VideoEditRecipe, recordHistory = true) => {
      setRecipe((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (recordHistory) {
          setUndoStack((u) => [...u.slice(-29), prev]);
          setRedoStack([]);
        }
        return next;
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      setRedoStack((r) => [...r.slice(-29), recipeRef.current]);
      setRecipe(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1]!;
      setUndoStack((u) => [...u.slice(-29), recipeRef.current]);
      setRecipe(next);
      return prev.slice(0, -1);
    });
  }, []);

  const activeResolution = useMemo(
    () => resolveActiveClipAtTime(recipe, playheadSec),
    [recipe, playheadSec],
  );

  const selectedClip = useMemo(
    () =>
      recipe.clips.find((c) => c.id === selectedClipId) ??
      activeResolution?.clip ??
      recipe.clips[0] ??
      null,
    [recipe.clips, selectedClipId, activeResolution],
  );

  const activeEasing: VideoEasingSpec = recipe.easing ?? DEFAULT_EASING_SPEC;

  // Evaluate live keyframed transform at the current playhead using active cubic-bezier easing
  const evaluatedKf = useMemo(() => {
    if (!activeResolution) {
      return { positionX: 0, positionY: 0, opacity: 100, rotation: 0 };
    }
    return evaluateClipKeyframes(
      activeResolution.clip,
      activeResolution.localTimeSec,
      activeEasing.bezier,
    );
  }, [activeResolution, activeEasing.bezier]);

  // Keep underlying atomic player synced to our non-destructive playhead & play state
  useEffect(() => {
    if (!activeResolution) return;
    if (activeResolution.clip.sourceItemId === item.id) {
      atomicMediaPlayerManager.sendCommand(
        item.id,
        isPlaying ? "play" : "pause",
      );
      if (!isPlaying) {
        atomicMediaPlayerManager.sendCommand(
          item.id,
          "seek",
          activeResolution.sourceTimeSec,
        );
      }
    } else {
      atomicMediaPlayerManager.sendCommand(item.id, "pause");
    }
  }, [isPlaying, activeResolution?.clip.sourceItemId, activeResolution?.sourceTimeSec, item.id]);

  // Smooth 60fps RAF playback clock advancing across multi-clip timeline
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      const curRecipe = recipeRef.current;
      const total = computeTimelineTotalDuration(curRecipe);
      const workStart = clampNumber(curRecipe.workArea.startSec, 0, total);
      const workEnd = clampNumber(
        curRecipe.workArea.endSec,
        Math.min(total, workStart + 0.5),
        total,
      );

      let nextTime = playheadRef.current + dt;
      if (nextTime >= workEnd || nextTime >= total) {
        if (loopPlaybackRef.current) {
          nextTime = workStart;
        } else {
          playheadRef.current = Math.min(workEnd, total);
          setPlayheadSec(playheadRef.current);
          setIsPlaying(false);
          return;
        }
      }
      playheadRef.current = nextTime;
      setPlayheadSec(nextTime);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Clamp playhead if trimming shortened total duration
  useEffect(() => {
    if (playheadSec > totalDuration) {
      setPlayheadSec(totalDuration);
    }
  }, [totalDuration, playheadSec]);

  const handleSplitAtPlayhead = useCallback(() => {
    const res = splitVideoClipAtTime(recipeRef.current, playheadRef.current);
    if (!res.newClipId) return;
    pushHistorySnapshot(recipeRef.current);
    setRecipe(res.recipe);
    setSelectedClipId(res.newClipId);
    onNotify(m.veToastSplit);
  }, [pushHistorySnapshot, onNotify, m.veToastSplit]);

  const handleAddKeyframeAllAtPlayhead = useCallback(() => {
    const resolved = resolveActiveClipAtTime(recipeRef.current, playheadRef.current);
    if (!resolved) return;
    const evalNow = evaluateClipKeyframes(resolved.clip, resolved.localTimeSec);
    commitRecipeChange((prev) => {
      let next = prev;
      for (const track of KEYFRAME_TRACKS) {
        next = upsertClipKeyframe(
          next,
          resolved.clip.id,
          track,
          resolved.localTimeSec,
          evalNow[track],
        );
      }
      return next;
    });
    setExpandedClipIds((prev) => {
      const next = new Set(prev);
      next.add(resolved.clip.id);
      return next;
    });
  }, [commitRecipeChange]);

  const handleSaveAndClose = useCallback(() => {
    const modified = hasNonDestructiveEdits(recipeRef.current, item);
    onSaveRecipe(item.id, modified ? recipeRef.current : undefined);
    onNotify(m.veToastSaved);
    onClose();
  }, [item, onSaveRecipe, onNotify, m.veToastSaved, onClose]);

  const handleResetAll = useCallback(() => {
    const fresh = createDefaultVideoEditRecipe(item);
    pushHistorySnapshot(recipeRef.current);
    setRecipe(fresh);
    setSelectedClipId(fresh.clips[0]?.id ?? "");
    setExpandedClipIds(new Set());
    setPlayheadSec(0);
    setCompareOriginal(false);
    setIsAnimatingMode(false);
    onSaveRecipe(item.id, undefined);
    onNotify(m.veToastReset);
  }, [item, pushHistorySnapshot, onSaveRecipe, onNotify, m.veToastReset]);

  const handleExportRecipe = useCallback(() => {
    const json = exportNonDestructiveEdlJson(item, recipeRef.current);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.filename.replace(/\.[^.]+$/, "")}.atlas-edit.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // ignore download restriction in sandbox
    }
    onNotify(m.veToastExportedRecipe);
  }, [item, onNotify, m.veToastExportedRecipe]);

  // Keyboard shortcuts inside studio editor (capture phase so QuickLook doesn't close on Space/Esc!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (activePopoverRef.current !== null) {
          setActivePopover(null);
          return;
        }
        handleSaveAndClose();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setIsPlaying((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        handleSplitAtPlayhead();
        return;
      }
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        handleAddKeyframeAllAtPlayhead();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setIsPlaying(false);
        setPlayheadSec((t) => clampNumber(t - (e.shiftKey ? 1 : 0.1), 0, totalDuration));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setIsPlaying(false);
        setPlayheadSec((t) => clampNumber(t + (e.shiftKey ? 1 : 0.1), 0, totalDuration));
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    handleSaveAndClose,
    handleUndo,
    handleRedo,
    handleSplitAtPlayhead,
    handleAddKeyframeAllAtPlayhead,
    totalDuration,
  ]);

  const updateGradeField = useCallback(
    <K extends keyof VideoColorGrade>(key: K, value: VideoColorGrade[K]) => {
      setRecipe((prev) => ({
        ...prev,
        grade: {
          ...prev.grade,
          enabled: true,
          autoBrightness:
            key === "brightness" || key === "contrast" || key === "exposure"
              ? false
              : prev.grade.autoBrightness,
          [key]: value,
        },
        updatedAt: Date.now(),
      }));
    },
    [],
  );

  const updateKeyframeValue = useCallback(
    (track: VideoKeyframeTrack, nextValue: number) => {
      const targetClip = selectedClip;
      if (!targetClip) return;
      const resolved = resolveActiveClipAtTime(recipeRef.current, playheadRef.current);
      const localSec =
        resolved && resolved.clip.id === targetClip.id
          ? resolved.localTimeSec
          : 0;
      setRecipe((prev) =>
        upsertClipKeyframe(prev, targetClip.id, track, localSec, nextValue),
      );
      if (isAnimatingMode) {
        setExpandedClipIds((prev) => {
          const next = new Set(prev);
          next.add(targetClip.id);
          return next;
        });
      }
    },
    [selectedClip, isAnimatingMode],
  );

  const seekByClientX = useCallback(
    (clientX: number, containerEl: HTMLElement | null) => {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = clampNumber((clientX - rect.left) / rect.width, 0, 1);
      let nextTime = pct * totalDuration;
      if (snapEnabled) {
        let cursor = 0;
        for (const c of recipeRef.current.clips) {
          if (Math.abs(nextTime - cursor) < 0.18) {
            nextTime = cursor;
            break;
          }
          cursor += getClipEffectiveDuration(c);
          if (Math.abs(nextTime - cursor) < 0.18) {
            nextTime = cursor;
            break;
          }
        }
      }
      setPlayheadSec(clampNumber(nextTime, 0, totalDuration));
    },
    [totalDuration, snapEnabled],
  );

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPlaying(false);
    setActivePopover(null);
    const trackBox = rulerAreaRef.current ?? tracksAreaRef.current;
    seekByClientX(e.clientX, trackBox);

    const onMove = (ev: PointerEvent) => seekByClientX(ev.clientX, trackBox);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleApplyMotionPreset = useCallback(
    (presetId: VideoMotionPresetId, label: string) => {
      const targetClip = selectedClip;
      if (!targetClip) return;
      commitRecipeChange((prev) =>
        applyMotionPresetToClip(prev, targetClip.id, presetId),
      );
      setActivePopover(null);
      if (presetId !== "clear") {
        setWorkspaceTab("motion");
        setPanelMinimized(false);
        setExpandedClipIds((prev) => new Set(prev).add(targetClip.id));
        onNotify(m.veToastPresetApplied(label));
      } else {
        onNotify(label);
      }
    },
    [selectedClip, commitRecipeChange, onNotify, m],
  );

  const handleUpdateEasing = useCallback(
    (nextEasing: VideoEasingSpec) => {
      setRecipe((prev) => ({
        ...prev,
        easing: nextEasing,
        updatedAt: Date.now(),
      }));
    },
    [],
  );

  const handleStartTrim = (
    e: React.PointerEvent<HTMLDivElement>,
    clipId: string,
    edge: "start" | "end",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const trackBox = tracksAreaRef.current;
    if (!trackBox) return;
    const widthPx = Math.max(120, trackBox.getBoundingClientRect().width);
    const startX = e.clientX;
    const baseRecipe = recipeRef.current;
    const baseDuration = computeTimelineTotalDuration(baseRecipe);
    pushHistorySnapshot(baseRecipe);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = (dx / widthPx) * baseDuration;
      setRecipe(trimVideoClipEdge(baseRecipe, clipId, edge, deltaSec));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleStartKeyframeDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    clipId: string,
    track: VideoKeyframeTrack,
    keyframeId: string,
    clipDurSec: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const laneEl = e.currentTarget.parentElement;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();
    const baseRecipe = recipeRef.current;
    pushHistorySnapshot(baseRecipe);
    setSelectedKeyframe({ clipId, track, keyframeId });

    const onMove = (ev: PointerEvent) => {
      const pct = clampNumber(
        (ev.clientX - laneRect.left) / Math.max(1, laneRect.width),
        0,
        1,
      );
      setRecipe(
        moveClipKeyframe(baseRecipe, clipId, track, keyframeId, pct * clipDurSec),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const mediaBinItems = useMemo(
    () =>
      libraryItems
        .filter(
          (it) =>
            !it.trashed &&
            (it.kind === "video" || it.kind === "image" || it.kind === "link"),
        )
        .slice(0, 13),
    [libraryItems],
  );

  const previewCssFilter = useMemo(
    () => buildVideoCssFilter(recipe.grade, compareOriginal),
    [recipe.grade, compareOriginal],
  );
  const previewTransform = useMemo(() => {
    const base = buildVideoPreviewTransform(
      recipe.transform,
      evaluatedKf,
      compareOriginal,
    );
    if (compareOriginal || base === "none") return base;
    const hasMotionOffset =
      Math.abs(evaluatedKf.positionX) > 0.5 ||
      Math.abs(evaluatedKf.positionY) > 0.5 ||
      Math.abs(evaluatedKf.rotation) > 0.2;
    return hasMotionOffset ? `scale(1.09) ${base}` : base;
  }, [recipe.transform, evaluatedKf, compareOriginal]);
  const previewOpacity = compareOriginal
    ? 1
    : activeResolution?.clip.hidden
      ? 0.12
      : clampNumber(evaluatedKf.opacity / 100, 0, 1);

  const previewAspect = getAspectRatioNumber(
    recipe.transform.aspectRatio,
    item.width,
    item.height,
  );
  const isModified = useMemo(
    () => hasNonDestructiveEdits(recipe, item),
    [recipe, item],
  );
  const playheadPct =
    totalDuration > 0 ? clampNumber((playheadSec / totalDuration) * 100, 0, 100) : 0;

  const currentSpeed = selectedClip?.speed ?? 1;
  const speedRingRatio = clampNumber(currentSpeed / 2, 0.2, 1);
  const speedRingCircumference = 2 * Math.PI * 12;

  // Compute clean time ruler ticks based on totalDuration & timelineZoom
  const rulerTicks = useMemo(() => {
    const step = totalDuration <= 10 ? 1 : totalDuration <= 24 ? 2 : 5;
    const ticks: number[] = [];
    for (let t = 0; t <= totalDuration + 0.01; t += step) {
      ticks.push(Math.min(totalDuration, Math.round(t * 10) / 10));
    }
    return ticks;
  }, [totalDuration]);

  // Compute clip timeline spans in percentages
  const clipLayouts = useMemo(() => {
    let cursor = 0;
    return recipe.clips.map((clip) => {
      const dur = getClipEffectiveDuration(clip);
      const startSec = cursor;
      cursor += dur;
      return {
        clip,
        startSec,
        dur,
        leftPct: (startSec / totalDuration) * 100,
        widthPct: (dur / totalDuration) * 100,
      };
    });
  }, [recipe.clips, totalDuration]);

  const activeClipIsPrimary =
    !activeResolution || activeResolution.clip.sourceItemId === item.id;

  const trackLabelMap: Record<VideoKeyframeTrack, string> = {
    positionX: m.vePositionX,
    positionY: m.vePositionY,
    opacity: m.veOpacity,
    rotation: m.veRotation,
  };

  const easingLabelMap: Record<VideoEasingSpec["preset"], string> = {
    linear: m.veEasingLinear,
    "ease-out": m.veEasingEaseOut,
    "ease-in-out": m.veEasingEaseInOut,
    "expo-out": m.veEasingExpoOut,
    overshoot: m.veEasingOvershoot,
    custom: "Bezier",
  };

  const sfxTracks = recipe.sfxTracks ?? [];
  const isKeyframesOpen = Boolean(
    selectedClip && expandedClipIds.has(selectedClip.id),
  );

  // Split formatted timecode so leading "00:" can be muted just like the studio reference
  const formattedTimecode = formatTimecodeByMode(playheadSec, timecodeMode);
  const tcParts =
    timecodeMode === "timecode" && formattedTimecode.includes(":")
      ? {
          prefix: `${formattedTimecode.slice(0, 3)}`,
          main: formattedTimecode.slice(3),
        }
      : { prefix: "", main: formattedTimecode };

  return (
    <motion.div
      className="ve-studio-root"
      data-testid="video-non-destructive-editor"
      data-atlas-theme={theme}
      data-mobile-tab={workspaceTab}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.24, ease: HERO_MOTION_EASE }}
      onClick={(e) => {
        e.stopPropagation();
        if (activePopover !== null) setActivePopover(null);
      }}
    >
      {/* Subtle ambient aura echoing active clip without muddying Atlas porcelain surface */}
      <div
        className="ve-ambient-backdrop"
        aria-hidden="true"
        style={{ backgroundImage: `url(${activeResolution?.clip.posterSrc ?? item.src})` }}
      />
      <div className="ve-ambient-veil" aria-hidden="true" />

      {/* ── Unified Atlas Web-Software Studio Topbar ─────────────── */}
      <header className="ve-topbar">
        <div className="ve-topbar-left">
          <button
            type="button"
            className="ve-ghost-btn ve-back-btn"
            data-testid="ve-back-btn"
            onClick={handleSaveAndClose}
            aria-label={m.veBackQuickLook}
            title={m.veBackQuickLook}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3.5L5.5 8l4.5 4.5" />
            </svg>
          </button>
          <div className="ve-title-block">
            <span className="ve-filename">
              {item.filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".mp4")}
            </span>
            <span className="ve-submeta">
              {isModified ? m.videoEditedTag : m.qlVideo} · {recipe.clips.length} {recipe.clips.length === 1 ? "clip" : "clips"} · {formatShortTimecode(totalDuration)}
            </span>
          </div>
        </div>

        {/* Centered floating workspace pill with spring layoutId sliding capsule */}
        <nav className="ve-center-nav" aria-label="Video studio modes">
          {(
            [
              ["studio", m.veTabEdit],
              ["color", m.veTabColor],
              ["motion", m.veTabMotion],
            ] as const
          ).map(([tabId, label]) => {
            const isActive = workspaceTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                className={`ve-center-tab ${isActive ? "ve-center-tab--active" : ""}`}
                data-testid={`ve-tab-${tabId}`}
                onClick={() => {
                  setWorkspaceTab(tabId);
                  setPanelMinimized(false);
                  if (tabId === "motion" && selectedClip) {
                    setExpandedClipIds((prev) => new Set(prev).add(selectedClip.id));
                  }
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="ve-active-tab-pill"
                    className="ve-tab-pill-bg"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    aria-hidden="true"
                  />
                )}
                <span className="ve-center-tab-label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ve-topbar-right">
          <button
            type="button"
            className="ve-ghost-btn"
            data-testid="ve-undo-btn"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title={`${m.veUndo} (⌘Z)`}
            aria-label={m.veUndo}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 4L2.5 7l3 3" />
              <path d="M3 7h7a3.5 3.5 0 1 1 0 7H7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="ve-ghost-btn"
            data-testid="ve-redo-btn"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            title={`${m.veRedo} (⇧⌘Z)`}
            aria-label={m.veRedo}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 4l3 3-3 3" />
              <path d="M13 7H6a3.5 3.5 0 1 0 0 7h2.5" />
            </svg>
          </button>

          <button
            type="button"
            className={`ve-text-btn ve-compare-btn ${compareOriginal ? "ve-text-btn--active" : ""}`}
            data-testid="ve-compare-btn"
            onPointerDown={() => setCompareOriginal(true)}
            onPointerUp={() => setCompareOriginal(false)}
            onPointerLeave={() => setCompareOriginal(false)}
            onClick={() => setCompareOriginal((v) => !v)}
          >
            {compareOriginal ? m.veOriginalActive : m.veCompareOriginal}
          </button>

          <button
            type="button"
            className="ve-text-btn ve-reset-btn"
            data-testid="ve-reset-btn"
            disabled={!isModified}
            onClick={handleResetAll}
          >
            {m.veResetAll}
          </button>

          <button
            type="button"
            className="ve-primary-btn"
            data-testid="ve-done-btn"
            onClick={handleSaveAndClose}
          >
            {m.veDoneSave}
          </button>
        </div>
      </header>

      {/* ── Upper 3-Column Studio Stage (1:1 Reference Image 1) ──── */}
      <section className="ve-stage-section">
        <div className="ve-stage-grid">
          {/* Left Floating 7-Button Vertical Tool Rail */}
          <div className="ve-left-rail" role="toolbar" aria-label="Quick edit tools">
            {/* 1. Circular Speed Ring Indicator (echoing Image 1's 43% ring) */}
            <button
              type="button"
              className={`ve-rail-btn ve-rail-btn--ring ${currentSpeed !== 1 ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-speed"
              title={`${m.veToolSpeed}: ${currentSpeed}×`}
              aria-label={m.veToolSpeed}
              onClick={() => {
                if (!selectedClip) return;
                const nextIdx =
                  (SPEED_PRESETS.indexOf(currentSpeed as (typeof SPEED_PRESETS)[number]) + 1) %
                  SPEED_PRESETS.length;
                const nextSpeed = SPEED_PRESETS[nextIdx] ?? 1;
                commitRecipeChange((prev) => ({
                  ...prev,
                  clips: prev.clips.map((c) =>
                    c.id === selectedClip.id ? { ...c, speed: nextSpeed } : c,
                  ),
                  updatedAt: Date.now(),
                }));
              }}
            >
              <svg className="ve-ring-svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.2" />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray={speedRingCircumference}
                  strokeDashoffset={speedRingCircumference * (1 - speedRingRatio)}
                  transform="rotate(-90 16 16)"
                />
              </svg>
              <span className="ve-ring-label">{currentSpeed}×</span>
            </button>

            {/* 2. Crop / Aspect Ratio */}
            <button
              type="button"
              className={`ve-rail-btn ${cropToolOpen || recipe.transform.aspectRatio !== "original" ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-crop"
              title={m.veToolCrop}
              aria-label={m.veToolCrop}
              onClick={() => setCropToolOpen((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 2v9.5H14" />
                <path d="M2 4.5h9.5V14" />
              </svg>
            </button>

            {/* 3. Rotate 90° */}
            <button
              type="button"
              className={`ve-rail-btn ${recipe.transform.rotationDeg !== 0 ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-rotate"
              title={m.veToolRotate}
              aria-label={m.veToolRotate}
              onClick={() => {
                commitRecipeChange((prev) => ({
                  ...prev,
                  transform: {
                    ...prev.transform,
                    rotationDeg: (((prev.transform.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270),
                  },
                  updatedAt: Date.now(),
                }));
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.5 6.5A4.8 4.8 0 1 0 12.2 10" />
                <path d="M12.8 3.3v3.3H9.5" />
              </svg>
            </button>

            {/* 4. Flip Horizontal */}
            <button
              type="button"
              className={`ve-rail-btn ${recipe.transform.flipH ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-flip"
              title={m.veToolFlip}
              aria-label={m.veToolFlip}
              onClick={() => {
                commitRecipeChange((prev) => ({
                  ...prev,
                  transform: { ...prev.transform, flipH: !prev.transform.flipH },
                  updatedAt: Date.now(),
                }));
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2.5v11" strokeDasharray="2 2" />
                <path d="M6 4.5L2.5 8 6 11.5V4.5z" />
                <path d="M10 4.5L13.5 8 10 11.5V4.5z" />
              </svg>
            </button>

            {/* 5. Color Adjust Focus */}
            <button
              type="button"
              className={`ve-rail-btn ${!panelMinimized && workspaceTab !== "motion" ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-grade"
              title={m.veToolGrade}
              aria-label={m.veToolGrade}
              onClick={() => {
                setWorkspaceTab("color");
                setPanelMinimized(false);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="5" />
                <path d="M8 3v10" />
                <path d="M8 8h5" />
              </svg>
            </button>

            {/* 6. Keyframes Motion Toggle */}
            <button
              type="button"
              className={`ve-rail-btn ${workspaceTab === "motion" || (selectedClip && expandedClipIds.has(selectedClip.id)) ? "ve-rail-btn--active" : ""}`}
              data-testid="ve-tool-keyframes"
              title={m.veToolKeyframes}
              aria-label={m.veToolKeyframes}
              onClick={() => {
                setWorkspaceTab("motion");
                setPanelMinimized(false);
                if (selectedClip) {
                  setExpandedClipIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(selectedClip.id)) next.delete(selectedClip.id);
                    else next.add(selectedClip.id);
                    return next;
                  });
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M8 2.4L13.6 8 8 13.6 2.4 8 8 2.4z" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {/* 7. Export Non-Destructive Recipe */}
            <button
              type="button"
              className="ve-rail-btn"
              data-testid="ve-tool-export"
              title={m.veToolExportRecipe}
              aria-label={m.veToolExportRecipe}
              onClick={handleExportRecipe}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10.5V2.5" />
                <path d="M5 5.5L8 2.5l3 3" />
                <path d="M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
              </svg>
            </button>
          </div>

          {/* Center Rounded Video Preview Frame */}
          <div className="ve-preview-column">
            <div
              className="ve-preview-frame"
              data-testid="ve-preview-frame"
              style={{
                aspectRatio: `${Math.max(0.56, Math.min(2.2, previewAspect))}`,
              }}
            >
              <div
                className="ve-preview-media-layer"
                data-testid="ve-preview-media-layer"
                style={{
                  filter: previewCssFilter,
                  transform: previewTransform,
                  opacity: previewOpacity,
                }}
              >
                {activeClipIsPrimary ? (
                  <AtomicVideoSlot item={item} slotKind="quicklook" autoActivate />
                ) : (
                  <img
                    src={activeResolution?.clip.posterSrc ?? item.src}
                    alt={activeResolution?.clip.title ?? item.title}
                    className="ve-broll-preview-img"
                    draggable={false}
                  />
                )}
              </div>

              {/* Rule-of-thirds crop guide overlay when Crop tool is active */}
              {cropToolOpen && (
                <div className="ve-crop-guides" aria-hidden="true">
                  <span className="ve-crop-line ve-crop-line--v1" />
                  <span className="ve-crop-line ve-crop-line--v2" />
                  <span className="ve-crop-line ve-crop-line--h1" />
                  <span className="ve-crop-line ve-crop-line--h2" />
                </div>
              )}

              {/* Subtle Original comparison label when holding Compare */}
              {compareOriginal && (
                <div className="ve-compare-flag">{m.veOriginalActive}</div>
              )}

              {/* Aspect ratio bar when Crop tool is toggled */}
              <AnimatePresence>
                {cropToolOpen && (
                  <motion.div
                    className="ve-crop-pill-bar"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                  >
                    {ASPECT_PRESETS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        className={`ve-crop-option ${recipe.transform.aspectRatio === ratio ? "ve-crop-option--active" : ""}`}
                        onClick={() => {
                          commitRecipeChange((prev) => ({
                            ...prev,
                            transform: { ...prev.transform, aspectRatio: ratio },
                            updatedAt: Date.now(),
                          }));
                        }}
                      >
                        {ratio === "original" ? m.veAspectOriginal : ratio}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* In-Frame Bottom Glass Scrubber (1:1 Reference Image 1) */}
              <div className="ve-inframe-scrubber">
                <button
                  type="button"
                  className="ve-inframe-play"
                  data-testid="ve-inframe-play-btn"
                  aria-label={isPlaying ? m.mediaPause : m.mediaPlay}
                  onClick={() => setIsPlaying((v) => !v)}
                >
                  {isPlaying ? (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                      <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                      <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3 1.7L10.2 6 3 10.3V1.7z" />
                    </svg>
                  )}
                </button>
                <span className="ve-inframe-time">{formatShortTimecode(playheadSec)}</span>
                <div
                  ref={scrubRef}
                  className="ve-inframe-track"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setIsPlaying(false);
                    const box = scrubRef.current;
                    seekByClientX(e.clientX, box);
                    const onMove = (ev: PointerEvent) => seekByClientX(ev.clientX, box);
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                >
                  <div
                    className="ve-inframe-track-fill"
                    style={{ width: `${playheadPct}%` }}
                  />
                </div>
                <span className="ve-inframe-time ve-inframe-time--dim">
                  {formatShortTimecode(totalDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Floating Glass Adjustment Panel (1:1 Reference Image 1) */}
          <aside className={`ve-right-panel ${panelMinimized ? "ve-right-panel--min" : ""}`}>
            <div className="ve-panel-top-row">
              <span className="ve-mobile-panel-heading">
                {workspaceTab === "motion" ? m.veTabMotion : m.veTabColor}
              </span>
              <div className="ve-panel-top-actions">
                <button
                  type="button"
                  className="ve-mobile-reset-btn"
                  disabled={!isModified}
                  onClick={handleResetAll}
                >
                  {m.veResetAll}
                </button>
                <button
                  type="button"
                  className="ve-minimize-btn"
                  data-testid="ve-minimize-panel-btn"
                  onClick={() => setPanelMinimized((v) => !v)}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    {panelMinimized ? (
                      <path d="M8.5 2.5H11.5V5.5M5.5 11.5H2.5V8.5M11.5 2.5L7.8 6.2M2.5 11.5L6.2 7.8" />
                    ) : (
                      <path d="M9.5 4.5L12 2M9.5 4.5H12M9.5 4.5V2M4.5 9.5L2 12M4.5 9.5H2M4.5 9.5V12" />
                    )}
                  </svg>
                  <span>{panelMinimized ? m.veExpand : m.veMinimize}</span>
                </button>
              </div>
            </div>

            {!panelMinimized && (
              <div className="ve-panel-body">
                {workspaceTab !== "motion" ? (
                  <>
                    {/* Top Dual Frosted Action Pills: Auto Brightness & Upscale */}
                    <div className="ve-dual-actions">
                      <button
                        type="button"
                        className={`ve-action-pill ${recipe.grade.autoBrightness ? "ve-action-pill--active" : ""}`}
                        data-testid="ve-auto-brightness-btn"
                        onClick={() => {
                          commitRecipeChange((prev) => ({
                            ...prev,
                            grade: computeAutoBrightnessGrade(prev.grade),
                            updatedAt: Date.now(),
                          }));
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round">
                          <circle cx="8" cy="8" r="3" />
                          <path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1" />
                        </svg>
                        <span>{m.veAutoBrightness}</span>
                      </button>

                      <button
                        type="button"
                        className={`ve-action-pill ${recipe.grade.upscale ? "ve-action-pill--active" : ""}`}
                        data-testid="ve-upscale-btn"
                        onClick={() => {
                          commitRecipeChange((prev) => ({
                            ...prev,
                            grade: {
                              ...prev.grade,
                              enabled: true,
                              upscale: !prev.grade.upscale,
                            },
                            updatedAt: Date.now(),
                          }));
                        }}
                      >
                        <span className="ve-hd-glyph" aria-hidden="true">HD</span>
                        <span>{m.veUpscale}</span>
                      </button>
                    </div>

                    {/* 4 Signature Pill Sliders matching Reference Image 1 */}
                    <div className="ve-sliders-stack">
                      <StudioPillSlider
                        label={m.veBrightness}
                        value={recipe.grade.brightness}
                        min={-50}
                        max={50}
                        testId="ve-slider-brightness"
                        onCommitHistory={() => pushHistorySnapshot()}
                        onChange={(v) => updateGradeField("brightness", v)}
                        icon={
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="8" cy="8" r="2.8" fill="currentColor" />
                            <path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" />
                          </svg>
                        }
                      />

                      <StudioPillSlider
                        label={m.veContrast}
                        value={recipe.grade.contrast}
                        min={-50}
                        max={50}
                        testId="ve-slider-contrast"
                        onCommitHistory={() => pushHistorySnapshot()}
                        onChange={(v) => updateGradeField("contrast", v)}
                        icon={
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="8" cy="8" r="5" />
                            <path d="M8 3a5 5 0 0 1 0 10V3z" fill="currentColor" stroke="none" />
                          </svg>
                        }
                      />

                      <StudioPillSlider
                        label={m.veBlur}
                        value={recipe.grade.blur}
                        min={0}
                        max={24}
                        signed={false}
                        testId="ve-slider-blur"
                        onCommitHistory={() => pushHistorySnapshot()}
                        onChange={(v) => updateGradeField("blur", v)}
                        icon={
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="3.5" r="1.2" opacity="0.9" />
                            <circle cx="8" cy="8" r="1.6" />
                            <circle cx="8" cy="12.5" r="1.2" opacity="0.6" />
                            <circle cx="3.8" cy="8" r="1.2" opacity="0.6" />
                            <circle cx="12.2" cy="8" r="1.2" opacity="0.9" />
                          </svg>
                        }
                      />

                      <StudioPillSlider
                        label={m.veSaturation}
                        value={recipe.grade.saturation}
                        min={-100}
                        max={100}
                        testId="ve-slider-saturation"
                        onCommitHistory={() => pushHistorySnapshot()}
                        onChange={(v) => updateGradeField("saturation", v)}
                        icon={
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 2.5C6.2 5.4 4.2 7.5 4.2 9.8a3.8 3.8 0 0 0 7.6 0c0-2.3-2-4.4-3.8-7.3z" />
                            <path d="M8 4v9.5a3.7 3.7 0 0 0 3.7-3.7c0-2-1.8-3.8-3.7-5.8z" fill="currentColor" stroke="none" />
                          </svg>
                        }
                      />

                      {workspaceTab === "color" && (
                        <>
                          <StudioPillSlider
                            label={m.veExposure}
                            value={recipe.grade.exposure}
                            min={-50}
                            max={50}
                            testId="ve-slider-exposure"
                            onCommitHistory={() => pushHistorySnapshot()}
                            onChange={(v) => updateGradeField("exposure", v)}
                            icon={
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" />
                                <path d="M4.5 11.5l7-7" />
                              </svg>
                            }
                          />
                          <StudioPillSlider
                            label={m.veWarmth}
                            value={recipe.grade.warmth}
                            min={-50}
                            max={50}
                            testId="ve-slider-warmth"
                            onCommitHistory={() => pushHistorySnapshot()}
                            onChange={(v) => updateGradeField("warmth", v)}
                            icon={
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M8 2.5v7.2a2.2 2.2 0 1 0 2.2 2.2A2.2 2.2 0 0 0 8 9.7" />
                              </svg>
                            }
                          />
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  /* Motion / Keyframeable Transform Sliders + Curve/Preset Triggers */
                  <div className="ve-sliders-stack">
                    <div className="ve-dual-actions">
                      <button
                        type="button"
                        className={`ve-action-pill ${activePopover === "curve" ? "ve-action-pill--active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePopover((cur) => (cur === "curve" ? null : "curve"));
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 2.5v11h11" />
                          <path d="M4.5 11.5C7.2 11.5 7.8 4.5 12.5 4.5" />
                        </svg>
                        <span>{easingLabelMap[activeEasing.preset]}</span>
                      </button>

                      <button
                        type="button"
                        className={`ve-action-pill ${activePopover === "presets" ? "ve-action-pill--active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePopover((cur) => (cur === "presets" ? null : "presets"));
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.2 8.2a4.6 4.6 0 1 1-4.4-4.6" />
                          <path d="M11.6 2.3l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" fill="currentColor" stroke="none" />
                        </svg>
                        <span>{m.veMotionPresets}</span>
                      </button>
                    </div>

                    {KEYFRAME_TRACKS.map((track) => {
                      const bounds = KEYFRAME_BOUNDS[track];
                      const currentVal = evaluatedKf[track];
                      const hasKeyAtPlayhead = Boolean(
                        selectedClip &&
                          activeResolution &&
                          selectedClip.keyframes[track].some(
                            (k) => Math.abs(k.timeSec - activeResolution.localTimeSec) <= 0.16,
                          ),
                      );
                      return (
                        <StudioPillSlider
                          key={track}
                          label={trackLabelMap[track]}
                          value={currentVal}
                          min={bounds.min}
                          max={bounds.max}
                          suffix={bounds.unit === "px" ? "" : bounds.unit}
                          signed={track !== "opacity"}
                          testId={`ve-slider-${track}`}
                          keyframeActive={hasKeyAtPlayhead}
                          onToggleKeyframe={() => {
                            pushHistorySnapshot();
                            setActiveKeyframeTrack(track);
                            updateKeyframeValue(track, currentVal);
                            if (selectedClip) {
                              setExpandedClipIds((prev) => new Set(prev).add(selectedClip.id));
                            }
                          }}
                          onCommitHistory={() => {
                            setActiveKeyframeTrack(track);
                            pushHistorySnapshot();
                          }}
                          onChange={(v) => updateKeyframeValue(track, v)}
                          icon={<span className="ve-kf-diamond-glyph">◆</span>}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* ── Middle Horizontal Filmstrip Media Bin Rail (1:1 Image 1) ── */}
        <div className="ve-media-bin" role="list" aria-label="Library media bin">
          {mediaBinItems.map((media) => {
            const isCurrentSource = activeResolution?.clip.sourceItemId === media.id;
            return (
              <button
                key={media.id}
                type="button"
                className={`ve-bin-thumb ${isCurrentSource ? "ve-bin-thumb--active" : ""}`}
                data-testid={`ve-bin-item-${media.id}`}
                title={`${media.title} — ${m.veAddClipHint}`}
                onClick={() => {
                  const res = appendMediaToTimeline(recipeRef.current, media);
                  pushHistorySnapshot(recipeRef.current);
                  setRecipe(res.recipe);
                  setSelectedClipId(res.addedClipId);
                  onNotify(m.veToastClipAdded(media.title));
                }}
              >
                <img src={media.src} alt={media.title} draggable={false} />
                <span className="ve-bin-add-badge" aria-hidden="true">+</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Bottom Multi-Track Non-Destructive Timeline Dock (1:1 Reference Style) ── */}
      <section className="ve-timeline-dock" data-testid="ve-timeline-dock">
        {/* Popover Anchor Layer positioned cleanly above the floating timeline header card (bottom sheet on mobile) */}
        <div className="ve-popover-anchor-bar">
          <AnimatePresence>
            {activePopover !== null && (
              <motion.div
                key="ve-sheet-scrim"
                className="ve-mobile-sheet-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(null);
                }}
                aria-hidden="true"
              />
            )}
            {activePopover === "curve" && (
              <EasingCurvePopover
                key="ve-curve-pop"
                easing={activeEasing}
                m={m}
                onChange={handleUpdateEasing}
                onClose={() => setActivePopover(null)}
              />
            )}
            {activePopover === "presets" && (
              <MotionPresetsPopover
                key="ve-presets-pop"
                m={m}
                onApplyPreset={handleApplyMotionPreset}
                onClose={() => setActivePopover(null)}
              />
            )}
            {activePopover === "timecode" && (
              <TimecodeModePopover
                key="ve-tc-pop"
                mode={timecodeMode}
                m={m}
                onSelect={(mode) => {
                  setTimecodeMode(mode);
                  setActivePopover(null);
                }}
                onClose={() => setActivePopover(null)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Unified Floating Porcelain Timeline Header Card (Toolbar + Beat Ruler) ── */}
        <div className="ve-tl-header-card" data-testid="ve-tl-header-card">
          <div className="ve-timeline-toolbar">
            {/* Left Motion & Edit Tools: Curve Graph, Smart Motion, Split Scissors, +KF, Dup, Del */}
            <div className="ve-tl-tools-left">
              <button
                type="button"
                className={`ve-tl-icon-btn ${activePopover === "curve" || activeEasing.preset !== "ease-in-out" ? "ve-tl-icon-btn--active" : ""}`}
                data-testid="ve-curve-btn"
                title={`${m.veEasingCurve}: ${easingLabelMap[activeEasing.preset]}`}
                aria-label={m.veEasingCurve}
                aria-expanded={activePopover === "curve"}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover((cur) => (cur === "curve" ? null : "curve"));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.2 3.2v11.6h11.6" />
                  <path d="M5.5 12.6c3 0 3.2-7.2 7.2-7.2" />
                </svg>
              </button>

              <button
                type="button"
                className={`ve-tl-icon-btn ${activePopover === "presets" ? "ve-tl-icon-btn--active" : ""}`}
                data-testid="ve-magic-btn"
                title={m.veMotionPresets}
                aria-label={m.veMotionPresets}
                aria-expanded={activePopover === "presets"}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover((cur) => (cur === "presets" ? null : "presets"));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 9.8a5 5 0 1 1-4.8-5.1" />
                  <path d="M13.6 1.8l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2z" fill="currentColor" stroke="none" />
                </svg>
              </button>

              <button
                type="button"
                className="ve-tl-icon-btn"
                data-testid="ve-split-btn"
                title={m.veSplitClip}
                aria-label={m.veSplitClip}
                onClick={handleSplitAtPlayhead}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.2" cy="5.4" r="2.1" />
                  <circle cx="5.2" cy="12.6" r="2.1" />
                  <path d="M7.1 6.7L14.5 12.8M7.1 11.3L14.5 5.2" />
                </svg>
              </button>

              <span className="ve-tl-divider" aria-hidden="true" />

              <button
                type="button"
                className="ve-tl-icon-btn"
                data-testid="ve-add-keyframe-btn"
                title={m.veAddKeyframe}
                aria-label={m.veAddKeyframe}
                onClick={handleAddKeyframeAllAtPlayhead}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round">
                  <path d="M8 2.4L13.6 8 8 13.6 2.4 8 8 2.4z" />
                  <path d="M8 5.6v4.8M5.6 8h4.8" strokeLinecap="round" />
                </svg>
              </button>

              <button
                type="button"
                className="ve-tl-icon-btn"
                data-testid="ve-duplicate-clip-btn"
                title={m.veDuplicateClip}
                aria-label={m.veDuplicateClip}
                onClick={() => {
                  if (!selectedClip) return;
                  const res = duplicateVideoClip(recipeRef.current, selectedClip.id);
                  if (!res.duplicatedId) return;
                  pushHistorySnapshot(recipeRef.current);
                  setRecipe(res.recipe);
                  setSelectedClipId(res.duplicatedId);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
                  <path d="M3.5 10.5H3a1.2 1.2 0 0 1-1.2-1.2V3A1.2 1.2 0 0 1 3 1.8h6.3A1.2 1.2 0 0 1 10.5 3v.5" />
                </svg>
              </button>

              <button
                type="button"
                className="ve-tl-icon-btn"
                data-testid="ve-delete-clip-btn"
                disabled={recipe.clips.length <= 1}
                title={m.veDeleteClip}
                aria-label={m.veDeleteClip}
                onClick={() => {
                  if (!selectedClip || recipe.clips.length <= 1) return;
                  commitRecipeChange((prev) => deleteVideoClip(prev, selectedClip.id));
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.8 4.4h10.4M6 4.4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.4M4.3 4.4l.7 8.4a1.2 1.2 0 0 0 1.2 1.1h3.6a1.2 1.2 0 0 0 1.2-1.1l.7-8.4" />
                </svg>
              </button>
            </div>

            {/* Center Transport: Timecode Switcher, Jump to Start, Play/Pause, Loop, Start/Stop Animating */}
            <div className="ve-tl-center">
              <button
                type="button"
                className={`ve-timecode-btn ${activePopover === "timecode" ? "ve-timecode-btn--open" : ""}`}
                data-testid="ve-timecode-btn"
                title={m.veTimecodeModeLabel}
                aria-expanded={activePopover === "timecode"}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover((cur) => (cur === "timecode" ? null : "timecode"));
                }}
              >
                <span className="ve-timecode" data-testid="ve-timecode">
                  {tcParts.prefix && (
                    <span className="ve-timecode-prefix">{tcParts.prefix}</span>
                  )}
                  <span className="ve-timecode-main">{tcParts.main}</span>
                </span>
                <svg className="ve-timecode-caret" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 4.5l3 3 3-3" />
                </svg>
              </button>

              <div className="ve-transport-group">
                <button
                  type="button"
                  className="ve-tl-icon-btn"
                  data-testid="ve-jump-start-btn"
                  title={m.veJumpStart}
                  aria-label={m.veJumpStart}
                  onClick={() => {
                    setIsPlaying(false);
                    setPlayheadSec(recipe.workArea.startSec);
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.6 3.5v9" />
                    <path d="M12.4 3.8L6.2 8l6.2 4.2V3.8z" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="ve-tl-icon-btn ve-tl-icon-btn--play"
                  data-testid="ve-play-btn"
                  aria-label={isPlaying ? m.mediaPause : m.mediaPlay}
                  onClick={() => setIsPlaying((v) => !v)}
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="2.8" y="2" width="3.1" height="10" rx="0.8" />
                      <rect x="8.1" y="2" width="3.1" height="10" rx="0.8" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3.4 1.9L11.8 7l-8.4 5.1V1.9z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className={`ve-tl-icon-btn ${loopPlayback ? "ve-tl-icon-btn--active" : ""}`}
                  data-testid="ve-loop-btn"
                  title={m.veLoopPlayback}
                  aria-label={m.veLoopPlayback}
                  aria-pressed={loopPlayback}
                  onClick={() => setLoopPlayback((v) => !v)}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.2 5.4H5.3a2.6 2.6 0 0 0 0 5.2h.7" />
                    <path d="M10.4 3.6l1.8 1.8-1.8 1.8" />
                    <path d="M3.8 10.6h6.9a2.6 2.6 0 0 0 0-5.2H10" />
                    <path d="M5.6 12.4l-1.8-1.8 1.8-1.8" />
                  </svg>
                </button>
              </div>

              {/* Start animating (monochrome target) → Stop animating (coral-rose pill) */}
              <button
                type="button"
                className={`ve-animate-pill ${isAnimatingMode ? "ve-animate-pill--recording" : ""}`}
                data-testid="ve-animate-toggle"
                aria-pressed={isAnimatingMode}
                onClick={() => {
                  const next = !isAnimatingMode;
                  setIsAnimatingMode(next);
                  if (next && selectedClip) {
                    setWorkspaceTab("motion");
                    setPanelMinimized(false);
                    setExpandedClipIds((prev) => new Set(prev).add(selectedClip.id));
                  }
                }}
              >
                <span
                  className={`ve-target-glyph ${isAnimatingMode ? "ve-target-glyph--recording" : ""}`}
                  aria-hidden="true"
                >
                  <span className="ve-target-dot" />
                </span>
                <span>{isAnimatingMode ? m.veStopAnimating : m.veAnimateRecord}</span>
              </button>
            </div>

            {/* Right Script Markers + Hairline Zoom + Snap */}
            <div className="ve-tl-tools-right">
              <button
                type="button"
                className={`ve-script-btn ${scriptOpen ? "ve-script-btn--active" : ""}`}
                data-testid="ve-script-btn"
                onClick={() => setScriptOpen((v) => !v)}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="10" rx="2" />
                  <path d="M5 7h6M5 10h4" />
                </svg>
                <span>{m.veScriptMarkers}</span>
              </button>

              <div className="ve-tl-zoom-wrap" title={m.veTimelineZoom}>
                <input
                  type="range"
                  min={1}
                  max={2.4}
                  step={0.1}
                  value={timelineZoom}
                  aria-label={m.veTimelineZoom}
                  className="ve-tl-zoom-range"
                  onChange={(e) => setTimelineZoom(Number(e.target.value))}
                />
              </div>

              <button
                type="button"
                className={`ve-tl-icon-btn ${snapEnabled ? "ve-tl-icon-btn--active" : ""}`}
                data-testid="ve-snap-btn"
                title={m.veSnapMagnet}
                aria-label={m.veSnapMagnet}
                aria-pressed={snapEnabled}
                onClick={() => setSnapEnabled((v) => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 3.5v4.8a3.5 3.5 0 0 0 7 0V3.5" />
                  <path d="M3.5 3.5h2M10.5 3.5h2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Integrated Bottom Ruler Sub-Row inside Floating Header Card (1s · 2s · 3s + Pentagon Playhead Cap) */}
          <div
            ref={rulerAreaRef}
            className="ve-header-ruler"
            data-testid="ve-timeline-ruler"
            onPointerDown={handleRulerPointerDown}
          >
            {/* Subtle Work-Area Highlight Span */}
            <div
              className="ve-work-area-bar"
              style={{
                left: `${(recipe.workArea.startSec / totalDuration) * 100}%`,
                width: `${Math.max(4, ((recipe.workArea.endSec - recipe.workArea.startSec) / totalDuration) * 100)}%`,
              }}
            />

            {rulerTicks.map((tick, idx) => {
              const pct = totalDuration > 0 ? (tick / totalDuration) * 100 : 0;
              const isFirst = idx === 0;
              const isLast = idx === rulerTicks.length - 1;
              const nextTick = rulerTicks[idx + 1];
              const midPct =
                nextTick !== undefined && totalDuration > 0
                  ? (((tick + nextTick) / 2) / totalDuration) * 100
                  : null;
              return (
                <div key={tick}>
                  <div
                    className={`ve-ruler-tick ${isFirst ? "ve-ruler-tick--first" : ""} ${isLast ? "ve-ruler-tick--last" : ""}`}
                    style={{ left: `${pct}%` }}
                  >
                    <span className="ve-ruler-label">
                      {tick === 0 ? "0" : `${Math.round(tick)}s`}
                    </span>
                  </div>
                  {midPct !== null && (
                    <span
                      className="ve-ruler-subtick"
                      style={{ left: `${midPct}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}

            {recipe.markers.map((mk) => (
              <button
                key={mk.id}
                type="button"
                className="ve-ruler-marker-pin"
                style={{ left: `${(mk.timeSec / totalDuration) * 100}%` }}
                title={`${mk.label} (${formatShortTimecode(mk.timeSec)})`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setIsPlaying(false);
                  setPlayheadSec(clampNumber(mk.timeSec, 0, totalDuration));
                }}
              />
            ))}

            {/* Signature Pentagon / Home-Plate Playhead Cap (1:1 Reference Image 4) */}
            <div
              className="ve-playhead-cap-wrap"
              style={{ left: `${playheadPct}%` }}
              onPointerDown={handleRulerPointerDown}
            >
              <div className="ve-playhead-cap" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Optional Inline Script / Beat Marker Strip */}
        <AnimatePresence>
          {scriptOpen && (
            <motion.div
              className="ve-script-strip"
              data-testid="ve-script-strip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="ve-script-strip-inner">
                {recipe.markers.map((mk) => (
                  <button
                    key={mk.id}
                    type="button"
                    className="ve-marker-chip"
                    onClick={() => {
                      setIsPlaying(false);
                      setPlayheadSec(clampNumber(mk.timeSec, 0, totalDuration));
                    }}
                  >
                    <span className="ve-marker-time">{formatShortTimecode(mk.timeSec)}</span>
                    <span className="ve-marker-label">{mk.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="ve-marker-add-btn"
                  data-testid="ve-add-marker-btn"
                  onClick={() => {
                    commitRecipeChange((prev) => ({
                      ...prev,
                      markers: [
                        ...prev.markers,
                        {
                          id: `mk-${Date.now()}`,
                          timeSec: Math.round(playheadRef.current * 100) / 100,
                          label: `Beat ${prev.markers.length + 1}`,
                          note: "",
                        },
                      ].sort((a, b) => a.timeSec - b.timeSec),
                      updatedAt: Date.now(),
                    }));
                  }}
                >
                  + {m.veAddMarker}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Layered Multi-Track Canvas with Subtle Beat Gridlines & Hairline Playhead ── */}
        <div className="ve-timeline-scroll">
          <div
            ref={tracksAreaRef}
            className="ve-timeline-canvas"
            style={{ width: `${Math.round(timelineZoom * 100)}%` }}
          >
            {/* Subtle Vertical Beat Gridlines spanning behind all tracks */}
            <div className="ve-gridlines" aria-hidden="true">
              {rulerTicks.map((tick) => {
                const pct = totalDuration > 0 ? (tick / totalDuration) * 100 : 0;
                return (
                  <span
                    key={tick}
                    className="ve-gridline-v"
                    style={{ left: `${pct}%` }}
                  />
                );
              })}
            </div>

            {/* ── Lane 1: Warm Amber Primary Audio Clip (1:1 Reference Style) ── */}
            <div className="ve-lane-band ve-lane-band--audio">
              {(() => {
                const audioLeftPct = clampNumber(
                  (recipe.audioTrack.startSec / totalDuration) * 100,
                  0,
                  72,
                );
                const audioWidthPct = clampNumber(
                  (recipe.audioTrack.durationSec / totalDuration) * 100,
                  26,
                  100 - audioLeftPct,
                );
                return (
                  <div
                    className={`ve-amber-audio-card ${audioSelected ? "ve-amber-audio-card--selected" : ""} ${recipe.audioTrack.muted || recipe.audioTrack.hidden ? "ve-amber-audio-card--dim" : ""}`}
                    data-testid="ve-audio-track"
                    style={{
                      marginLeft: `${audioLeftPct}%`,
                      width: `${audioWidthPct}%`,
                    }}
                    onClick={() => setAudioSelected(true)}
                  >
                    <div className="ve-amber-audio-header">
                      <span className="ve-amber-audio-title-group">
                        <span className="ve-amber-chevron" aria-hidden="true">›</span>
                        <span className="ve-amber-note" aria-hidden="true">♪</span>
                        <span className="ve-amber-title">{recipe.audioTrack.label}</span>
                      </span>
                      <div className="ve-amber-actions">
                        <button
                          type="button"
                          className={`ve-amber-mini-btn ${recipe.audioTrack.muted ? "ve-amber-mini-btn--dim" : ""}`}
                          data-testid="ve-audio-mute-btn"
                          aria-label={recipe.audioTrack.muted ? m.audioUnmute : m.audioMute}
                          onClick={(e) => {
                            e.stopPropagation();
                            commitRecipeChange((prev) => ({
                              ...prev,
                              audioTrack: {
                                ...prev.audioTrack,
                                muted: !prev.audioTrack.muted,
                              },
                            }));
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6.2h2.4L8.8 3.5v9L5.4 9.8H3V6.2z" />
                            {recipe.audioTrack.muted ? (
                              <path d="M11 6l3 4M14 6l-3 4" />
                            ) : (
                              <path d="M11.3 5.7a3.2 3.2 0 0 1 0 4.6" />
                            )}
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="ve-amber-mini-btn"
                          data-testid="ve-audio-visibility-btn"
                          aria-label="Toggle audio track visibility"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitRecipeChange((prev) => ({
                              ...prev,
                              audioTrack: {
                                ...prev.audioTrack,
                                hidden: !prev.audioTrack.hidden,
                              },
                            }));
                          }}
                        >
                          <EyelidVisibilityIcon hidden={recipe.audioTrack.hidden} size={12} />
                        </button>
                        <button
                          type="button"
                          className={`ve-amber-mini-btn ${recipe.audioTrack.locked ? "ve-amber-mini-btn--active" : ""}`}
                          aria-label="Lock audio track"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitRecipeChange((prev) => ({
                              ...prev,
                              audioTrack: {
                                ...prev.audioTrack,
                                locked: !prev.audioTrack.locked,
                              },
                            }));
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3.5" y="7.5" width="9" height="6.2" rx="1.5" />
                            <path d="M5.5 7.5V5.3a2.5 2.5 0 0 1 5 0v2.2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Mirrored Symmetrical Amber Waveform */}
                    <div className="ve-amber-wave-body" aria-hidden="true">
                      <div className="ve-amber-wave-bars">
                        {recipe.audioTrack.peaks.map((amp, i) => (
                          <span
                            key={i}
                            className="ve-amber-wave-bar"
                            style={{ height: `${Math.max(16, Math.round(amp * 92))}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Lane 2: Silver Frosted Vector Path Transform Card + Expandable Diamond Keyframes ── */}
            <div className="ve-lane-band ve-lane-band--vector">
              <div
                className={`ve-vector-card ${!recipe.grade.enabled ? "ve-vector-card--disabled" : ""}`}
                data-testid="ve-look-track"
              >
                {/* Tapered Top-Left Frosted Pill Tab (1:1 Reference Image 4) */}
                <div className="ve-vector-tab">
                  <button
                    type="button"
                    className={`ve-clip-chevron ${isKeyframesOpen ? "ve-clip-chevron--open" : ""}`}
                    data-testid="ve-vector-expand-btn"
                    aria-label="Toggle vector transform keyframes"
                    aria-expanded={isKeyframesOpen}
                    onClick={() => {
                      if (!selectedClip) return;
                      setExpandedClipIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(selectedClip.id)) next.delete(selectedClip.id);
                        else next.add(selectedClip.id);
                        return next;
                      });
                    }}
                  >
                    ›
                  </button>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.2 12.2C4.2 6.8 8.2 4.2 12.6 4.2" />
                    <circle cx="3.2" cy="12.2" r="1.4" fill="currentColor" />
                    <circle cx="12.6" cy="4.2" r="1.4" fill="none" />
                  </svg>
                  <span className="ve-vector-title">{m.veVectorPathLayer}</span>

                  <div className="ve-clip-mini-actions">
                    <button
                      type="button"
                      className={`ve-clip-mini-btn ${!recipe.grade.enabled ? "ve-clip-mini-btn--muted" : ""}`}
                      data-testid="ve-look-visibility-btn"
                      aria-label="Toggle non-destructive look layer"
                      onClick={() => {
                        commitRecipeChange((prev) => ({
                          ...prev,
                          grade: { ...prev.grade, enabled: !prev.grade.enabled },
                        }));
                      }}
                    >
                      <EyelidVisibilityIcon hidden={!recipe.grade.enabled} size={12} />
                    </button>
                    <button
                      type="button"
                      className={`ve-clip-mini-btn ${recipe.grade.locked ? "ve-clip-mini-btn--active" : ""}`}
                      aria-label="Lock look layer"
                      onClick={() => {
                        commitRecipeChange((prev) => ({
                          ...prev,
                          grade: { ...prev.grade, locked: !prev.grade.locked },
                        }));
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="3.5" y="7.5" width="9" height="6.2" rx="1.5" />
                        <path d="M5.5 7.5V5.3a2.5 2.5 0 0 1 5 0v2.2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Right live non-destructive grade + easing badge */}
                <div className="ve-vector-meta">
                  <button
                    type="button"
                    className="ve-vector-easing-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover((cur) => (cur === "curve" ? null : "curve"));
                    }}
                  >
                    {easingLabelMap[activeEasing.preset]}
                  </button>
                  {(recipe.grade.brightness !== 0 ||
                    recipe.grade.contrast !== 0 ||
                    recipe.grade.saturation !== 0 ||
                    recipe.grade.upscale) && (
                    <span className="ve-look-summary">
                      {recipe.grade.brightness !== 0 ? `B ${recipe.grade.brightness > 0 ? "+" : ""}${recipe.grade.brightness}` : ""}
                      {recipe.grade.contrast !== 0 ? ` · C ${recipe.grade.contrast > 0 ? "+" : ""}${recipe.grade.contrast}` : ""}
                      {recipe.grade.saturation !== 0 ? ` · S ${recipe.grade.saturation > 0 ? "+" : ""}${recipe.grade.saturation}` : ""}
                      {recipe.grade.upscale ? " · HD" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Smoothly Animated Inline Diamond Keyframe Tracks directly under Vector Path Transform */}
              <AnimatePresence initial={false}>
                {clipLayouts
                  .filter((entry) => expandedClipIds.has(entry.clip.id))
                  .map(({ clip, startSec, dur, leftPct, widthPct }) => (
                    <motion.div
                      key={`kf-panel-${clip.id}`}
                      className="ve-keyframe-drawer"
                      data-testid={`ve-keyframe-drawer-${clip.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      style={{
                        marginLeft: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      <div className="ve-keyframe-drawer-inner">
                        {KEYFRAME_TRACKS.map((track) => {
                          const kfs = [...clip.keyframes[track]].sort(
                            (a, b) => a.timeSec - b.timeSec,
                          );
                          const isRowActive = activeKeyframeTrack === track;
                          const firstPct =
                            kfs.length > 0
                              ? clampNumber((kfs[0]!.timeSec / dur) * 100, 0, 100)
                              : 0;
                          const lastPct =
                            kfs.length > 0
                              ? clampNumber(
                                  (kfs[kfs.length - 1]!.timeSec / dur) * 100,
                                  0,
                                  100,
                                )
                              : 0;

                          return (
                            <div
                              key={track}
                              className={`ve-kf-row ${isRowActive ? "ve-kf-row--active" : ""}`}
                              data-testid={`ve-kf-row-${track}`}
                              onClick={(e) => {
                                setActiveKeyframeTrack(track);
                                if ((e.target as HTMLElement).closest("button")) return;
                                const trackEl = e.currentTarget.querySelector(".ve-kf-row-track");
                                const rect = (trackEl ?? e.currentTarget).getBoundingClientRect();
                                const pct = clampNumber(
                                  (e.clientX - rect.left) / Math.max(1, rect.width),
                                  0,
                                  1,
                                );
                                const localT = pct * dur;
                                const valAtT = evaluateClipKeyframes(
                                  clip,
                                  localT,
                                  activeEasing.bezier,
                                )[track];
                                commitRecipeChange((prev) =>
                                  upsertClipKeyframe(prev, clip.id, track, localT, valAtT),
                                );
                                setPlayheadSec(clampNumber(startSec + localT, 0, totalDuration));
                              }}
                            >
                              {/* Leading diamond + label matching Reference Image 4 */}
                              <span
                                className={`ve-kf-lead-diamond ${isRowActive ? "ve-kf-lead-diamond--solid" : ""}`}
                                aria-hidden="true"
                              />
                              <span className="ve-kf-row-label">{trackLabelMap[track]}</span>
                              <div className="ve-kf-row-track">
                                {kfs.length >= 2 && (
                                  <span
                                    className="ve-kf-connector"
                                    style={{
                                      left: `${firstPct}%`,
                                      width: `${Math.max(0, lastPct - firstPct)}%`,
                                    }}
                                  />
                                )}
                                {kfs.map((kf) => {
                                  const kfPct = clampNumber((kf.timeSec / dur) * 100, 0, 100);
                                  const isSelectedKf =
                                    selectedKeyframe?.keyframeId === kf.id;
                                  const isAtPlayhead =
                                    Math.abs(startSec + kf.timeSec - playheadSec) <= 0.14;
                                  return (
                                    <button
                                      key={kf.id}
                                      type="button"
                                      className={`ve-kf-diamond ${isSelectedKf || (isRowActive && isAtPlayhead) ? "ve-kf-diamond--solid" : ""}`}
                                      style={{ left: `${kfPct}%` }}
                                      title={`${trackLabelMap[track]}: ${kf.value} @ ${formatShortTimecode(startSec + kf.timeSec)}`}
                                      onPointerDown={(e) => {
                                        setActiveKeyframeTrack(track);
                                        handleStartKeyframeDrag(e, clip.id, track, kf.id, dur);
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveKeyframeTrack(track);
                                        setSelectedKeyframe({
                                          clipId: clip.id,
                                          track,
                                          keyframeId: kf.id,
                                        });
                                        setPlayheadSec(
                                          clampNumber(startSec + kf.timeSec, 0, totalDuration),
                                        );
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        commitRecipeChange((prev) =>
                                          deleteClipKeyframe(prev, clip.id, track, kf.id),
                                        );
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>

            {/* ── Lane 3: Video Cutscene Filmstrip Track with Frosted Overlay Tab ── */}
            <div className="ve-lane-band ve-lane-band--video" data-testid="ve-video-track">
              <div className="ve-video-track-lane">
                {clipLayouts.map(({ clip, startSec, dur, leftPct, widthPct }, idx) => {
                  const isSelected = clip.id === selectedClip?.id && !audioSelected;
                  const isExpanded = expandedClipIds.has(clip.id);
                  const filmstripCount = Math.max(4, Math.min(14, Math.round((widthPct / 100) * 12)));

                  return (
                    <div
                      key={clip.id}
                      className={`ve-video-clip-shell ${isSelected ? "ve-video-clip-shell--selected" : ""} ${clip.hidden ? "ve-clip--hidden" : ""}`}
                      data-testid={`ve-clip-${clip.id}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - ${recipe.clips.length > 1 ? 6 : 0}px)`,
                      }}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        setAudioSelected(false);
                      }}
                    >
                      {/* Left Blue Trim Handle */}
                      {isSelected && !clip.locked && (
                        <div
                          className="ve-trim-handle ve-trim-handle--left"
                          data-testid={`ve-trim-left-${clip.id}`}
                          onPointerDown={(e) => handleStartTrim(e, clip.id, "start")}
                        >
                          <span className="ve-trim-bar" />
                        </div>
                      )}

                      <div className="ve-video-clip-inner">
                        {/* Full-Bleed Tiled Filmstrip Thumbnails */}
                        <div className="ve-filmstrip-row" aria-hidden="true">
                          {Array.from({ length: filmstripCount }).map((_, fIdx) => (
                            <div
                              key={fIdx}
                              className="ve-filmstrip-frame"
                              style={{
                                backgroundImage: `url(${clip.posterSrc})`,
                                backgroundPosition: `${(fIdx / Math.max(1, filmstripCount - 1)) * 100}% 50%`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Frosted Top-Left Pill Tab Overlay (1:1 Reference Image 4: > ▣ My Video Cutscene) */}
                        <div className="ve-clip-overlay-tab">
                          <button
                            type="button"
                            className={`ve-clip-chevron ${isExpanded ? "ve-clip-chevron--open" : ""}`}
                            data-testid={`ve-clip-expand-${clip.id}`}
                            aria-label="Toggle keyframe lanes"
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                              setExpandedClipIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(clip.id)) next.delete(clip.id);
                                else next.add(clip.id);
                                return next;
                              });
                            }}
                          >
                            ›
                          </button>
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="2" />
                            <path d="M6.8 6.2L10.2 8l-3.4 1.8V6.2z" fill="currentColor" stroke="none" />
                          </svg>
                          <span className="ve-clip-name">{clip.filename}</span>
                          {clip.speed !== 1 && (
                            <span className="ve-clip-speed-meta">{clip.speed}×</span>
                          )}
                          <div className="ve-clip-mini-actions">
                            <button
                              type="button"
                              className={`ve-clip-mini-btn ${clip.muted ? "ve-clip-mini-btn--muted" : ""}`}
                              aria-label="Mute clip"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitRecipeChange((prev) => ({
                                  ...prev,
                                  clips: prev.clips.map((c) =>
                                    c.id === clip.id ? { ...c, muted: !c.muted } : c,
                                  ),
                                }));
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6.2h2.4L8.8 3.5v9L5.4 9.8H3V6.2z" />
                                {clip.muted ? (
                                  <path d="M11 6l3 4M14 6l-3 4" />
                                ) : (
                                  <path d="M11.3 5.7a3.2 3.2 0 0 1 0 4.6" />
                                )}
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={`ve-clip-mini-btn ${clip.hidden ? "ve-clip-mini-btn--muted" : ""}`}
                              data-testid={`ve-clip-visibility-${clip.id}`}
                              aria-label="Toggle clip visibility"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitRecipeChange((prev) => ({
                                  ...prev,
                                  clips: prev.clips.map((c) =>
                                    c.id === clip.id ? { ...c, hidden: !c.hidden } : c,
                                  ),
                                }));
                              }}
                            >
                              <EyelidVisibilityIcon hidden={clip.hidden} size={11} />
                            </button>
                            <button
                              type="button"
                              className={`ve-clip-mini-btn ${clip.locked ? "ve-clip-mini-btn--active" : ""}`}
                              aria-label="Lock clip"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitRecipeChange((prev) => ({
                                  ...prev,
                                  clips: prev.clips.map((c) =>
                                    c.id === clip.id ? { ...c, locked: !c.locked } : c,
                                  ),
                                }));
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <rect x="3.5" y="7.5" width="9" height="6.2" rx="1.5" />
                                <path d="M5.5 7.5V5.3a2.5 2.5 0 0 1 5 0v2.2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Blue Trim Handle */}
                      {isSelected && !clip.locked && (
                        <div
                          className="ve-trim-handle ve-trim-handle--right"
                          data-testid={`ve-trim-right-${clip.id}`}
                          onPointerDown={(e) => handleStartTrim(e, clip.id, "end")}
                        >
                          <span className="ve-trim-bar" />
                        </div>
                      )}

                      {/* Subtle Double-Bar Cut Separator between adjacent clips */}
                      {idx < clipLayouts.length - 1 && (
                        <span className="ve-cut-separator" aria-hidden="true">
                          <i />
                          <i />
                        </span>
                      )}

                      <span className="ve-sr-only">
                        {clip.title} ({formatShortTimecode(startSec)} – {formatShortTimecode(startSec + dur)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Lane 4: Secondary Ambient SFX Amber Track(s) (1:1 Reference "Tag Na." Style) ── */}
            {sfxTracks.length > 0 && (
              <div className="ve-lane-band ve-lane-band--sfx">
                {sfxTracks.map((sfx) => {
                  const sfxLeftPct = clampNumber(
                    (sfx.startSec / totalDuration) * 100,
                    0,
                    74,
                  );
                  const sfxWidthPct = clampNumber(
                    (sfx.durationSec / totalDuration) * 100,
                    22,
                    100 - sfxLeftPct,
                  );
                  return (
                    <div
                      key={sfx.id}
                      className={`ve-amber-audio-card ve-amber-audio-card--compact ${sfx.hidden || sfx.muted ? "ve-amber-audio-card--dim" : ""}`}
                      data-testid={`ve-sfx-track-${sfx.id}`}
                      style={{
                        marginLeft: `${sfxLeftPct}%`,
                        width: `${sfxWidthPct}%`,
                      }}
                    >
                      <div className="ve-amber-audio-header">
                        <span className="ve-amber-audio-title-group">
                          <span className="ve-amber-chevron" aria-hidden="true">›</span>
                          <span className="ve-amber-note" aria-hidden="true">♪</span>
                          <span className="ve-amber-title">{sfx.label}</span>
                        </span>
                        <div className="ve-amber-actions">
                          <button
                            type="button"
                            className="ve-amber-mini-btn"
                            data-testid={`ve-sfx-visibility-${sfx.id}`}
                            aria-label={`Toggle ${sfx.label} visibility`}
                            onClick={(e) => {
                              e.stopPropagation();
                              commitRecipeChange((prev) => ({
                                ...prev,
                                sfxTracks: (prev.sfxTracks ?? []).map((t) =>
                                  t.id === sfx.id ? { ...t, hidden: !t.hidden } : t,
                                ),
                              }));
                            }}
                          >
                            <EyelidVisibilityIcon hidden={sfx.hidden} size={12} />
                          </button>
                          <button
                            type="button"
                            className={`ve-amber-mini-btn ${sfx.locked ? "ve-amber-mini-btn--active" : ""}`}
                            aria-label={`Lock ${sfx.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              commitRecipeChange((prev) => ({
                                ...prev,
                                sfxTracks: (prev.sfxTracks ?? []).map((t) =>
                                  t.id === sfx.id ? { ...t, locked: !t.locked } : t,
                                ),
                              }));
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="3.5" y="7.5" width="9" height="6.2" rx="1.5" />
                              <path d="M5.5 7.5V5.3a2.5 2.5 0 0 1 5 0v2.2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="ve-amber-wave-body" aria-hidden="true">
                        <div className="ve-amber-wave-bars">
                          {sfx.peaks.map((amp, i) => (
                            <span
                              key={i}
                              className="ve-amber-wave-bar"
                              style={{ height: `${Math.max(14, Math.round(amp * 86))}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Continuous 1px Hairline Vertical Playhead Needle cutting through all lanes ── */}
            <div
              className="ve-playhead"
              data-testid="ve-playhead"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="ve-playhead-stem" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile Thumb-Zone Bottom Mode Bar (Hidden on Desktop) ─── */}
      <nav
        className="ve-mobile-bottom-bar"
        data-testid="ve-mobile-bottom-bar"
        aria-label="Mobile studio panels"
      >
        {(
          [
            {
              id: "studio",
              label: m.veTabEdit,
              icon: (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.2" y="3.2" width="13.6" height="3.2" rx="1.2" />
                  <rect x="2.2" y="8.4" width="9.2" height="3.2" rx="1.2" />
                  <rect x="5.4" y="13.2" width="10.4" height="2.4" rx="1.1" />
                </svg>
              ),
            },
            {
              id: "color",
              label: m.veTabColor,
              icon: (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 5.2h12M3 9h12M3 12.8h12" />
                  <circle cx="6.5" cy="5.2" r="1.7" fill="currentColor" stroke="none" />
                  <circle cx="11.5" cy="9" r="1.7" fill="currentColor" stroke="none" />
                  <circle cx="8" cy="12.8" r="1.7" fill="currentColor" stroke="none" />
                </svg>
              ),
            },
            {
              id: "motion",
              label: m.veTabMotion,
              icon: (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2.8L15.2 9 9 15.2 2.8 9 9 2.8z" />
                  <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              ),
            },
          ] as const
        ).map((tab) => {
          const isActive = workspaceTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`ve-mobile-tab-btn ${isActive ? "ve-mobile-tab-btn--active" : ""}`}
              data-testid={`ve-mobile-tab-${tab.id}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                setWorkspaceTab(tab.id);
                setPanelMinimized(false);
                setActivePopover(null);
                if (tab.id === "motion" && selectedClip) {
                  setExpandedClipIds((prev) => new Set(prev).add(selectedClip.id));
                }
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="ve-mobile-tab-pill"
                  className="ve-mobile-tab-pill"
                  transition={{ type: "spring", stiffness: 460, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              <span className="ve-mobile-tab-inner">
                {tab.icon}
                <span>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </motion.div>
  );
}
