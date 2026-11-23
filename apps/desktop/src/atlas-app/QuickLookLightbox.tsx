import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { RichMediaCardContent } from "./RichMediaCardContent";

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
  collections: readonly CollectionItem[];
  onRequestClose: () => void;
  onCloseComplete: () => void;
  onNavigate: (id: string) => void;
  onToggleLike: (id: string) => void;
  onUpdateCollection: (id: string, collectionId: string | null) => void;
  onAddTagToItem: (id: string, tag: string) => void;
  onRemoveTagFromItem: (id: string, tag: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onTrashOrRestore: (id: string) => void;
  onPinToPip?: (item: LibraryItem) => void;
  onNotify: (message: string) => void;
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
  collections,
  onRequestClose,
  onCloseComplete,
  onNavigate,
  onToggleLike,
  onUpdateCollection,
  onAddTagToItem,
  onRemoveTagFromItem,
  onUpdateNote,
  onTrashOrRestore,
  onPinToPip,
  onNotify,
}: QuickLookLightboxProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  const [actualSize, setActualSize] = useState(false);
  const [model3dReady, setModel3dReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  }));
  const closeDoneRef = useRef(false);
  const veilPointerDownRef = useRef(false);

  const isClosing = phase === "closing";
  const isLanding = phase === "landing";
  const isReturning = isClosing || isLanding;

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setActualSize(false);
    setModel3dReady(false);
    setNewTagInput("");
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
    if (!item || isReturning) return;
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
        onNavigate(prevItem.id);
      } else if (e.key === "ArrowRight" && nextItem) {
        e.preventDefault();
        onNavigate(nextItem.id);
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
  }, [item, isReturning, prevItem, nextItem, onRequestClose, onNavigate, onToggleLike]);

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

  const handleTagFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagInput.trim().replace(/^#+/, "");
    if (!cleaned) return;
    onAddTagToItem(item.id, cleaned);
    setNewTagInput("");
  };

  const fallbackCenterRect: ScreenRect = {
    left: targetRect.left + targetRect.width * 0.08,
    top: targetRect.top + targetRect.height * 0.08,
    width: targetRect.width * 0.84,
    height: targetRect.height * 0.84,
  };

  const startRect = originRect ?? fallbackCenterRect;
  const resolvedReturnRect = returnRect ?? originRect;
  const endRect = isReturning ? (resolvedReturnRect ?? fallbackCenterRect) : targetRect;
  const isFadingOutFallback = isReturning && !resolvedReturnRect;
  const activeDuration = isLanding
    ? 0
    : (isClosing ? HERO_CLOSE_DURATION_S : HERO_OPEN_DURATION_S) *
      speedMultiplier;

  const isRich = isRichInteractiveKind(item.kind);
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

  return (
    <div
      className="lightbox-root"
      data-testid="quicklook-lightbox"
      data-closing={isReturning ? "true" : "false"}
      data-phase={phase}
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
            x: endRect.left,
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
            duration: activeDuration,
            ease: HERO_MOTION_EASE,
          }}
          onAnimationComplete={() => {
            if (isClosing && !closeDoneRef.current) {
              closeDoneRef.current = true;
              onCloseComplete();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isReturning && !isRich && item.kind !== "video") {
              setActualSize(true);
            }
          }}
        >
          {item.kind === "video" ? (
            !isReturning ? (
              <VideoQuickLookStage
                item={item}
                locale={locale}
                onPinToPip={(targetItem) => {
                  onPinToPip?.(targetItem);
                }}
              />
            ) : (
              <img
                src={item.src}
                alt={item.title}
                className="lightbox-hero-img"
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
                    <GifQuickLookViewer item={item} theme={theme} locale={locale} />
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
      ) : (
        <div
          className="lightbox-actual-scroller"
          style={{ right: inspectorOpen ? 276 : 0 }}
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
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          onClick={() => onNavigate(prevItem.id)}
          aria-label="Previous item"
        >
          ‹
        </motion.button>
      )}

      {!isReturning && nextItem && (
        <motion.button
          type="button"
          className="lightbox-nav-btn lightbox-nav-btn--next"
          style={{ right: inspectorOpen ? 292 : 16 }}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          onClick={() => onNavigate(nextItem.id)}
          aria-label="Next item"
        >
          ›
        </motion.button>
      )}

      {/* Collapsible Right Inspector Drawer */}
      <AnimatePresence>
        {inspectorOpen && !isReturning && (
          <motion.aside
            className="lightbox-inspector lightbox-inspector--floating"
            data-testid="lightbox-inspector"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
          >
            <div>
              <div className="inspector-label">{m.qlInspectorTitle}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</div>
            </div>

            <div>
              <div className="inspector-label">{m.qlInspectorPalette}</div>
              <div className="palette-row">
                {item.palette.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="palette-swatch"
                    style={{ background: hex }}
                    title={hex}
                    aria-label={hex}
                    onClick={() => {
                      navigator.clipboard?.writeText(hex).catch(() => {});
                      onNotify(hex);
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="inspector-label">{m.qlInspectorCollection}</div>
              <select
                className="inspector-tag-input"
                style={{ marginTop: 0 }}
                value={item.collectionId ?? ""}
                onChange={(e) =>
                  onUpdateCollection(
                    item.id,
                    e.target.value ? e.target.value : null,
                  )
                }
              >
                <option value="">{m.qlInspectorInboxUnsorted}</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="inspector-label">{m.qlInspectorTags}</div>
              <div className="inspector-tags">
                {item.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="inspector-tag-btn"
                    onClick={() => onRemoveTagFromItem(item.id, tag)}
                  >
                    #{tag} ×
                  </button>
                ))}
              </div>
              <form onSubmit={handleTagFormSubmit}>
                <input
                  type="text"
                  className="inspector-tag-input"
                  placeholder={m.qlInspectorAddTagPlaceholder}
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                />
              </form>
            </div>

            <div>
              <div className="inspector-label">{m.qlInspectorNotes}</div>
              <textarea
                className="inspector-tag-input"
                style={{
                  height: 82,
                  padding: "8px 10px",
                  marginTop: 0,
                  resize: "vertical",
                }}
                value={item.note}
                placeholder={m.qlInspectorNotesPlaceholder}
                onChange={(e) => onUpdateNote(item.id, e.target.value)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Bottom-Right Auto / Copy / Export Frosted Pill */}
      <motion.div
        className="lightbox-bottom-dock"
        style={{ right: inspectorOpen && !isReturning ? 296 : 20 }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isReturning ? 0 : 1, y: isReturning ? 6 : 0 }}
        transition={{
          duration: isLanding ? 0 : isClosing ? 0.14 : 0.22,
          delay: isReturning ? 0 : 0.08,
          ease: HERO_MOTION_EASE,
        }}
      >
        <div className="dock-pill">
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
    </div>
  );
}
