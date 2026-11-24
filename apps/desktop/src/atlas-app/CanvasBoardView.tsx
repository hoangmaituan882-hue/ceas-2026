import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HeartIcon, LinkIcon } from "./AppIcons";
import {
  computeMagneticSnap,
  resolveCanvasPushCollisions,
  type CanvasNodeBox,
  type SnapGuide,
} from "./canvas-physics";
import { CanvasFloatingToolbars } from "./CanvasFloatingToolbars";
import {
  CanvasCommentPinWidget,
  CanvasNoteCardWidget,
} from "./CanvasSpatialWidgets";
import {
  addReplyToCommentPin,
  computeCanvasFitViewport,
  computePanToCenterWorldPoint,
  createCanvasCommentPin,
  createCanvasNote,
  findCanvasMatches,
  stepMatchIndex,
  toggleReactionOnList,
  type CanvasCommentPin,
  type CanvasNoteCard,
  type CanvasToolMode,
} from "./canvas-tools-engine";
import {
  computeDragVelocityTilt,
  computeMarqueeSelectedIds,
  normalizeMarqueeRect,
  parseSidebarDropTarget,
  type SidebarDropTarget,
} from "./drag-selection-engine";
import {
  DragStackOverlay,
  type DragOverlaySession,
} from "./DragStackOverlay";
import {
  computeNeighborPushOffset,
  HERO_CLOSE_DURATION_S,
  HERO_CSS_EASE,
  HERO_OPEN_DURATION_S,
  type HeroPushContext,
  type ScreenRect,
} from "./hero-transition";
import {
  getMessages,
  type AppLocale,
  type WheelZoomMode,
} from "./i18n";
import type { CollectionItem, LibraryItem, ThemeMode } from "./library-engine";
import {
  atomicMediaPlayerManager,
  useAtomicMediaVersion,
} from "./AtomicMediaPlayerHost";
import { formatAudioTime } from "./media-helpers";
import { RichMediaCardContent } from "./RichMediaCardContent";
import {
  computeCanvasRevealForCollapse,
  computeCursorAnchoredPan,
  computeWheelZoomNext,
  type CollapseRevealHandler,
} from "./viewport-motion";

export interface CanvasBoardViewProps {
  items: readonly LibraryItem[];
  collections: readonly CollectionItem[];
  theme: ThemeMode;
  zoom: number;
  radius: number;
  selectedIds: ReadonlySet<string>;
  lastFocusedId: string | null;
  activeHeroKey: string | null;
  heroPush: HeroPushContext;
  sidebarOffset: number;
  resetSignal: number;
  locale: AppLocale;
  showCardBadges: boolean;
  speedMultiplier: number;
  inertiaEnabled: boolean;
  wheelZoomMode: WheelZoomMode;
  onZoomChange: (nextZoom: number) => void;
  onMoveItems: (
    updates: readonly { id: string; x: number; y: number; w?: number }[],
  ) => void;
  onBringToFront: (id: string) => void;
  onSelectItem: (id: string, additive: boolean) => void;
  onSetSelectedIds: (nextIds: Set<string>) => void;
  onToggleLike: (id: string) => void;
  onClearSelection: () => void;
  onOpenQuickLook: (id: string, originRect: ScreenRect, originKey?: string) => void;
  onHoverSidebarTarget: (targetKey: string | null) => void;
  onDropToSidebar: (itemIds: string[], target: SidebarDropTarget) => void;
  onImportClick: () => void;
  onTidyCanvas: () => void;
  onRegisterRevealHandler?: (handler: CollapseRevealHandler | null) => void;
}

interface DragState {
  mode: "pan" | "marquee" | "node" | "widget";
  sessionId: number;
  itemId?: string;
  widgetKind?: "note" | "comment";
  widgetId?: string;
  widgetOrigX?: number;
  widgetOrigY?: number;
  draggedIds: string[];
  draggedSet: Set<string>;
  draggedItems: LibraryItem[];
  baseBoxes: CanvasNodeBox[];
  origPositions: Record<string, { x: number; y: number }>;
  origScreenRects: Record<string, ScreenRect>;
  lastResolvedPositions: Record<string, { x: number; y: number }> | null;
  primaryOriginRect: ScreenRect;
  grabOffsetX: number;
  grabOffsetY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  origPanX: number;
  origPanY: number;
  additive: boolean;
  baselineIds: Set<string>;
  vx: number;
  vy: number;
  tiltDeg: number;
  moved: boolean;
  overSidebarArea: boolean;
  sidebarTarget: SidebarDropTarget | null;
  cardEl: HTMLElement | null;
}

const CANVAS_PUSH_GAP = 12;
const CANVAS_GLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const INITIAL_CANVAS_COMMENTS: CanvasCommentPin[] = [
  {
    id: "pin-seed-1",
    number: 1,
    x: 526,
    y: 94,
    author: "Studio",
    text: "Keep the breathing gap between hardware objects and typography studies.",
    createdAt: "2h ago",
    replies: [],
    reactions: ["✨"],
    resolved: false,
  },
];

