import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CloseIcon,
  CopyIcon,
  ExportIcon,
  HeartIcon,
  InfoIcon,
  SidebarToggleIcon,
  TrashIcon,
} from "./AppIcons";
import {
  computeLightboxTargetRect,
  getQuickLookFrameSurfaceColor,
  HERO_CLOSE_DURATION_S,
  HERO_MOTION_EASE,
  HERO_OPEN_DURATION_S,
  type QuickLookPhase,
  type ScreenRect,
} from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import type { CollectionItem, LibraryItem, ThemeMode } from "./library-engine";
import {
  formatAudioTime,
  formatCompactCount,
  isRichInteractiveKind,
} from "./media-helpers";
import { AudioQuickLookPlayer } from "./AudioQuickLookPlayer";
import { VideoQuickLookStage } from "./AtomicMediaPlayerHost";
import { FontQuickLookViewer } from "./FontQuickLookViewer";
import { GifQuickLookViewer } from "./GifQuickLookViewer";
import { Model3DQuickLookViewer } from "./Model3DQuickLookViewer";
import { QuickLookInspectorPanel } from "./QuickLookInspectorPanel";
import { RichMediaCardContent } from "./RichMediaCardContent";
import { VideoNonDestructiveEditor } from "./VideoNonDestructiveEditor";
import {
  buildVideoCssFilter,
  hasNonDestructiveEdits,
  type VideoEditRecipe,
} from "./video-editor-engine";
import {
  stepQuickLookWheelNavigation,
  type QuickLookWheelState,
} from "./viewport-motion";

export function getQuickLookStageDimensions(item: LibraryItem): {
  width: number;
  height: number;
} {
  if (item.kind === "audio") return { width: 920, height: 470 };
  if (item.kind === "model3d") return { width: 1180, height: 780 };
  if (item.kind === "font") return { width: 1120, height: 760 };
  return { width: item.width, height: item.height };
}

export interface QuickLookLightboxProps {
  item: LibraryItem | null;
  originRect: ScreenRect | null;
  /** Synchronously computed landing rectangle ready on frame 1 of closing (zero flicker!). */
  returnRect: ScreenRect | null;
  cardRadius: number;
  /** 3-phase hero handoff lifecycle: open -> closing -> landing (double-buffered zero-flicker unmount). */
  phase: QuickLookPhase | null;
  theme: ThemeMode;
  locale: AppLocale;
  speedMultiplier: number;
  autoOpenInspector: boolean;
  items: readonly LibraryItem[];
  allItems?: readonly LibraryItem[];
  collections: readonly CollectionItem[];
  onRequestClose: () => void;
  onCloseComplete: () => void;
  onNavigate: (id: string) => void;
  onToggleLike: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onUpdateCollection: (id: string, collectionId: string | null) => void;
  onAddTagToItem: (id: string, tag: string) => void;
  onRemoveTagFromItem: (id: string, tag: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onTrashOrRestore: (id: string) => void;
  onPinToPip?: (item: LibraryItem) => void;
  onUpdateVideoEdit?: (id: string, recipe: VideoEditRecipe | undefined) => void;
  onNotify: (message: string) => void;
}

const SLIDE_VARIANTS = {
  enter: (dir: number) =>
    dir === 0
      ? { x: 0, opacity: 1, scale: 1 }
      : { x: dir * 76, opacity: 0.22, scale: 0.975 },
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) =>
    dir === 0
      ? { x: 0, opacity: 1, scale: 1 }
      : { x: -dir * 76, opacity: 0.16, scale: 0.975 },
};

function shouldYieldWheelToInnerElement(
  target: EventTarget | null,
  deltaY: number,
): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;

  // Let WebGL 3D OrbitControls, Inspector drawer, and 100% zoom scroller own wheel events
  if (
    el.closest(".ql-model3d-canvas-mount") ||
    el.closest(".lightbox-inspector") ||
    el.closest(".lightbox-actual-scroller")
  ) {
    return true;
  }

  // Let scrollable textareas or font waterfall/glyph panels scroll until they hit their boundary
  const scrollable = el.closest<HTMLElement>(
    "textarea, .ql-font-body, .ql-font-glyph-grid",
  );
  if (scrollable) {
    const canScroll = scrollable.scrollHeight > scrollable.clientHeight + 4;
    if (canScroll) {
      const atTop = scrollable.scrollTop <= 1;
      const atBottom =
        scrollable.scrollTop + scrollable.clientHeight >=
        scrollable.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        return true;
      }
    }
  }
  return false;
}