export function CanvasBoardView({
  items,
  collections,
  theme,
  zoom,
  radius,
  selectedIds,
  lastFocusedId,
  activeHeroKey,
  heroPush,
  sidebarOffset,
  resetSignal,
  locale,
  showCardBadges,
  speedMultiplier,
  inertiaEnabled,
  wheelZoomMode,
  onZoomChange,
  onMoveItems,
  onBringToFront,
  onSelectItem,
  onSetSelectedIds,
  onToggleLike,
  onClearSelection,
  onOpenQuickLook,
  onHoverSidebarTarget,
  onDropToSidebar,
  onImportClick,
  onTidyCanvas,
  onRegisterRevealHandler,
}: CanvasBoardViewProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  useAtomicMediaVersion();
  const initialPanX = sidebarOffset > 0 ? 236 : 42;
  const [pan, setPan] = useState({ x: initialPanX, y: 52 });
  const [smoothCamera, setSmoothCamera] = useState(false);
  const [smoothDurationMs, setSmoothDurationMs] = useState(320);
  const [toolMode, setToolMode] = useState<CanvasToolMode>("select");
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [livePositions, setLivePositions] = useState<
    Record<string, { x: number; y: number }> | null
  >(null);
  const [pushedIds, setPushedIds] = useState<Set<string>>(() => new Set());
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<ScreenRect | null>(null);
  const [dragSession, setDragSession] = useState<DragOverlaySession | null>(null);

  // Spatial Note Cards, Comment Pins & Find-on-Canvas state
  const [notes, setNotes] = useState<CanvasNoteCard[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [comments, setComments] = useState<CanvasCommentPin[]>(INITIAL_CANVAS_COMMENTS);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [pendingCommentPoint, setPendingCommentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const coastRafRef = useRef<number | null>(null);
  const smoothTimerRef = useRef<number | null>(null);
  const sessionSeqRef = useRef(1);
  const widgetSeqRef = useRef(2);
  const justDraggedWidgetIdRef = useRef<string | null>(null);

  // Fresh refs for native non-passive cursor-following wheel zoom & collapse reveal
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const wheelZoomModeRef = useRef(wheelZoomMode);
  wheelZoomModeRef.current = wheelZoomMode;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const lastStagePointerRef = useRef<{ x: number; y: number; inside: boolean }>({
    x: 0,
    y: 0,
    inside: false,
  });
  const prevZoomRef = useRef(zoom);
  const zoomHandledInternallyRef = useRef<number | null>(null);

  const triggerSmoothCamera = useCallback((durationMs = 320) => {
    const safeMs = Math.max(120, Math.round(durationMs));
    setSmoothDurationMs(safeMs);
    setSmoothCamera(true);
    if (smoothTimerRef.current !== null) {
      window.clearTimeout(smoothTimerRef.current);
    }
    smoothTimerRef.current = window.setTimeout(() => {
      setSmoothCamera(false);
      smoothTimerRef.current = null;
    }, safeMs + 24);
  }, []);

  const stopCoasting = useCallback(() => {
    if (coastRafRef.current !== null) {
      cancelAnimationFrame(coastRafRef.current);
      coastRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopCoasting();
    triggerSmoothCamera();
    setPan({ x: sidebarOffset > 0 ? 236 : 42, y: 66 });
  }, [resetSignal, sidebarOffset, stopCoasting, triggerSmoothCamera]);

  useEffect(() => {
    return () => {
      stopCoasting();
      if (smoothTimerRef.current !== null) {
        window.clearTimeout(smoothTimerRef.current);
      }
    };
  }, [stopCoasting]);

  const findMatches = useMemo(
    () => findCanvasMatches(items, notes, comments, findQuery),
    [items, notes, comments, findQuery],
  );

  const activeSearchMatch =
    findOpen && findMatches.length > 0
      ? findMatches[Math.min(findMatchIndex, findMatches.length - 1)] ?? null
      : null;

  const focusWorldRect = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const stageRect = stageRef.current?.getBoundingClientRect();
      const vw = stageRect?.width ?? window.innerWidth;
      const vh = stageRect?.height ?? window.innerHeight;
      triggerSmoothCamera();
      setPan(
        computePanToCenterWorldPoint(
          x + w * 0.5,
          y + h * 0.5,
          zoom,
          vw,
          vh,
          sidebarOffset,
        ),
      );
    },
    [zoom, sidebarOffset, triggerSmoothCamera],
  );

  const handleStepZoom = useCallback(
    (delta: number) => {
      stopCoasting();
      const stageRect = stageRef.current?.getBoundingClientRect();
      const vw = stageRect?.width ?? window.innerWidth;
      const vh = stageRect?.height ?? window.innerHeight;
      const centerX = sidebarOffset + (vw - sidebarOffset) * 0.5;
      const centerY = vh * 0.5;
      const nextZoom = Math.min(
        2.4,
        Math.max(0.65, Math.round((zoom + delta) * 100) / 100),
      );
      if (nextZoom === zoom) return;
      zoomHandledInternallyRef.current = nextZoom;
      triggerSmoothCamera(260);
      setPan((prev) =>
        computeCursorAnchoredPan(prev, zoom, nextZoom, centerX, centerY),
      );
      onZoomChange(nextZoom);
    },
    [zoom, sidebarOffset, onZoomChange, stopCoasting, triggerSmoothCamera],
  );

  // Anchor zoom cleanly when changed via external bottom zoom slider
  useLayoutEffect(() => {
    const prevZoom = prevZoomRef.current;
    if (prevZoom !== zoom) {
      if (zoomHandledInternallyRef.current === zoom) {
        zoomHandledInternallyRef.current = null;
      } else {
        const stageRect = stageRef.current?.getBoundingClientRect();
        const vw = stageRect?.width ?? window.innerWidth;
        const vh = stageRect?.height ?? window.innerHeight;
        const ptr = lastStagePointerRef.current;
        const anchorX = ptr.inside ? ptr.x : sidebarOffset + (vw - sidebarOffset) * 0.5;
        const anchorY = ptr.inside ? ptr.y : vh * 0.5;
        setPan((prev) =>
          computeCursorAnchoredPan(prev, prevZoom, zoom, anchorX, anchorY),
        );
      }
      prevZoomRef.current = zoom;
    }
  }, [zoom, sidebarOffset]);

  // Native non-passive wheel listener: zoom follows the cursor smoothly on pinch / Ctrl+wheel / direct mode
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onNativeWheel = (e: WheelEvent) => {
      stopCoasting();
      const shouldZoom =
        wheelZoomModeRef.current === "direct" || e.ctrlKey || e.metaKey;
      if (shouldZoom) {
        e.preventDefault();
        const stageRect = stage.getBoundingClientRect();
        const pointerX = e.clientX - stageRect.left;
        const pointerY = e.clientY - stageRect.top;
        lastStagePointerRef.current = { x: pointerX, y: pointerY, inside: true };

        const curZoom = zoomRef.current;
        const nextZoom = computeWheelZoomNext(
          curZoom,
          e.deltaY,
          e.ctrlKey || e.metaKey,
        );
        if (nextZoom !== curZoom) {
          zoomHandledInternallyRef.current = nextZoom;
          setSmoothCamera(false);
          setPan((prev) =>
            computeCursorAnchoredPan(prev, curZoom, nextZoom, pointerX, pointerY),
          );
          onZoomChangeRef.current(nextZoom);
        }
      } else {
        e.preventDefault();
        setSmoothCamera(false);
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
    stage.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onNativeWheel);
  }, [stopCoasting]);

  // Register collapse-reveal handler: collapsing an off-screen Canvas item automatically pans
  // it smoothly into view in lockstep with QuickLook collapse and returns its exact post-pan rect!
  useEffect(() => {
    if (!onRegisterRevealHandler) return;
    const handler: CollapseRevealHandler = (itemId, _preferredKey, durationMs) => {
      const stage = stageRef.current;
      if (!stage) return null;
      const item = itemsRef.current.find((it) => it.id === itemId);
      if (!item) return null;

      const aspect = item.height > 0 ? item.width / item.height : 1;
      const nodeH = Math.round(item.canvasW / aspect);
      const stageRect = stage.getBoundingClientRect();
      const reveal = computeCanvasRevealForCollapse(
        {
          x: item.canvasX,
          y: item.canvasY,
          width: item.canvasW,
          height: nodeH,
        },
        panRef.current,
        zoomRef.current,
        stageRect.left,
        stageRect.top,
        stageRect.width,
        stageRect.height,
        sidebarOffset,
        72,
      );

      if (reveal.needsPan) {
        stopCoasting();
        triggerSmoothCamera(durationMs);
        setPan(reveal.targetPan);
      }

      return {
        cardKey: `canvas:${item.id}`,
        didReveal: reveal.needsPan,
        rect: reveal.finalScreenRect,
      };
    };

    onRegisterRevealHandler(handler);
    return () => onRegisterRevealHandler(null);
  }, [onRegisterRevealHandler, sidebarOffset, stopCoasting, triggerSmoothCamera]);

  const handleFitView = useCallback(() => {
    stopCoasting();
    const stageRect = stageRef.current?.getBoundingClientRect();
    const vw = stageRect?.width ?? window.innerWidth;
    const vh = stageRect?.height ?? window.innerHeight;

    const boxes: CanvasNodeBox[] = [
      ...items.map((it) => {
        const aspect = it.height > 0 ? it.width / it.height : 1;
        return {
          id: it.id,
          x: it.canvasX,
          y: it.canvasY,
          width: it.canvasW,
          height: Math.round(it.canvasW / aspect),
        };
      }),
      ...notes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        width: n.width,
        height: 156,
      })),
      ...comments
        .filter((c) => !c.resolved)
        .map((c) => ({
          id: c.id,
          x: c.x,
          y: c.y,
          width: 36,
          height: 36,
        })),
    ];

    const fit = computeCanvasFitViewport(boxes, vw, vh, sidebarOffset, 50);
    zoomHandledInternallyRef.current = fit.zoom;
    triggerSmoothCamera(320);
    setPan({ x: fit.panX, y: fit.panY });
    onZoomChange(fit.zoom);
  }, [items, notes, comments, sidebarOffset, onZoomChange, stopCoasting, triggerSmoothCamera]);

  const getViewportCenterWorld = useCallback(() => {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const vw = stageRect?.width ?? window.innerWidth;
    const vh = stageRect?.height ?? window.innerHeight;
    const screenCx = sidebarOffset + (vw - sidebarOffset) * 0.5;
    const screenCy = vh * 0.44;
    return {
      x: Math.round((screenCx - pan.x) / zoom),
      y: Math.round((screenCy - pan.y) / zoom),
    };
  }, [pan.x, pan.y, zoom, sidebarOffset]);

  const handleAddNote = useCallback(() => {
    const center = getViewportCenterWorld();
    const id = `note-${++widgetSeqRef.current}`;
    const offset = (notes.length % 4) * 22;
    const created = createCanvasNote(
      id,
      center.x - 124 + offset,
      center.y - 68 + offset,
      8600 + notes.length,
    );
    setNotes((prev) => [...prev, created]);
    setActiveNoteId(id);
    setOpenCommentId(null);
    setCommentComposerOpen(false);
    setToolMode("select");
  }, [getViewportCenterWorld, notes.length]);

  const handleSubmitQuickComment = useCallback(
    (text: string) => {
      const anchor = pendingCommentPoint ?? getViewportCenterWorld();
      const nextNum =
        comments.reduce((acc, c) => Math.max(acc, c.number), 0) + 1;
      const pin = createCanvasCommentPin(
        `pin-${++widgetSeqRef.current}`,
        nextNum,
        anchor.x,
        anchor.y,
        text,
        m.canvasAuthorYou,
        m.canvasJustNow,
      );
      setComments((prev) => [...prev, pin]);
      setOpenCommentId(pin.id);
      setCommentComposerOpen(false);
      setPendingCommentPoint(null);
      setToolMode("select");
    },
    [pendingCommentPoint, getViewportCenterWorld, comments, m.canvasAuthorYou, m.canvasJustNow],
  );

  // Canvas keyboard shortcuts: Space (temporary hand-pan), V (select), H (pan), C (comment), N (note), 0 (fit), ⌘F (find)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editing =
        Boolean(t) &&
        (t!.tagName === "INPUT" ||
          t!.tagName === "TEXTAREA" ||
          t!.tagName === "SELECT");

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        return;
      }

      if (editing) return;

      if (e.code === "Space") {
        setSpacePressed(true);
      } else if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
        setToolMode("select");
      } else if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey) {
        setToolMode((cur) => (cur === "pan" ? "select" : "pan"));
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        setToolMode("comment");
        setCommentComposerOpen(true);
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAddNote();
      } else if (e.key === "0" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleFitView();
      } else if (e.key === "Escape") {
        setFindOpen(false);
        setCommentComposerOpen(false);
        setPendingCommentPoint(null);
        setOpenCommentId(null);
        setActiveNoteId(null);
        setToolMode("select");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    const onBlur = () => setSpacePressed(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [handleAddNote, handleFitView]);

  const getSidebarTargetLabel = useCallback(
    (target: SidebarDropTarget | null): string | null => {
      if (!target) return null;
      if (target.kind === "inbox") return m.dragTargetMoveTo(m.navInbox);
      if (target.kind === "likes") return m.dragTargetLike;
      if (target.kind === "trash") return m.dragTargetTrash;
      if (target.kind === "tag") return m.dragTargetAddTag(target.tagName);
      const col = collections.find((c) => c.id === target.collectionId);
      return m.dragTargetMoveTo(col?.name ?? m.sectionCollections);
    },
    [collections, m],
  );

  const hitTestSidebarTarget = (
    clientX: number,
    clientY: number,
  ): SidebarDropTarget | null => {
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const el of hits) {
      if (!(el instanceof HTMLElement)) continue;
      const parsed = parseSidebarDropTarget(el.dataset.dropSidebarTarget);
      if (parsed) return parsed;
    }
    return null;
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const isPanGesture = e.button === 1 || spacePressed || toolMode === "pan";
    const targetEl = e.target as HTMLElement | null;

    // In Select/Comment mode, ignore pointerdowns that belong to cards or spatial widgets
    if (
      !isPanGesture &&
      (targetEl?.closest(".canvas-node") ||
        targetEl?.closest("[data-canvas-widget]"))
    ) {
      return;
    }

    stopCoasting();
    setSmoothCamera(false);

    // Comment Pin placement click on empty canvas whitespace
    if (!isPanGesture && toolMode === "comment" && e.button === 0) {
      const sr = stageRef.current?.getBoundingClientRect();
      const worldX = Math.round(((e.clientX - (sr?.left ?? 0)) - pan.x) / zoom);
      const worldY = Math.round(((e.clientY - (sr?.top ?? 0)) - pan.y) / zoom);
      setPendingCommentPoint({ x: worldX, y: worldY });
      setCommentComposerOpen(true);
      setOpenCommentId(null);
      setActiveNoteId(null);
      return;
    }

    setActiveNoteId(null);
    setOpenCommentId(null);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (isPanGesture) {
      setIsPanning(true);
    }

    dragRef.current = {
      mode: isPanGesture ? "pan" : "marquee",
      sessionId: ++sessionSeqRef.current,
      draggedIds: [],
      draggedSet: new Set(),
      draggedItems: [],
      baseBoxes: [],
      origPositions: {},
      origScreenRects: {},
      lastResolvedPositions: null,
      primaryOriginRect: { left: 0, top: 0, width: 0, height: 0 },
      grabOffsetX: 0,
      grabOffsetY: 0,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
      baselineIds: new Set(selectedIds),
      vx: 0,
      vy: 0,
      tiltDeg: 0,
      moved: false,
      overSidebarArea: false,
      sidebarTarget: null,
      cardEl: null,
    };
  };

  const handleWidgetPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    kind: "note" | "comment",
    id: string,
    origX: number,
    origY: number,
  ) => {
    if (e.button !== 0) return;
    if (toolMode === "pan" || spacePressed) return;
    e.stopPropagation();
    stopCoasting();
    setSmoothCamera(false);

    dragRef.current = {
      mode: "widget",
      sessionId: ++sessionSeqRef.current,
      widgetKind: kind,
      widgetId: id,
      widgetOrigX: origX,
      widgetOrigY: origY,
      draggedIds: [],
      draggedSet: new Set(),
      draggedItems: [],
      baseBoxes: [],
      origPositions: {},
      origScreenRects: {},
      lastResolvedPositions: null,
      primaryOriginRect: { left: 0, top: 0, width: 0, height: 0 },
      grabOffsetX: 0,
      grabOffsetY: 0,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
      additive: false,
      baselineIds: new Set(selectedIds),
      vx: 0,
      vy: 0,
      tiltDeg: 0,
      moved: false,
      overSidebarArea: false,
      sidebarTarget: null,
      cardEl: null,
    };
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: LibraryItem,
  ) => {
    if (e.button !== 0) return;
    // When Hand Pan mode or Spacebar is active, allow pointerdown to bubble to stage for seamless full-board panning!
    if (toolMode === "pan" || spacePressed) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    e.stopPropagation();
    stopCoasting();
    setSmoothCamera(false);
    setActiveNoteId(null);
    setOpenCommentId(null);
    onBringToFront(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);

    const isGroupDrag = selectedIds.has(item.id) && selectedIds.size > 1;
    const groupIds = isGroupDrag
      ? [
          item.id,
          ...items
            .filter((it) => it.id !== item.id && selectedIds.has(it.id))
            .map((it) => it.id),
        ]
      : [item.id];

    const byId = new Map(items.map((it) => [it.id, it] as const));
    const groupItems = groupIds
      .map((id) => byId.get(id))
      .filter((it): it is LibraryItem => Boolean(it));

    const origPositions: Record<string, { x: number; y: number }> = {};
    const origScreenRects: Record<string, ScreenRect> = {};
    const stageRect = stageRef.current?.getBoundingClientRect();
    const sLeft = stageRect?.left ?? 0;
    const sTop = stageRect?.top ?? 0;

    // Snapshot EVERY visible card's pre-drag bounding box for live 2D push physics
    const baseBoxes: CanvasNodeBox[] = items.map((it) => {
      const aspect = it.height > 0 ? it.width / it.height : 1;
      const nodeH = Math.round(it.canvasW / aspect);
      return {
        id: it.id,
        x: it.canvasX,
        y: it.canvasY,
        width: it.canvasW,
        height: nodeH,
      };
    });

    for (const it of groupItems) {
      origPositions[it.id] = { x: it.canvasX, y: it.canvasY };
      const aspect = it.height > 0 ? it.width / it.height : 1;
      const nodeH = Math.round(it.canvasW / aspect);
      origScreenRects[it.id] = {
        left: sLeft + pan.x + it.canvasX * zoom,
        top: sTop + pan.y + it.canvasY * zoom,
        width: it.canvasW * zoom,
        height: nodeH * zoom,
      };
    }

    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      mode: "node",
      sessionId: ++sessionSeqRef.current,
      itemId: item.id,
      draggedIds: groupIds,
      draggedSet: new Set(groupIds),
      draggedItems: groupItems,
      baseBoxes,
      origPositions,
      origScreenRects,
      lastResolvedPositions: null,
      primaryOriginRect: {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      },
      grabOffsetX: e.clientX - r.left,
      grabOffsetY: e.clientY - r.top,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
      additive: false,
      baselineIds: new Set(selectedIds),
      vx: 0,
      vy: 0,
      tiltDeg: 0,
      moved: false,
      overSidebarArea: false,
      sidebarTarget: null,
      cardEl: e.currentTarget,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    if (!drag.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      drag.moved = true;
      if (drag.mode === "node") {
        setDraggingIds(new Set(drag.draggedIds));
      } else if (drag.mode === "widget") {
        justDraggedWidgetIdRef.current = drag.widgetId ?? null;
        try {
          stageRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if pointer capture is unavailable
        }
      }
    }

    drag.vx = e.clientX - drag.lastClientX;
    drag.vy = e.clientY - drag.lastClientY;
    drag.lastClientX = e.clientX;
    drag.lastClientY = e.clientY;

    if (drag.mode === "pan") {
      setPan({ x: drag.origPanX + dx, y: drag.origPanY + dy });
      return;
    }

    if (drag.mode === "widget" && drag.moved && drag.widgetId) {
      const nextX = Math.round((drag.widgetOrigX ?? 0) + dx / zoom);
      const nextY = Math.round((drag.widgetOrigY ?? 0) + dy / zoom);
      if (drag.widgetKind === "note") {
        setNotes((prev) =>
          prev.map((n) => (n.id === drag.widgetId ? { ...n, x: nextX, y: nextY } : n)),
        );
      } else if (drag.widgetKind === "comment") {
        setComments((prev) =>
          prev.map((c) => (c.id === drag.widgetId ? { ...c, x: nextX, y: nextY } : c)),
        );
      }
      return;
    }

    if (drag.mode === "marquee" && drag.moved) {
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const sr = stageEl.getBoundingClientRect();
      const box = normalizeMarqueeRect(
        drag.startClientX - sr.left,
        drag.startClientY - sr.top,
        e.clientX - sr.left,
        e.clientY - sr.top,
      );
      setMarqueeBox(box);

      const nodeRects = items.map((item) => {
        const aspect = item.height > 0 ? item.width / item.height : 1;
        const nodeH = Math.round(item.canvasW / aspect);
        return {
          id: item.id,
          rect: {
            left: pan.x + item.canvasX * zoom,
            top: pan.y + item.canvasY * zoom,
            width: item.canvasW * zoom,
            height: nodeH * zoom,
          },
        };
      });
      const nextSelected = computeMarqueeSelectedIds(
        box,
        nodeRects,
        drag.baselineIds,
        drag.additive,
      );
      onSetSelectedIds(nextSelected);
      return;
    }

    if (drag.mode === "node" && drag.moved) {
      drag.tiltDeg = computeDragVelocityTilt(drag.vx, drag.tiltDeg);
      const sidebarTarget = hitTestSidebarTarget(e.clientX, e.clientY);
      const inSidebarZone =
        sidebarTarget !== null ||
        (sidebarOffset > 0 && e.clientX < sidebarOffset + 8);
      drag.sidebarTarget = sidebarTarget;
      drag.overSidebarArea = inSidebarZone;
      onHoverSidebarTarget(sidebarTarget?.key ?? null);

      if (inSidebarZone) {
        // Let any parted Canvas cards glide back smoothly while dragging into Sidebar
        drag.lastResolvedPositions = null;
        setLivePositions(null);
        setPushedIds(new Set());
        setSnapGuides([]);

        // Collapse into Finder stacked ghost when pulled into the sidebar!
        setDragSession({
          id: drag.sessionId,
          phase: "dragging",
          items: drag.draggedItems,
          pointerX: e.clientX,
          pointerY: e.clientY,
          grabOffsetX: drag.grabOffsetX,
          grabOffsetY: drag.grabOffsetY,
          primaryOriginRect: drag.primaryOriginRect,
          targetRectsById: {},
          flyInTargetPoint: null,
          sidebarTarget,
          sidebarTargetLabel: getSidebarTargetLabel(sidebarTarget),
          outOfBounds: !sidebarTarget,
          tiltDeg: drag.tiltDeg,
          radius,
          returnHintLabel: m.dragReturnHint,
        });
      } else {
        setDragSession(null);
        const worldDx = dx / zoom;
        const worldDy = dy / zoom;

        // Compute aggregate bounding box of dragged card(s) at raw cursor target
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const unselectedNeighbors: CanvasNodeBox[] = [];

        for (const b of drag.baseBoxes) {
          if (drag.draggedSet.has(b.id)) {
            const nx = b.x + worldDx;
            const ny = b.y + worldDy;
            if (nx < minX) minX = nx;
            if (ny < minY) minY = ny;
            if (nx + b.width > maxX) maxX = nx + b.width;
            if (ny + b.height > maxY) maxY = ny + b.height;
          } else {
            unselectedNeighbors.push(b);
          }
        }

        // Delicate magnetic snapping to nearby neighbor edges (hold Alt to bypass)
        const snap =
          !e.altKey && Number.isFinite(minX)
            ? computeMagneticSnap(
                {
                  x: minX,
                  y: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                },
                unselectedNeighbors,
                CANVAS_PUSH_GAP,
                9,
              )
            : { dx: 0, dy: 0, guides: [] };

        // Solve live 2D rigid-body push collisions from the pre-drag board snapshot
        const candidateBoxes: CanvasNodeBox[] = drag.baseBoxes.map((b) => {
          if (!drag.draggedSet.has(b.id)) return b;
          return {
            ...b,
            x: Math.round(b.x + worldDx + snap.dx),
            y: Math.round(b.y + worldDy + snap.dy),
          };
        });

        const resolved = resolveCanvasPushCollisions(
          candidateBoxes,
          drag.draggedSet,
          CANVAS_PUSH_GAP,
          18,
        );

        drag.lastResolvedPositions = resolved.positions;
        setLivePositions(resolved.positions);
        setPushedIds(resolved.pushedIds);
        setSnapGuides(snap.guides);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDraggingIds(new Set());
    setLivePositions(null);
    setPushedIds(new Set());
    setSnapGuides([]);
    setIsPanning(false);
    setMarqueeBox(null);
    onHoverSidebarTarget(null);

    if (drag.mode === "widget") {
      if (drag.moved) {
        const draggedId = drag.widgetId ?? null;
        window.setTimeout(() => {
          if (justDraggedWidgetIdRef.current === draggedId) {
            justDraggedWidgetIdRef.current = null;
          }
        }, 120);
      } else {
        justDraggedWidgetIdRef.current = null;
      }
      return;
    }

    if (drag.mode === "marquee") {
      if (!drag.moved) {
        onClearSelection();
      }
      return;
    }

    if (drag.mode === "pan") {
      if (!inertiaEnabled) return;
      let vx = drag.vx * 0.92;
      let vy = drag.vy * 0.92;
      if (Math.hypot(vx, vy) > 1.3) {
        const coast = () => {
          vx *= 0.92;
          vy *= 0.92;
          if (Math.hypot(vx, vy) < 0.28) {
            coastRafRef.current = null;
            return;
          }
          setPan((prev) => ({ x: prev.x + vx, y: prev.y + vy }));
          coastRafRef.current = requestAnimationFrame(coast);
        };
        coastRafRef.current = requestAnimationFrame(coast);
      }
      return;
    }

    // Node dropped onto a valid sidebar target -> Stacked Fly-In Suction!
    if (drag.mode === "node" && drag.moved && drag.sidebarTarget) {
      const target = drag.sidebarTarget;
      const targetEl = document.querySelector<HTMLElement>(
        `[data-drop-sidebar-target="${CSS.escape(target.key)}"]`,
      );
      const r = targetEl?.getBoundingClientRect();
      const flyPoint = r
        ? { x: r.left + 22, y: r.top + r.height * 0.5 }
        : { x: e.clientX, y: e.clientY };

      // Restore pre-drag canvas coordinates so cards stay neatly placed on the board
      const restoreUpdates = drag.draggedIds
        .map((id) => {
          const orig = drag.origPositions[id];
          return orig ? { id, x: orig.x, y: orig.y } : null;
        })
        .filter((u): u is { id: string; x: number; y: number } => Boolean(u));
      if (restoreUpdates.length > 0) onMoveItems(restoreUpdates);

      setDragSession({
        id: drag.sessionId,
        phase: "fly-in",
        items: drag.draggedItems,
        pointerX: e.clientX,
        pointerY: e.clientY,
        grabOffsetX: drag.grabOffsetX,
        grabOffsetY: drag.grabOffsetY,
        primaryOriginRect: drag.primaryOriginRect,
        targetRectsById: {},
        flyInTargetPoint: flyPoint,
        sidebarTarget: target,
        sidebarTargetLabel: null,
        outOfBounds: false,
        tiltDeg: drag.tiltDeg,
        radius,
        returnHintLabel: m.dragReturnHint,
      });

      const droppedIds = [...drag.draggedIds];
      window.setTimeout(() => {
        onDropToSidebar(droppedIds, target);
      }, 120);
      return;
    }

    // Node dropped on non-droppable sidebar area -> Elastic Snap-Back to pre-drag board position!
    if (drag.mode === "node" && drag.moved && drag.overSidebarArea) {
      const restoreUpdates = drag.draggedIds
        .map((id) => {
          const orig = drag.origPositions[id];
          return orig ? { id, x: orig.x, y: orig.y } : null;
        })
        .filter((u): u is { id: string; x: number; y: number } => Boolean(u));
      if (restoreUpdates.length > 0) onMoveItems(restoreUpdates);

      setDragSession({
        id: drag.sessionId,
        phase: "snap-back",
        items: drag.draggedItems,
        pointerX: e.clientX,
        pointerY: e.clientY,
        grabOffsetX: drag.grabOffsetX,
        grabOffsetY: drag.grabOffsetY,
        primaryOriginRect: drag.primaryOriginRect,
        targetRectsById: drag.origScreenRects,
        flyInTargetPoint: null,
        sidebarTarget: null,
        sidebarTargetLabel: null,
        outOfBounds: true,
        tiltDeg: drag.tiltDeg,
        radius,
        returnHintLabel: m.dragReturnHint,
      });
      return;
    }

    // Commit final resolved Canvas positions (both dragged card(s) and all pushed neighbors!)
    if (drag.mode === "node" && drag.moved && drag.lastResolvedPositions) {
      const updates: { id: string; x: number; y: number }[] = [];
      for (const b of drag.baseBoxes) {
        const next = drag.lastResolvedPositions[b.id];
        if (next && (next.x !== b.x || next.y !== b.y)) {
          updates.push({ id: b.id, x: next.x, y: next.y });
        }
      }
      if (updates.length > 0) {
        onMoveItems(updates);
      }
    }

    setDragSession(null);

    // Clean click without drag on a whiteboard card -> Shared-Element Hero Morph into QuickLook!
    if (drag.mode === "node" && !drag.moved && drag.itemId) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        onSelectItem(drag.itemId, true);
        return;
      }
      const rectSource = drag.cardEl ?? (e.currentTarget as HTMLElement);
      const r = rectSource.getBoundingClientRect();
      onOpenQuickLook(
        drag.itemId,
        {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        },
        `canvas:${drag.itemId}`,
      );
    }
  };

  const handleFlightComplete = useCallback((sessionId: number) => {
    setDragSession((prev) => (prev && prev.id === sessionId ? null : prev));
  }, []);

  const overlayHiddenIds = useMemo(() => {
    if (!dragSession) return new Set<string>();
    return new Set(dragSession.items.map((it) => it.id));
  }, [dragSession]);

  if (items.length === 0) {
    return (
      <div className="atlas-empty">
        <strong>{m.emptyCanvasTitle}</strong>
        <span>{m.emptyCanvasSub}</span>
      </div>
    );
  }

  const stageRect = stageRef.current?.getBoundingClientRect();
  const stageLeft = stageRect?.left ?? 0;
  const stageTop = stageRect?.top ?? 0;
  const pushDurationMs = Math.round(
    (heroPush.active ? HERO_OPEN_DURATION_S : HERO_CLOSE_DURATION_S) *
      speedMultiplier *
      1000,
  );
  const isHeroSession = heroPush.heroKey !== null;

  const isHandCursor = spacePressed || toolMode === "pan";

  return (
    <div
      ref={stageRef}
      className={`canvas-stage ${isHandCursor ? "canvas-stage--hand" : ""} ${
        toolMode === "comment" ? "canvas-stage--comment-cursor" : ""
      } ${isPanning ? "canvas-stage--panning" : ""} ${
        draggingIds.size > 0 ? "canvas-stage--dragging-node" : ""
      }`}
      data-testid="canvas-stage"
      data-tool-mode={toolMode}
      data-pan-x={Math.round(pan.x)}
      data-pan-y={Math.round(pan.y)}
      onPointerDown={handleStagePointerDown}
      onPointerMove={(e) => {
        const sr = stageRef.current?.getBoundingClientRect();
        if (sr) {
          lastStagePointerRef.current = {
            x: e.clientX - sr.left,
            y: e.clientY - sr.top,
            inside: true,
          };
        }
        handlePointerMove(e);
      }}
      onPointerLeave={() => {
        lastStagePointerRef.current.inside = false;
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`canvas-world ${smoothCamera ? "canvas-world--smooth" : ""}`}
        style={{
          transform: `translate3d(${Math.round(pan.x)}px, ${Math.round(pan.y)}px, 0) scale(${zoom})`,
          transitionDuration: smoothCamera ? `${smoothDurationMs}ms` : undefined,
        }}
      >
        {items.map((item) => {
          const aspect = item.height > 0 ? item.width / item.height : 1;
          const nodeH = Math.round(item.canvasW / aspect);
          const cardKey = `canvas:${item.id}`;
          const isSelected = selectedIds.has(item.id);
          const isFocused = !isSelected && lastFocusedId === item.id;
          const isDragging = draggingIds.has(item.id) && !overlayHiddenIds.has(item.id);
          const isPushed = pushedIds.has(item.id);
          const isHeroHidden = activeHeroKey === cardKey;
          const isOverlayHidden = overlayHiddenIds.has(item.id);
          const isSearchSpotlight =
            activeSearchMatch?.kind === "item" && activeSearchMatch.id === item.id;

          const livePos = livePositions?.[item.id];
          const displayX = livePos ? livePos.x : item.canvasX;
          const displayY = livePos ? livePos.y : item.canvasY;

          const cardScreenRect: ScreenRect = {
            left: stageLeft + pan.x + displayX * zoom,
            top: stageTop + pan.y + displayY * zoom,
            width: item.canvasW * zoom,
            height: nodeH * zoom,
          };
          const push = isHeroHidden
            ? { dx: 0, dy: 0, scale: 1, opacity: 1 }
            : computeNeighborPushOffset(
                cardScreenRect,
                heroPush.originRect,
                heroPush.targetRect,
                heroPush.active,
              );

          const worldPushDx = zoom > 0 ? Math.round((push.dx / zoom) * 10) / 10 : push.dx;
          const worldPushDy = zoom > 0 ? Math.round((push.dy / zoom) * 10) / 10 : push.dy;

          const glideTransition = `left 280ms ${CANVAS_GLIDE_EASE}, top 280ms ${CANVAS_GLIDE_EASE}, width 280ms ${CANVAS_GLIDE_EASE}, height 280ms ${CANVAS_GLIDE_EASE}, box-shadow 200ms ease, transform 200ms ${CANVAS_GLIDE_EASE}`;

          return (
            <div
              key={item.id}
              data-testid={`canvas-node-${item.id}`}
              data-atlas-card-id={item.id}
              data-atlas-card-key={cardKey}
              data-selected={isSelected ? "true" : "false"}
              data-hero-hidden={isHeroHidden ? "true" : "false"}
              data-pushed={isPushed ? "true" : "false"}
              data-push-dx={push.dx}
              data-push-dy={push.dy}
              data-push-scale={push.scale}
              className={`canvas-node ${isSelected || isFocused ? "canvas-node--selected" : ""} ${
                isDragging ? "canvas-node--dragging" : ""
              } ${isPushed ? "canvas-node--pushed" : ""} ${
                isSearchSpotlight ? "canvas-match-highlight" : ""
              }`}
              style={{
                left: `${displayX}px`,
                top: `${displayY}px`,
                width: `${item.canvasW}px`,
                height: `${nodeH}px`,
                zIndex: isDragging ? 9999 : isPushed ? item.canvasZ + 40 : item.canvasZ,
                borderRadius: `${radius}px`,
                opacity: isOverlayHidden ? 0 : push.opacity,
                visibility: isHeroHidden ? "hidden" : "visible",
                transform:
                  isHeroSession && !isHeroHidden
                    ? `translate3d(${worldPushDx}px, ${worldPushDy}px, 0) scale(${push.scale})`
                    : undefined,
                transition:
                  isHeroHidden || isOverlayHidden
                    ? "none"
                    : isDragging
                      ? `box-shadow 180ms ease, transform 180ms ${CANVAS_GLIDE_EASE}`
                      : isHeroSession
                        ? `transform ${pushDurationMs}ms ${HERO_CSS_EASE}, opacity ${pushDurationMs}ms ${HERO_CSS_EASE}, box-shadow 180ms ease`
                        : glideTransition,
                pointerEvents: isHeroHidden || isOverlayHidden ? "none" : "auto",
              }}
              onPointerDown={(e) => handleNodePointerDown(e, item)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <RichMediaCardContent item={item} theme={theme} />

              <button
                type="button"
                className={`card-hover-like ${item.liked ? "card-hover-like--liked" : ""}`}
                aria-label={item.liked ? "Unlike item" : "Like item"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(item.id);
                }}
              >
                <HeartIcon size={13} filled={item.liked} />
              </button>

              {showCardBadges && item.kind === "video" && (() => {
                const vState = atomicMediaPlayerManager.getPlaybackState(item.id);
                const isLiveOnCard = vState?.activeSlot === "card";
                const isPlayingLive = Boolean(vState?.playing && isLiveOnCard);
                return (
                  <button
                    type="button"
                    className={`card-video-badge ${isLiveOnCard ? "card-video-badge--live" : ""}`}
                    data-testid={`canvas-video-play-${item.id}`}
                    aria-label={
                      isPlayingLive
                        ? `Pause ${item.title}`
                        : `Play ${item.title}`
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!vState) {
                        atomicMediaPlayerManager.activateItem(item);
                      } else if (vState.activeSlot === "pip") {
                        atomicMediaPlayerManager.dockFromPip(item.id);
                      } else {
                        atomicMediaPlayerManager.sendCommand(item.id, "toggle");
                      }
                    }}
                  >
                    <span aria-hidden="true">{isPlayingLive ? "❚❚" : "▶"}</span>
                    <span>
                      {vState ? formatAudioTime(vState.elapsed) : (item.duration ?? "0:08")}
                    </span>
                  </button>
                );
              })()}
              {showCardBadges && item.kind === "model3d" && item.modelMeta && (
                <span className="card-type-badge">
                  3D · {item.modelMeta.format}
                </span>
              )}
              {showCardBadges && item.kind === "gif" && (
                <span className="card-type-badge">GIF</span>
              )}
              {showCardBadges && item.kind === "link" && item.domain && (
                <span className="card-link-pill">
                  <LinkIcon size={11} />
                  <span>{item.domain}</span>
                </span>
              )}
            </div>
          );
        })}

        {/* Editable Spatial Note Cards with Floating Rich-Text Format Bar */}
        {notes.map((note) => (
          <CanvasNoteCardWidget
            key={note.id}
            note={note}
            active={activeNoteId === note.id}
            highlighted={
              activeSearchMatch?.kind === "note" && activeSearchMatch.id === note.id
            }
            locale={locale}
            zoom={zoom}
            onSelect={() => {
              setActiveNoteId(note.id);
              setOpenCommentId(null);
            }}
            onPointerDownMove={(e, targetNote) =>
              handleWidgetPointerDown(e, "note", targetNote.id, targetNote.x, targetNote.y)
            }
            onUpdate={(patch) =>
              setNotes((prev) =>
                prev.map((n) => (n.id === note.id ? { ...n, ...patch } : n)),
              )
            }
            onToggleReaction={(emoji) =>
              setNotes((prev) =>
                prev.map((n) =>
                  n.id === note.id
                    ? { ...n, reactions: toggleReactionOnList(n.reactions, emoji) }
                    : n,
                ),
              )
            }
            onCreateLinkedComment={() => {
              setPendingCommentPoint({ x: note.x + note.width + 14, y: note.y + 8 });
              setCommentComposerOpen(true);
            }}
            onDelete={() => {
              setNotes((prev) => prev.filter((n) => n.id !== note.id));
              setActiveNoteId((cur) => (cur === note.id ? null : cur));
            }}
          />
        ))}

        {/* Interactive Spatial Comment Pins + Reply Threads */}
        {comments.map((pin) => {
          const stageWidth = stageRef.current?.clientWidth ?? 1200;
          const pinScreenX = pan.x + pin.x * zoom;
          const alignLeft = stageWidth - pinScreenX < 390;
          return (
          <CanvasCommentPinWidget
            key={pin.id}
            pin={pin}
            open={openCommentId === pin.id}
            highlighted={
              activeSearchMatch?.kind === "comment" && activeSearchMatch.id === pin.id
            }
            locale={locale}
            zoom={zoom}
            alignLeft={alignLeft}
            onToggleOpen={() => {
              if (justDraggedWidgetIdRef.current === pin.id) return;
              setOpenCommentId((cur) => (cur === pin.id ? null : pin.id));
              setActiveNoteId(null);
            }}
            onClose={() => setOpenCommentId(null)}
            onPointerDownMove={(e, targetPin) =>
              handleWidgetPointerDown(e, "comment", targetPin.id, targetPin.x, targetPin.y)
            }
            onAddReply={(text) =>
              setComments((prev) =>
                prev.map((c) =>
                  c.id === pin.id
                    ? addReplyToCommentPin(
                        c,
                        `reply-${++widgetSeqRef.current}`,
                        text,
                        m.canvasAuthorYou,
                        m.canvasJustNow,
                      )
                    : c,
                ),
              )
            }
            onToggleReaction={(emoji) =>
              setComments((prev) =>
                prev.map((c) =>
                  c.id === pin.id
                    ? { ...c, reactions: toggleReactionOnList(c.reactions, emoji) }
                    : c,
                ),
              )
            }
            onResolve={() => {
              setComments((prev) =>
                prev.map((c) => (c.id === pin.id ? { ...c, resolved: true } : c)),
              );
              setOpenCommentId(null);
            }}
          />
          );
        })}

        {/* Delicate Magnetic Edge Alignment Hairlines */}
        {snapGuides.map((g, idx) =>
          g.axis === "x" ? (
            <div
              key={`guide-x-${idx}`}
              className="canvas-snap-guide canvas-snap-guide--x"
              data-testid="canvas-snap-guide"
              style={{
                left: `${g.position}px`,
                top: `${g.start}px`,
                height: `${Math.max(0, g.end - g.start)}px`,
              }}
            />
          ) : (
            <div
              key={`guide-y-${idx}`}
              className="canvas-snap-guide canvas-snap-guide--y"
              data-testid="canvas-snap-guide"
              style={{
                left: `${g.start}px`,
                top: `${g.position}px`,
                width: `${Math.max(0, g.end - g.start)}px`,
              }}
            />
          ),
        )}
      </div>

      {/* Tactile Porcelain Floating Toolbars (Exact Video UI + Full Spatial Functionality) */}
      <CanvasFloatingToolbars
        locale={locale}
        toolMode={toolMode}
        zoom={zoom}
        findOpen={findOpen}
        findQuery={findQuery}
        findMatchIndex={Math.min(findMatchIndex, Math.max(0, findMatches.length - 1))}
        findMatchTotal={findMatches.length}
        commentComposerOpen={commentComposerOpen}
        onChangeToolMode={(mode) => {
          setToolMode(mode);
          if (mode !== "comment") {
            setCommentComposerOpen(false);
            setPendingCommentPoint(null);
          }
        }}
        onImportClick={onImportClick}
        onPackBoard={onTidyCanvas}
        onAddNote={handleAddNote}
        onToggleCommentComposer={() => {
          const next = !commentComposerOpen;
          setCommentComposerOpen(next);
          setToolMode(next ? "comment" : "select");
          if (!next) setPendingCommentPoint(null);
        }}
        onSubmitQuickComment={handleSubmitQuickComment}
        onToggleFind={() => setFindOpen((v) => !v)}
        onFindQueryChange={(q) => {
          setFindQuery(q);
          setFindMatchIndex(0);
          const nextMatches = findCanvasMatches(items, notes, comments, q);
          const first = nextMatches[0];
          if (first) {
            focusWorldRect(first.x, first.y, first.width, first.height);
          }
        }}
        onStepFind={(delta) => {
          if (findMatches.length === 0) return;
          const nextIdx = stepMatchIndex(findMatchIndex, findMatches.length, delta);
          setFindMatchIndex(nextIdx);
          const target = findMatches[nextIdx];
          if (target) {
            focusWorldRect(target.x, target.y, target.width, target.height);
          }
        }}
        onCloseFind={() => {
          setFindOpen(false);
          setFindQuery("");
          setFindMatchIndex(0);
        }}
        onZoomIn={() => handleStepZoom(0.15)}
        onZoomOut={() => handleStepZoom(-0.15)}
        onFitView={handleFitView}
      />

      {/* macOS Finder-grade Rubberband Marquee Selection Box */}
      <AnimatePresence>
        {marqueeBox && (
          <motion.div
            key="canvas-finder-marquee"
            className="finder-marquee-box"
            data-testid="finder-marquee-box"
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.14, ease: "easeOut" } }}
            style={{
              left: marqueeBox.left,
              top: marqueeBox.top,
              width: marqueeBox.width,
              height: marqueeBox.height,
            }}
          />
        )}
      </AnimatePresence>

      {/* Stacked Sidebar Drag & Elastic Snap-Back Overlay */}
      <DragStackOverlay
        session={dragSession}
        theme={theme}
        onFlightComplete={handleFlightComplete}
      />
    </div>
  );
}