export function QuickLookLightbox({
  item,
  originRect,
  returnRect,
  cardRadius,
  phase,
  theme,
  locale,
  speedMultiplier,
  autoOpenInspector,
  items,
  allItems,
  collections,
  onRequestClose,
  onCloseComplete,
  onNavigate,
  onToggleLike,
  onUpdateTitle,
  onUpdateCollection,
  onAddTagToItem,
  onRemoveTagFromItem,
  onUpdateNote,
  onTrashOrRestore,
  onPinToPip,
  onUpdateVideoEdit,
  onNotify,
}: QuickLookLightboxProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  const [actualSize, setActualSize] = useState(false);
  const [model3dReady, setModel3dReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [videoEditMode, setVideoEditMode] = useState(false);
  const [navDirection, setNavDirection] = useState<-1 | 0 | 1>(0);
  const [swipeDragX, setSwipeDragX] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  }));

  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeDoneRef = useRef(false);
  const veilPointerDownRef = useRef(false);
  const wheelStateRef = useRef<QuickLookWheelState>({
    accum: 0,
    lastEventAt: 0,
    cooldownUntil: 0,
  });
  const swipeRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    dx: number;
    swiped: boolean;
  } | null>(null);
  const suppressNextHeroClickRef = useRef(false);

  const isClosing = phase === "closing";
  const isLanding = phase === "landing";
  const isReturning = isClosing || isLanding;

  useEffect(() => {
    const onResize = () => {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      setViewport((prev) =>
        prev.width === nextW && prev.height === nextH
          ? prev
          : { width: nextW, height: nextH },
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!phase) {
      setNavDirection(0);
      setSwipeDragX(0);
      setVideoEditMode(false);
    } else if (phase !== "open") {
      setNavDirection(0);
      setSwipeDragX(0);
      setVideoEditMode(false);
    }
  }, [phase]);

  useEffect(() => {
    setActualSize(false);
    setModel3dReady(false);
    setVideoEditMode(false);
    setSwipeDragX(0);
    if (item && phase === "open" && autoOpenInspector) {
      setInspectorOpen(true);
    }
  }, [item?.id, autoOpenInspector, phase]);

  // Reset closing guard & ensure clean fallback transition to "landing" if Framer Motion
  // animation completes before callback or gets interrupted.
  useEffect(() => {
    if (!isClosing || !item) {
      closeDoneRef.current = false;
      return;
    }

    setActualSize(false);
    setInspectorOpen(false);

    const safetyTimer = window.setTimeout(() => {
      if (!closeDoneRef.current) {
        closeDoneRef.current = true;
        onCloseComplete();
      }
    }, Math.round(HERO_CLOSE_DURATION_S * speedMultiplier * 1000) + 140);

    return () => window.clearTimeout(safetyTimer);
  }, [isClosing, item, onCloseComplete, speedMultiplier]);

  const currentIndex = item ? items.findIndex((it) => it.id === item.id) : -1;
  const prevItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < items.length - 1
      ? items[currentIndex + 1]
      : null;

  const navigateWithDirection = useCallback(
    (targetId: string, dir: -1 | 1) => {
      setNavDirection(dir);
      setSwipeDragX(0);
      onNavigate(targetId);
    },
    [onNavigate],
  );

  // Native non-passive wheel listener: scroll mouse wheel or trackpad horizontally/vertically
  // while QuickLook is open to smoothly browse adjacent items (Atlas 00:05–00:06).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !item || phase !== "open" || actualSize || videoEditMode) return;

    const onNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (shouldYieldWheelToInnerElement(e.target, e.deltaY)) return;

      e.preventDefault();
      const step = stepQuickLookWheelNavigation(
        wheelStateRef.current,
        e.deltaX,
        e.deltaY,
        performance.now(),
        Boolean(prevItem),
        Boolean(nextItem),
      );
      wheelStateRef.current = step.nextState;

      if (step.direction === 1 && nextItem) {
        navigateWithDirection(nextItem.id, 1);
      } else if (step.direction === -1 && prevItem) {
        navigateWithDirection(prevItem.id, -1);
      }
    };

    root.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => root.removeEventListener("wheel", onNativeWheel);
  }, [item, phase, actualSize, videoEditMode, prevItem, nextItem, navigateWithDirection]);

  const targetRect = useMemo(() => {
    if (!item) return null;
    const dims = getQuickLookStageDimensions(item);
    return computeLightboxTargetRect(
      viewport.width,
      viewport.height,
      dims.width,
      dims.height,
      inspectorOpen && !isReturning,
    );
  }, [item, viewport.width, viewport.height, inspectorOpen, isReturning]);

  useEffect(() => {
    if (!item || isReturning || videoEditMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (e.key === "Escape") {
        e.preventDefault();
        onRequestClose();
        return;
      }
      if (isEditing) return;

      if (e.key === " ") {
        e.preventDefault();
        onRequestClose();
      } else if (e.key === "ArrowLeft" && prevItem) {
        e.preventDefault();
        navigateWithDirection(prevItem.id, -1);
      } else if (e.key === "ArrowRight" && nextItem) {
        e.preventDefault();
        navigateWithDirection(nextItem.id, 1);
      } else if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInspectorOpen((v) => !v);
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        onToggleLike(item.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    item,
    isReturning,
    videoEditMode,
    prevItem,
    nextItem,
    onRequestClose,
    navigateWithDirection,
    onToggleLike,
  ]);

  if (!item || !targetRect || !phase) return null;

  const handleCopyFilename = async () => {
    try {
      await navigator.clipboard.writeText(item.filename);
      onNotify(`Copied "${item.filename}"`);
    } catch {
      onNotify(`File: ${item.filename}`);
    }
  };

  const handleExportDownload = () => {
    const link = document.createElement("a");
    link.href = item.src;
    link.download = item.filename;
    link.click();
    onNotify(`Exporting ${item.filename}`);
  };

  const fallbackCenterRect: ScreenRect = {
    left: targetRect.left + targetRect.width * 0.08,
    top: targetRect.top + targetRect.height * 0.08,
    width: targetRect.width * 0.84,
    height: targetRect.height * 0.84,
  };

  const startRect = originRect ?? fallbackCenterRect;
  const resolvedReturnRect = returnRect ?? originRect;
  const endRect = isReturning
    ? (resolvedReturnRect ?? fallbackCenterRect)
    : targetRect;
  const isFadingOutFallback = isReturning && !resolvedReturnRect;
  const activeDuration = isLanding
    ? 0
    : (isClosing ? HERO_CLOSE_DURATION_S : HERO_OPEN_DURATION_S) *
      speedMultiplier;

  const isRich = isRichInteractiveKind(item.kind);
  const canSwipeHero = !isReturning && !isRich && item.kind !== "video";
  const frameSurfaceColor = getQuickLookFrameSurfaceColor(
    {
      kind: item.kind,
      fontTone: item.fontMeta?.specimenTone,
      gifKind: item.gifMeta?.animationKind,
    },
    theme,
  );

  // Dual-Layer Continuous Container Morph:
  // Audio, Font, and GIF studios mount immediately on frame 0 and cross-dissolve smoothly
  // from the card snapshot without any 380ms abrupt snap or blank flash.
  // 3D WebGL mounts immediately underneath and cross-dissolves the instant Three.js renders frame 1.
  const studioReady = item.kind === "model3d" ? model3dReady : true;
  const showStudio = !isReturning && studioReady;

  const handleHeroPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipeHero || e.button !== 0) return;
    swipeRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      swiped: false,
    };
  };

  const handleHeroPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sw = swipeRef.current;
    if (!sw || !sw.active) return;
    const dx = e.clientX - sw.startX;
    const dy = e.clientY - sw.startY;
    if (!sw.swiped && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      sw.swiped = true;
      try {
        e.currentTarget.setPointerCapture(sw.pointerId);
      } catch {
        // Ignore capture failure
      }
    }
    if (!sw.swiped) return;
    const atEdge = (dx > 0 && !prevItem) || (dx < 0 && !nextItem);
    const damped = atEdge ? dx * 0.24 : Math.max(-180, Math.min(180, dx * 0.65));
    sw.dx = dx;
    setSwipeDragX(damped);
  };

  const handleHeroPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const sw = swipeRef.current;
    if (!sw || !sw.active) return;
    sw.active = false;
    swipeRef.current = null;
    if (sw.swiped) {
      suppressNextHeroClickRef.current = true;
      try {
        e.currentTarget.releasePointerCapture(sw.pointerId);
      } catch {
        // Ignore capture release failure
      }
      if (sw.dx <= -62 && nextItem) {
        navigateWithDirection(nextItem.id, 1);
      } else if (sw.dx >= 62 && prevItem) {
        navigateWithDirection(prevItem.id, -1);
      } else {
        setSwipeDragX(0);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className="lightbox-root"
      data-testid="quicklook-lightbox"
      data-closing={isReturning ? "true" : "false"}
      data-phase={phase}
      data-item-id={item.id}
      style={{ pointerEvents: isReturning ? "none" : undefined }}
    >
      {/* Translucent Light/Dark Veil synchronized frame-for-frame with Hero & Radial Neighbor Push-Out */}
      <motion.div
        className="lightbox-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: isReturning ? 0 : 1 }}
        transition={{
          duration: activeDuration,
          ease: HERO_MOTION_EASE,
        }}
        onPointerDown={(e) => {
          veilPointerDownRef.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (
            !isReturning &&
            veilPointerDownRef.current &&
            e.target === e.currentTarget
          ) {
            veilPointerDownRef.current = false;
            onRequestClose();
          }
        }}
      />

      {/* Minimal Native macOS QuickLook Topbar */}
      <motion.div
        className="lightbox-topbar lightbox-topbar--floating"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: isReturning ? 0 : 1, y: isReturning ? -4 : 0 }}
        transition={{
          duration: isLanding ? 0 : isClosing ? 0.14 : 0.22,
          delay: isReturning ? 0 : 0.06,
          ease: HERO_MOTION_EASE,
        }}
      >
        <div className="lightbox-file-meta">
          <div className="mac-dots" aria-hidden="true">
            <span className="mac-dot mac-dot--r" />
            <span className="mac-dot mac-dot--y" />
            <span className="mac-dot mac-dot--g" />
          </div>
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={onRequestClose}
            title={m.qlBackToBoard}
            aria-label={m.qlBackToBoard}
          >
            <SidebarToggleIcon size={15} />
          </button>
          <div style={{ minWidth: 0, marginLeft: 4 }}>
            <div className="lightbox-filename">{item.filename}</div>
            <div className="lightbox-sub">
              {item.kind === "audio" && item.audioMeta
                ? `${m.qlAudio} · ${item.audioMeta.format} · ${formatAudioTime(item.audioMeta.durationSec)} · ${item.audioMeta.sampleRate}`
                : item.kind === "model3d" && item.modelMeta
                  ? `${m.qlModel3d} · ${item.modelMeta.format} · ${formatCompactCount(item.modelMeta.vertices)} ${m.modelVerts}`
                  : item.kind === "font" && item.fontMeta
                    ? `${m.qlFont} · ${item.fontMeta.format} · ${item.fontMeta.styleCount} ${m.fontStylesUnit}`
                    : item.kind === "gif" && item.gifMeta
                      ? `${m.qlGif} · ${item.gifMeta.fps} FPS · ${item.width} × ${item.height}`
                      : `${
                          item.kind === "video"
                            ? `${m.qlVideo} ${item.duration ?? ""}`
                            : item.kind === "link"
                              ? item.domain ?? m.qlLink
                              : m.qlImage
                        } · ${item.width} × ${item.height}`}
            </div>
          </div>
        </div>

        <div className="topbar-right">
          {item.kind === "video" && (
            <button
              type="button"
              className={`ql-topbar-edit-pill ${hasNonDestructiveEdits(item.videoEdit, item) ? "ql-topbar-edit-pill--edited" : ""}`}
              data-testid="ql-topbar-edit-video-btn"
              onClick={() => setVideoEditMode(true)}
              title={m.videoEditBtn}
              aria-label={m.videoEditBtn}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 5h11M2.5 11h11" />
                <circle cx="6" cy="5" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="10.5" cy="11" r="1.8" fill="currentColor" stroke="none" />
              </svg>
              <span>{m.videoEditBtn}</span>
              {hasNonDestructiveEdits(item.videoEdit, item) && (
                <span className="ql-video-edited-dot" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            className={`topbar-icon-btn ${inspectorOpen ? "topbar-icon-btn--active" : ""}`}
            data-testid="lightbox-info-btn"
            onClick={() => setInspectorOpen((v) => !v)}
            title="Inspector (I)"
            aria-label="Toggle Inspector"
          >
            <InfoIcon size={15} />
          </button>

          <button
            type="button"
            className={`topbar-icon-btn ${item.liked ? "topbar-icon-btn--liked" : ""}`}
            onClick={() => onToggleLike(item.id)}
            title="Like (L)"
            aria-label={item.liked ? "Unlike" : "Like"}
          >
            <HeartIcon size={15} filled={item.liked} />
          </button>

          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() => {
              onTrashOrRestore(item.id);
              onRequestClose();
            }}
            title={item.trashed ? "Restore" : "Move to Trash"}
            aria-label={item.trashed ? "Restore item" : "Move to Trash"}
          >
            <TrashIcon size={15} />
          </button>

          <button
            type="button"
            className="topbar-icon-btn"
            data-testid="lightbox-close-btn"
            onClick={onRequestClose}
            title="Close (Esc / Space)"
            aria-label="Close Quick Look"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </motion.div>

      {/* GPU-accelerated Shared-Element Hero Morph (exact pixel-to-pixel flight + 2-frame double-buffered landing) */}
      {!actualSize || isReturning || isRich || item.kind === "video" ? (
        <motion.div
          className={`lightbox-hero-frame ${
            isRich || item.kind === "video"
              ? "lightbox-hero-frame--interactive"
              : ""
          } ${isLanding ? "lightbox-hero-frame--landing" : ""}`}
          data-testid="lightbox-hero-frame"
          style={{ backgroundColor: frameSurfaceColor }}
          initial={{
            x: startRect.left,
            y: startRect.top,
            width: startRect.width,
            height: startRect.height,
            borderRadius: cardRadius,
            opacity: 1,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
          }}
          animate={{
            x: endRect.left + (isReturning ? 0 : swipeDragX),
            y: endRect.top,
            width: endRect.width,
            height: endRect.height,
            borderRadius: isReturning
              ? cardRadius
              : isRich || item.kind === "video"
                ? 14
                : 8,
            opacity: isFadingOutFallback ? 0 : 1,
            boxShadow: isLanding
              ? "0 0 0 rgba(0, 0, 0, 0)"
              : isClosing
                ? "0 2px 10px rgba(0, 0, 0, 0.04)"
                : "0 22px 60px rgba(0, 0, 0, 0.16)",
          }}
          transition={{
            duration: swipeDragX !== 0 ? 0.04 : activeDuration,
            ease: HERO_MOTION_EASE,
          }}
          onAnimationComplete={() => {
            if (isClosing && !closeDoneRef.current) {
              closeDoneRef.current = true;
              onCloseComplete();
            }
          }}
          onPointerDown={handleHeroPointerDown}
          onPointerMove={handleHeroPointerMove}
          onPointerUp={handleHeroPointerUp}
          onPointerCancel={handleHeroPointerUp}
          onClick={(e) => {
            e.stopPropagation();
            if (suppressNextHeroClickRef.current) {
              suppressNextHeroClickRef.current = false;
              return;
            }
            if (!isReturning && !isRich && item.kind !== "video") {
              setActualSize(true);
            }
          }}
        >
          <AnimatePresence
            mode="popLayout"
            custom={isReturning ? 0 : navDirection}
            initial={false}
          >
            <motion.div
              key={item.id}
              className="hero-slide-slot"
              custom={isReturning ? 0 : navDirection}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: isReturning ? 0 : 0.28 * speedMultiplier,
                ease: HERO_MOTION_EASE,
              }}
            >
              {item.kind === "video" ? (
                !isReturning && !videoEditMode ? (
                  <VideoQuickLookStage
                    item={item}
                    locale={locale}
                    onEnterEdit={() => setVideoEditMode(true)}
                    onPinToPip={(targetItem) => {
                      onPinToPip?.(targetItem);
                    }}
                  />
                ) : (
                  <img
                    src={item.src}
                    alt={item.title}
                    className="lightbox-hero-img"
                    style={{
                      filter: item.videoEdit
                        ? buildVideoCssFilter(item.videoEdit.grade)
                        : undefined,
                    }}
                    draggable={false}
                  />
                )
              ) : isRich ? (
                <>
                  {/* Layer A: Continuous Card Snapshot (cross-dissolves seamlessly out on open & back in on close) */}
                  <motion.div
                    className="hero-morph-layer hero-morph-layer--card"
                    data-testid="hero-morph-card-layer"
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: showStudio ? 0 : 1,
                      scale: showStudio ? 1.03 : 1,
                    }}
                    transition={{
                      duration: isLanding
                        ? 0
                        : (showStudio ? 0.24 : 0.19) * speedMultiplier,
                      delay: isLanding
                        ? 0
                        : (showStudio ? 0.04 : 0.045) * speedMultiplier,
                      ease: HERO_MOTION_EASE,
                    }}
                    style={{ pointerEvents: showStudio ? "none" : "auto" }}
                    aria-hidden={showStudio}
                  >
                    <RichMediaCardContent
                      item={item}
                      theme={theme}
                      interactiveAudio={false}
                    />
                  </motion.div>

                  {/* Layer B: Detailed Studio (mounted immediately on frame 0 — zero 380ms pop-in snap!) */}
                  {!isLanding && (
                    <motion.div
                      className="hero-morph-layer hero-morph-layer--studio"
                      data-testid="hero-morph-studio-layer"
                      initial={{ opacity: 0, scale: 0.968, y: 10 }}
                      animate={{
                        opacity: showStudio ? 1 : 0,
                        scale: showStudio ? 1 : 0.968,
                        y: showStudio ? 0 : 8,
                      }}
                      transition={{
                        duration: (showStudio ? 0.28 : 0.15) * speedMultiplier,
                        delay: showStudio ? 0.045 * speedMultiplier : 0,
                        ease: HERO_MOTION_EASE,
                      }}
                      style={{ pointerEvents: showStudio ? "auto" : "none" }}
                    >
                      {item.kind === "audio" && item.audioMeta ? (
                        <AudioQuickLookPlayer item={item} locale={locale} />
                      ) : item.kind === "model3d" && item.modelMeta ? (
                        <Model3DQuickLookViewer
                          item={item}
                          theme={theme}
                          locale={locale}
                          targetWidth={targetRect.width}
                          targetHeight={targetRect.height}
                          onFirstFrameReady={() => setModel3dReady(true)}
                        />
                      ) : item.kind === "font" && item.fontMeta ? (
                        <FontQuickLookViewer
                          item={item}
                          locale={locale}
                          onNotify={onNotify}
                        />
                      ) : item.kind === "gif" && item.gifMeta ? (
                        <GifQuickLookViewer
                          item={item}
                          theme={theme}
                          locale={locale}
                        />
                      ) : null}
                    </motion.div>
                  )}
                </>
              ) : (
                <img
                  src={item.src}
                  alt={item.title}
                  className="lightbox-hero-img"
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : (
        <div
          className="lightbox-actual-scroller"
          style={{ right: inspectorOpen && viewport.width > 768 ? 316 : 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onRequestClose();
          }}
        >
          <img
            src={item.src}
            alt={item.title}
            className="lightbox-img lightbox-img--actual"
            onClick={(e) => {
              e.stopPropagation();
              setActualSize(false);
            }}
          />
        </div>
      )}

      {/* Prev / Next Floating Glass Arrows */}
      {!isReturning && prevItem && (
        <motion.button
          type="button"
          className="lightbox-nav-btn lightbox-nav-btn--prev"
          data-testid="lightbox-prev-btn"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          onClick={() => navigateWithDirection(prevItem.id, -1)}
          aria-label="Previous item"
        >
          ‹
        </motion.button>
      )}

      {!isReturning && nextItem && (
        <motion.button
          type="button"
          className="lightbox-nav-btn lightbox-nav-btn--next"
          data-testid="lightbox-next-btn"
          style={{ right: inspectorOpen && viewport.width > 768 ? 332 : 16 }}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          onClick={() => navigateWithDirection(nextItem.id, 1)}
          aria-label="Next item"
        >
          ›
        </motion.button>
      )}

      {/* Collapsible Right Inspector Drawer (Info + Similar Masonry Capsule) */}
      <AnimatePresence>
        {inspectorOpen && !isReturning && (
          <QuickLookInspectorPanel
            item={item}
            allItems={allItems ?? items}
            collections={collections}
            theme={theme}
            locale={locale}
            onUpdateTitle={(id, title) => onUpdateTitle?.(id, title)}
            onUpdateCollection={onUpdateCollection}
            onAddTagToItem={onAddTagToItem}
            onRemoveTagFromItem={onRemoveTagFromItem}
            onUpdateNote={onUpdateNote}
            onSelectSimilar={(targetId) => navigateWithDirection(targetId, 1)}
            onCloseMobile={() => setInspectorOpen(false)}
            onNotify={onNotify}
          />
        )}
      </AnimatePresence>

      {/* Bottom-Right Index / Auto / Copy / Export Frosted Pill */}
      <motion.div
        className="lightbox-bottom-dock"
        style={{
          right: inspectorOpen && !isReturning && viewport.width > 768 ? 336 : 20,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isReturning ? 0 : 1, y: isReturning ? 6 : 0 }}
        transition={{
          duration: isLanding ? 0 : isClosing ? 0.14 : 0.22,
          delay: isReturning ? 0 : 0.08,
          ease: HERO_MOTION_EASE,
        }}
      >
        <div className="dock-pill">
          {items.length > 1 && currentIndex >= 0 && (
            <>
              <span className="dock-counter" data-testid="lightbox-item-counter">
                {currentIndex + 1} / {items.length}
              </span>
              <span className="dock-sep" />
            </>
          )}
          {!isRich && item.kind !== "video" && (
            <>
              <button
                type="button"
                className={`dock-btn ${!actualSize ? "dock-btn--active" : ""}`}
                onClick={() => setActualSize((v) => !v)}
                data-testid="lightbox-auto-toggle"
              >
                {actualSize ? "100%" : m.qlAuto}
              </button>
              <span className="dock-sep" />
            </>
          )}
          <button
            type="button"
            className="dock-btn"
            onClick={handleCopyFilename}
            title={m.qlCopyFilename}
            aria-label={m.qlCopyFilename}
          >
            <CopyIcon size={13} />
          </button>
          <button
            type="button"
            className="dock-btn"
            onClick={handleExportDownload}
            title={m.qlExportOriginal}
            aria-label={m.qlExportOriginal}
          >
            <ExportIcon size={13} />
          </button>
        </div>
      </motion.div>
      {/* Full-Viewport Non-Destructive Video Editor Studio */}
      <AnimatePresence>
        {videoEditMode && item.kind === "video" && !isReturning && (
          <VideoNonDestructiveEditor
            item={item}
            libraryItems={items}
            theme={theme}
            locale={locale}
            onSaveRecipe={(itemId, nextRecipe) => {
              onUpdateVideoEdit?.(itemId, nextRecipe);
            }}
            onClose={() => setVideoEditMode(false)}
            onNotify={onNotify}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
