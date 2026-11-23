import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HeartIcon, LinkIcon } from "./AppIcons";
import {
  computeDragVelocityTilt,
  computeGridInsertionIndex,
  computeMarqueeSelectedIds,
  isPointInsideReorderBounds,
  normalizeMarqueeRect,
  parseSidebarDropTarget,
  reorderGroupByTargetIndex,
  type SidebarDropTarget,
} from "./drag-selection-engine";
import {
  DragStackOverlay,
  type DragOverlaySession,
} from "./DragStackOverlay";
import {
  computeNeighborPushOffset,
  HERO_CLOSE_DURATION_S,
  HERO_MOTION_EASE,
  HERO_OPEN_DURATION_S,
  type HeroPushContext,
  type ScreenRect,
} from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import {
  computeFlatGridLayout,
  type CollectionItem,
  type GridLayoutMode,
  type LibraryItem,
  type ThemeMode,
} from "./library-engine";
import {
  atomicMediaPlayerManager,
  useAtomicMediaVersion,
} from "./AtomicMediaPlayerHost";
import { formatAudioTime } from "./media-helpers";
import { RichMediaCardContent } from "./RichMediaCardContent";
import {
  computeGridAnchoredScrollTop,
  computeGridCursorAnchor,
  computeGridRevealScrollTop,
  computeWheelZoomNext,
  sampleHeroEase,
  type CollapseRevealHandler,
  type GridZoomAnchor,
} from "./viewport-motion";

export interface GridGalleryViewProps {
  items: readonly LibraryItem[];
  collections: readonly CollectionItem[];
  theme: ThemeMode;
  zoom: number;
  spacing: number;
  radius: number;
  layoutMode: GridLayoutMode;
  selectedIds: ReadonlySet<string>;
  lastFocusedId: string | null;
  activeHeroKey: string | null;
  heroPush: HeroPushContext;
  inTrash: boolean;
  locale: AppLocale;
  showCardBadges: boolean;
  speedMultiplier: number;
  onZoomChange: (nextZoom: number) => void;
  onCommitOrder: (orderedVisibleIds: string[]) => void;
  onOpenQuickLook: (id: string, originRect?: ScreenRect, originKey?: string) => void;
  onToggleSelect: (id: string, additive: boolean) => void;
  onSetSelectedIds: (nextIds: Set<string>) => void;
  onClearSelection: () => void;
  onToggleLike: (id: string) => void;
  onMoveToCollection: (id: string, collectionId: string | null) => void;
  onTrashOrRestore: (id: string) => void;
  onHoverSidebarTarget: (targetKey: string | null) => void;
  onDropToSidebar: (itemIds: string[], target: SidebarDropTarget) => void;
  onRegisterRevealHandler?: (handler: CollapseRevealHandler | null) => void;
}

interface CardMenuState {
  x: number;
  y: number;
  item: LibraryItem;
}

interface MarqueeRuntime {
  pointerId: number;
  startContentX: number;
  startContentY: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  additive: boolean;
  baselineIds: Set<string>;
  active: boolean;
}

interface CardDragRuntime {
  sessionId: number;
  pointerId: number;
  leadItem: LibraryItem;
  draggedIds: string[];
  draggedItems: LibraryItem[];
  originalItems: LibraryItem[];
  originalSlotIndex: number;
  previewSlotIndex: number | null;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  primaryOriginRect: ScreenRect;
  tiltDeg: number;
  active: boolean;
  outOfBounds: boolean;
  sidebarTarget: SidebarDropTarget | null;
  lastSwapAt: number;
  lastSwapX: number;
  lastSwapY: number;
}

export function GridGalleryView({
  items,
  collections,
  theme,
  zoom,
  spacing,
  radius,
  layoutMode,
  selectedIds,
  lastFocusedId,
  activeHeroKey,
  heroPush,
  inTrash,
  locale,
  showCardBadges,
  speedMultiplier,
  onZoomChange,
  onCommitOrder,
  onOpenQuickLook,
  onToggleSelect,
  onSetSelectedIds,
  onClearSelection,
  onToggleLike,
  onMoveToCollection,
  onTrashOrRestore,
  onHoverSidebarTarget,
  onDropToSidebar,
  onRegisterRevealHandler,
}: GridGalleryViewProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  useAtomicMediaVersion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(1140);
  const [contentOrigin, setContentOrigin] = useState({ left: 252, top: 66 });
  const [cardMenu, setCardMenu] = useState<CardMenuState | null>(null);

  // Finder rubberband marquee visual state (in grid-content-inner coordinates)
  const [marqueeBox, setMarqueeBox] = useState<ScreenRect | null>(null);
  const marqueeRuntimeRef = useRef<MarqueeRuntime | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  // Tactile pointer drag-out, live reorder parting, out-of-bounds snap-back, and sidebar fly-in
  const [dragSession, setDragSession] = useState<DragOverlaySession | null>(null);
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null);
  const dragRuntimeRef = useRef<CardDragRuntime | null>(null);
  const dragSessionSeqRef = useRef(1);
  const suppressNextCardClickRef = useRef(false);

  // Fresh refs for window pointer listeners (avoid re-binding mid-gesture)
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const messagesRef = useRef(m);
  messagesRef.current = m;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Cursor-following zoom anchor + smooth off-screen collapse reveal RAF
  const lastPointerRef = useRef<{ clientX: number; clientY: number; inside: boolean }>({
    clientX: 0,
    clientY: 0,
    inside: false,
  });
  const pendingZoomAnchorRef = useRef<GridZoomAnchor | null>(null);
  const prevZoomRef = useRef(zoom);
  const prevLayoutBoxesRef = useRef<{
    cards: { id: string; x: number; y: number; width: number; height: number }[];
    totalHeight: number;
  }>({ cards: [], totalHeight: 0 });
  const revealScrollRafRef = useRef<number | null>(null);

  const measureContentBox = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nextW = Math.floor(el.clientWidth);
    if (nextW > 120) setContentWidth(nextW);
    setContentOrigin({ left: r.left, top: r.top });
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    measureContentBox();
    const ro = new ResizeObserver(measureContentBox);
    ro.observe(el);
    window.addEventListener("resize", measureContentBox);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureContentBox);
    };
  }, [measureContentBox]);

  useEffect(() => {
    if (heroPush.active) {
      measureContentBox();
    }
  }, [heroPush.active, measureContentBox]);

  useEffect(() => {
    if (!cardMenu) return;
    const dismiss = () => setCardMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCardMenu(null);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [cardMenu]);

  // Display items reflect live drag reorder preview without mutating app state until release
  const displayItems = useMemo(() => {
    if (!previewOrderIds) return items;
    const byId = new Map(items.map((it) => [it.id, it] as const));
    const ordered: LibraryItem[] = [];
    for (const id of previewOrderIds) {
      const found = byId.get(id);
      if (found) ordered.push(found);
    }
    if (ordered.length !== items.length) {
      for (const it of items) {
        if (!ordered.some((o) => o.id === it.id)) ordered.push(it);
      }
    }
    return ordered;
  }, [items, previewOrderIds]);

  const layout = useMemo(
    () => computeFlatGridLayout(displayItems, contentWidth, zoom, spacing, layoutMode),
    [displayItems, contentWidth, zoom, spacing, layoutMode],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const restingOriginalLayout = useMemo(
    () => computeFlatGridLayout(items, contentWidth, zoom, spacing, layoutMode),
    [items, contentWidth, zoom, spacing, layoutMode],
  );
  const restingOriginalLayoutRef = useRef(restingOriginalLayout);
  restingOriginalLayoutRef.current = restingOriginalLayout;

  const stopRevealScroll = useCallback(() => {
    if (revealScrollRafRef.current !== null) {
      cancelAnimationFrame(revealScrollRafRef.current);
      revealScrollRafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopRevealScroll(), [stopRevealScroll]);

  // Native non-passive wheel listener so Ctrl/Cmd + wheel & trackpad pinch zoom smoothly
  // anchored directly to the card underneath the cursor (without triggering browser page zoom).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      stopRevealScroll();
      const curZoom = zoomRef.current;
      const nextZoom = computeWheelZoomNext(curZoom, e.deltaY, e.ctrlKey);
      if (nextZoom === curZoom) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const contentEl = contentRef.current;
      const contentRect = contentEl?.getBoundingClientRect();
      const contentX = contentRect
        ? e.clientX - contentRect.left
        : e.clientX - scrollerRect.left;
      const contentY = contentRect
        ? e.clientY - contentRect.top
        : e.clientY - scrollerRect.top + scroller.scrollTop;
      const viewportY = e.clientY - scrollerRect.top;

      const boxes = layoutRef.current.cards.map((c) => ({
        id: c.item.id,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
      }));
      pendingZoomAnchorRef.current = computeGridCursorAnchor(
        boxes,
        contentX,
        contentY,
        viewportY,
        layoutRef.current.totalHeight,
      );
      onZoomChangeRef.current(nextZoom);
    };
    scroller.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onNativeWheel);
  }, [stopRevealScroll]);

  // Synchronously adjust scrollTop before browser paint whenever zoom changes so the
  // card under the cursor (or viewport center when dragging the bottom zoom slider) stays pinned!
  useLayoutEffect(() => {
    const newBoxes = layout.cards.map((c) => ({
      id: c.item.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    }));

    if (prevZoomRef.current !== zoom) {
      const scroller = scrollerRef.current;
      const contentEl = contentRef.current;
      if (scroller && contentEl) {
        const scrollerRect = scroller.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();
        const contentPaddingTop = Math.max(
          0,
          Math.round(contentRect.top - scrollerRect.top + scroller.scrollTop),
        );

        let anchor = pendingZoomAnchorRef.current;
        pendingZoomAnchorRef.current = null;

        if (!anchor) {
          const ptr = lastPointerRef.current;
          const useCursor = ptr.inside;
          const clientX = useCursor
            ? ptr.clientX
            : scrollerRect.left + scrollerRect.width * 0.5;
          const clientY = useCursor
            ? ptr.clientY
            : scrollerRect.top + scrollerRect.height * 0.48;
          const contentX = clientX - contentRect.left;
          const contentY = clientY - contentRect.top;
          const viewportY = clientY - scrollerRect.top;
          anchor = computeGridCursorAnchor(
            prevLayoutBoxesRef.current.cards,
            contentX,
            contentY,
            viewportY,
            prevLayoutBoxesRef.current.totalHeight,
          );
        }

        const nextScrollTop = computeGridAnchoredScrollTop(
          newBoxes,
          anchor,
          layout.totalHeight,
          scroller.clientHeight,
          contentPaddingTop,
        );
        scroller.scrollTop = nextScrollTop;
        measureContentBox();
      }
      prevZoomRef.current = zoom;
    }

    prevLayoutBoxesRef.current = {
      cards: newBoxes,
      totalHeight: layout.totalHeight,
    };
  }, [zoom, layout, measureContentBox]);

  // Register collapse-reveal handler so collapsing an off-screen item smoothly scrolls it
  // into view in lockstep with the QuickLook Hero flight and returns its exact post-scroll rect.
  useEffect(() => {
    if (!onRegisterRevealHandler) return;
    const handler: CollapseRevealHandler = (itemId, _preferredKey, durationMs) => {
      const scroller = scrollerRef.current;
      const contentEl = contentRef.current;
      if (!scroller || !contentEl) return null;

      const entry = restingOriginalLayoutRef.current.cards.find(
        (c) => c.item.id === itemId,
      );
      if (!entry) return null;

      stopRevealScroll();
      const scrollerRect = scroller.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();
      const startScrollTop = scroller.scrollTop;
      const contentTopAtZeroScroll = contentRect.top + startScrollTop;
      const contentOffsetInScroller =
        contentRect.top - scrollerRect.top + startScrollTop;
      const cardTopInScroller = contentOffsetInScroller + entry.y;

      const reveal = computeGridRevealScrollTop(
        cardTopInScroller,
        entry.height,
        startScrollTop,
        scroller.clientHeight,
        scroller.scrollHeight,
        68,
      );

      if (reveal.needsScroll) {
        const targetScrollTop = reveal.targetScrollTop;
        const safeDuration = Math.max(120, durationMs);
        const startAt = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - startAt) / safeDuration);
          const eased = sampleHeroEase(t);
          scroller.scrollTop =
            startScrollTop + (targetScrollTop - startScrollTop) * eased;
          if (t < 1) {
            revealScrollRafRef.current = requestAnimationFrame(step);
          } else {
            scroller.scrollTop = targetScrollTop;
            revealScrollRafRef.current = null;
            measureContentBox();
          }
        };
        revealScrollRafRef.current = requestAnimationFrame(step);
      }

      const roundTenth = (n: number) => Math.round(n * 10) / 10;
      return {
        cardKey: `grid:${itemId}`,
        didReveal: reveal.needsScroll,
        rect: {
          left: roundTenth(contentRect.left + entry.x),
          top: roundTenth(contentTopAtZeroScroll + entry.y - reveal.targetScrollTop),
          width: roundTenth(entry.width),
          height: roundTenth(entry.height),
        },
      };
    };

    onRegisterRevealHandler(handler);
    return () => onRegisterRevealHandler(null);
  }, [onRegisterRevealHandler, stopRevealScroll, measureContentBox]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const getSidebarTargetLabel = useCallback(
    (target: SidebarDropTarget | null): string | null => {
      if (!target) return null;
      const msg = messagesRef.current;
      if (target.kind === "inbox") return msg.dragTargetMoveTo(msg.navInbox);
      if (target.kind === "likes") return msg.dragTargetLike;
      if (target.kind === "trash") return msg.dragTargetTrash;
      if (target.kind === "tag") return msg.dragTargetAddTag(target.tagName);
      const col = collectionsRef.current.find((c) => c.id === target.collectionId);
      return msg.dragTargetMoveTo(col?.name ?? msg.sectionCollections);
    },
    [],
  );

  const hitTestSidebarTarget = useCallback(
    (clientX: number, clientY: number): SidebarDropTarget | null => {
      const hits = document.elementsFromPoint(clientX, clientY);
      for (const el of hits) {
        if (!(el instanceof HTMLElement)) continue;
        const targetAttr = el.dataset.dropSidebarTarget;
        const parsed = parseSidebarDropTarget(targetAttr);
        if (parsed) return parsed;
      }
      return null;
    },
    [],
  );

  const buildTargetScreenRects = useCallback(
    (
      targetLayout: ReturnType<typeof computeFlatGridLayout>,
      ids: readonly string[],
    ): Record<string, ScreenRect> => {
      const contentEl = contentRef.current;
      const origin = contentEl
        ? contentEl.getBoundingClientRect()
        : { left: contentOrigin.left, top: contentOrigin.top };
      const idSet = new Set(ids);
      const out: Record<string, ScreenRect> = {};
      for (const card of targetLayout.cards) {
        if (!idSet.has(card.item.id)) continue;
        out[card.item.id] = {
          left: origin.left + card.x,
          top: origin.top + card.y,
          width: card.width,
          height: card.height,
        };
      }
      return out;
    },
    [contentOrigin.left, contentOrigin.top],
  );

  const updateMarqueeFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const mr = marqueeRuntimeRef.current;
      const contentEl = contentRef.current;
      if (!mr || !contentEl) return;
      const cRect = contentEl.getBoundingClientRect();
      const curContentX = clientX - cRect.left;
      const curContentY = clientY - cRect.top;
      const rect = normalizeMarqueeRect(
        mr.startContentX,
        mr.startContentY,
        curContentX,
        curContentY,
      );
      setMarqueeBox(rect);

      const cardRects = layoutRef.current.cards.map((entry) => ({
        id: entry.item.id,
        rect: {
          left: entry.x,
          top: entry.y,
          width: entry.width,
          height: entry.height,
        },
      }));
      const nextSelected = computeMarqueeSelectedIds(
        rect,
        cardRects,
        mr.baselineIds,
        mr.additive,
      );
      onSetSelectedIds(nextSelected);
    },
    [onSetSelectedIds],
  );

  const driveEdgeAutoScroll = useCallback(
    (clientY: number, onScrolled: () => void) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        stopAutoScroll();
        return;
      }
      const sr = scroller.getBoundingClientRect();
      const edgeZone = 54;
      let delta = 0;
      if (clientY < sr.top + edgeZone) {
        const ratio = Math.max(0, Math.min(1, (sr.top + edgeZone - clientY) / edgeZone));
        delta = -Math.round(4 + ratio * 14);
      } else if (clientY > sr.bottom - edgeZone) {
        const ratio = Math.max(0, Math.min(1, (clientY - (sr.bottom - edgeZone)) / edgeZone));
        delta = Math.round(4 + ratio * 14);
      }

      if (delta === 0) {
        stopAutoScroll();
        return;
      }

      if (autoScrollRafRef.current === null) {
        const step = () => {
          const el = scrollerRef.current;
          const activeGesture = marqueeRuntimeRef.current?.active || dragRuntimeRef.current?.active;
          if (!el || !activeGesture) {
            autoScrollRafRef.current = null;
            return;
          }
          const lastY = marqueeRuntimeRef.current?.active
            ? marqueeRuntimeRef.current.lastClientY
            : dragRuntimeRef.current?.lastClientY ?? 0;
          const box = el.getBoundingClientRect();
          let dy = 0;
          if (lastY < box.top + edgeZone) {
            const r = Math.max(0, Math.min(1, (box.top + edgeZone - lastY) / edgeZone));
            dy = -Math.round(4 + r * 14);
          } else if (lastY > box.bottom - edgeZone) {
            const r = Math.max(0, Math.min(1, (lastY - (box.bottom - edgeZone)) / edgeZone));
            dy = Math.round(4 + r * 14);
          }
          if (dy === 0) {
            autoScrollRafRef.current = null;
            return;
          }
          const prevScroll = el.scrollTop;
          el.scrollTop = prevScroll + dy;
          if (el.scrollTop !== prevScroll) {
            measureContentBox();
            onScrolled();
          }
          autoScrollRafRef.current = requestAnimationFrame(step);
        };
        autoScrollRafRef.current = requestAnimationFrame(step);
      }
    },
    [measureContentBox, stopAutoScroll],
  );

  // Global window pointer handlers for BOTH Finder Marquee & Tactile Card Drag-Out
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // 1. Finder Rubberband Marquee Selection
      const mr = marqueeRuntimeRef.current;
      if (mr && e.pointerId === mr.pointerId) {
        mr.lastClientX = e.clientX;
        mr.lastClientY = e.clientY;
        const dist = Math.hypot(
          e.clientX - mr.startClientX,
          e.clientY - mr.startClientY,
        );
        if (!mr.active && dist >= 4) {
          mr.active = true;
        }
        if (mr.active) {
          updateMarqueeFromClient(e.clientX, e.clientY);
          driveEdgeAutoScroll(e.clientY, () => {
            if (marqueeRuntimeRef.current?.active) {
              updateMarqueeFromClient(
                marqueeRuntimeRef.current.lastClientX,
                marqueeRuntimeRef.current.lastClientY,
              );
            }
          });
        }
        return;
      }

      // 2. Tactile Card Drag-Out / Free Live Reorder / Sidebar Stack
      const dr = dragRuntimeRef.current;
      if (!dr || e.pointerId !== dr.pointerId) return;

      const dist = Math.hypot(
        e.clientX - dr.startClientX,
        e.clientY - dr.startClientY,
      );
      if (!dr.active && dist < 6) return;

      if (!dr.active) {
        dr.active = true;
        setCardMenu(null);
      }

      const vx = e.clientX - dr.lastClientX;
      dr.lastClientX = e.clientX;
      dr.lastClientY = e.clientY;
      dr.tiltDeg = computeDragVelocityTilt(vx, dr.tiltDeg);

      // Hit-test sidebar drop targets first
      const sidebarTarget = hitTestSidebarTarget(e.clientX, e.clientY);
      dr.sidebarTarget = sidebarTarget;
      onHoverSidebarTarget(sidebarTarget?.key ?? null);

      const scrollerEl = scrollerRef.current;
      const contentEl = contentRef.current;
      const scrollerRect = scrollerEl?.getBoundingClientRect();
      const contentRect = contentEl?.getBoundingClientRect();
      const visibleTop = scrollerRect
        ? scrollerRect.top + 58
        : 58;
      const visibleBottom = scrollerRect
        ? scrollerRect.bottom - 52
        : window.innerHeight - 52;
      const reorderBounds: ScreenRect = contentRect
        ? {
            left: contentRect.left,
            top: visibleTop,
            width: contentRect.width,
            height: Math.max(140, visibleBottom - visibleTop),
          }
        : {
            left: 252,
            top: visibleTop,
            width: Math.max(320, window.innerWidth - 272),
            height: Math.max(140, visibleBottom - visibleTop),
          };

      if (sidebarTarget) {
        // Calmly restore grid preview while hovering a sidebar target
        dr.outOfBounds = false;
        if (dr.previewSlotIndex !== null) {
          dr.previewSlotIndex = null;
          setPreviewOrderIds(null);
        }
        stopAutoScroll();
      } else {
        const insideReorder = isPointInsideReorderBounds(
          e.clientX,
          e.clientY,
          reorderBounds,
          20,
        );
        dr.outOfBounds = !insideReorder;

        if (!insideReorder) {
          // Out-of-bounds: immediately glide parted grid cards back to original resting spots!
          if (dr.previewSlotIndex !== null) {
            dr.previewSlotIndex = null;
            setPreviewOrderIds(null);
          }
          stopAutoScroll();
        } else if (contentEl) {
          // Inside Grid Reorder Zone: live parting & slot squeezing!
          const cRect = contentEl.getBoundingClientRect();
          const pointerContentX = e.clientX - cRect.left;
          const pointerContentY = e.clientY - cRect.top;
          const draggedSet = new Set(dr.draggedIds);
          const remainingBoxes = layoutRef.current.cards
            .filter((entry) => !draggedSet.has(entry.item.id))
            .map((entry) => ({
              x: entry.x,
              y: entry.y,
              width: entry.width,
              height: entry.height,
            }));

          const currentSlot = dr.previewSlotIndex ?? dr.originalSlotIndex;
          const nextSlot = computeGridInsertionIndex(
            pointerContentX,
            pointerContentY,
            remainingBoxes,
            currentSlot,
          );

          const now = performance.now();
          const movedSinceSwap = Math.hypot(
            e.clientX - dr.lastSwapX,
            e.clientY - dr.lastSwapY,
          );
          if (
            nextSlot !== currentSlot &&
            (now - dr.lastSwapAt > 85 || movedSinceSwap > 18)
          ) {
            dr.previewSlotIndex = nextSlot;
            dr.lastSwapAt = now;
            dr.lastSwapX = e.clientX;
            dr.lastSwapY = e.clientY;
            const nextPreview = reorderGroupByTargetIndex(
              dr.originalItems,
              dr.draggedIds,
              nextSlot,
            );
            setPreviewOrderIds(nextPreview.map((it) => it.id));
          }

          driveEdgeAutoScroll(e.clientY, () => {
            measureContentBox();
          });
        }
      }

      setDragSession({
        id: dr.sessionId,
        phase: "dragging",
        items: dr.draggedItems,
        pointerX: e.clientX,
        pointerY: e.clientY,
        grabOffsetX: dr.grabOffsetX,
        grabOffsetY: dr.grabOffsetY,
        primaryOriginRect: dr.primaryOriginRect,
        targetRectsById: {},
        flyInTargetPoint: null,
        sidebarTarget: dr.sidebarTarget,
        sidebarTargetLabel: getSidebarTargetLabel(dr.sidebarTarget),
        outOfBounds: dr.outOfBounds,
        tiltDeg: dr.tiltDeg,
        radius: radiusRef.current,
        returnHintLabel: messagesRef.current.dragReturnHint,
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      // 1. Finish Finder Marquee
      const mr = marqueeRuntimeRef.current;
      if (mr && e.pointerId === mr.pointerId) {
        marqueeRuntimeRef.current = null;
        stopAutoScroll();
        if (!mr.active) {
          // Clean click on empty background clears selection
          onClearSelection();
        }
        setMarqueeBox(null);
        return;
      }

      // 2. Finish Tactile Card Drag
      const dr = dragRuntimeRef.current;
      if (!dr || e.pointerId !== dr.pointerId) return;
      dragRuntimeRef.current = null;
      stopAutoScroll();
      onHoverSidebarTarget(null);

      if (!dr.active) return;

      // Suppress the synthetic click event that follows pointerup after a drag
      suppressNextCardClickRef.current = true;
      window.setTimeout(() => {
        suppressNextCardClickRef.current = false;
      }, 140);

      // Case A: Dropped on a valid Sidebar target -> Stacked Fly-In Suction!
      if (dr.sidebarTarget && e.type === "pointerup") {
        const target = dr.sidebarTarget;
        const targetEl = document.querySelector<HTMLElement>(
          `[data-drop-sidebar-target="${CSS.escape(target.key)}"]`,
        );
        const r = targetEl?.getBoundingClientRect();
        const flyPoint = r
          ? { x: r.left + 22, y: r.top + r.height * 0.5 }
          : { x: e.clientX, y: e.clientY };

        setPreviewOrderIds(null);
        setDragSession({
          id: dr.sessionId,
          phase: "fly-in",
          items: dr.draggedItems,
          pointerX: e.clientX,
          pointerY: e.clientY,
          grabOffsetX: dr.grabOffsetX,
          grabOffsetY: dr.grabOffsetY,
          primaryOriginRect: dr.primaryOriginRect,
          targetRectsById: {},
          flyInTargetPoint: flyPoint,
          sidebarTarget: target,
          sidebarTargetLabel: null,
          outOfBounds: false,
          tiltDeg: dr.tiltDeg,
          radius: radiusRef.current,
          returnHintLabel: messagesRef.current.dragReturnHint,
        });

        const droppedIds = [...dr.draggedIds];
        window.setTimeout(() => {
          onDropToSidebar(droppedIds, target);
        }, 120);
        return;
      }

      // Case B: Released INSIDE Grid Reorder Zone -> Commit Order & Spring Settle into New Slot!
      if (!dr.outOfBounds && e.type === "pointerup") {
        const finalSlot = dr.previewSlotIndex ?? dr.originalSlotIndex;
        const committedList = reorderGroupByTargetIndex(
          dr.originalItems,
          dr.draggedIds,
          finalSlot,
        );
        const committedIds = committedList.map((it) => it.id);
        const orderChanged = committedIds.some(
          (id, idx) => id !== dr.originalItems[idx]?.id,
        );

        const targetRects = buildTargetScreenRects(layoutRef.current, dr.draggedIds);
        if (orderChanged) {
          onCommitOrder(committedIds);
        }
        setPreviewOrderIds(null);

        setDragSession({
          id: dr.sessionId,
          phase: "settling",
          items: dr.draggedItems,
          pointerX: e.clientX,
          pointerY: e.clientY,
          grabOffsetX: dr.grabOffsetX,
          grabOffsetY: dr.grabOffsetY,
          primaryOriginRect: dr.primaryOriginRect,
          targetRectsById: targetRects,
          flyInTargetPoint: null,
          sidebarTarget: null,
          sidebarTargetLabel: null,
          outOfBounds: false,
          tiltDeg: dr.tiltDeg,
          radius: radiusRef.current,
          returnHintLabel: messagesRef.current.dragReturnHint,
        });
        return;
      }

      // Case C: Released OUTSIDE Reorder Zone (or cancelled) -> Elastic Snap-Back to Original Home!
      setPreviewOrderIds(null);
      const originalTargetRects = buildTargetScreenRects(
        restingOriginalLayoutRef.current,
        dr.draggedIds,
      );
      setDragSession({
        id: dr.sessionId,
        phase: "snap-back",
        items: dr.draggedItems,
        pointerX: e.clientX,
        pointerY: e.clientY,
        grabOffsetX: dr.grabOffsetX,
        grabOffsetY: dr.grabOffsetY,
        primaryOriginRect: dr.primaryOriginRect,
        targetRectsById: originalTargetRects,
        flyInTargetPoint: null,
        sidebarTarget: null,
        sidebarTargetLabel: null,
        outOfBounds: true,
        tiltDeg: dr.tiltDeg,
        radius: radiusRef.current,
        returnHintLabel: messagesRef.current.dragReturnHint,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      stopAutoScroll();
    };
  }, [
    buildTargetScreenRects,
    driveEdgeAutoScroll,
    getSidebarTargetLabel,
    hitTestSidebarTarget,
    measureContentBox,
    onClearSelection,
    onCommitOrder,
    onDropToSidebar,
    onHoverSidebarTarget,
    stopAutoScroll,
    updateMarqueeFromClient,
  ]);

  const handleFlightComplete = useCallback((sessionId: number) => {
    setDragSession((prev) => (prev && prev.id === sessionId ? null : prev));
  }, []);

  const handleScrollerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(".media-card") ||
      target.closest(".mac-context-menu") ||
      target.closest("button")
    ) {
      return;
    }

    const contentEl = contentRef.current;
    if (!contentEl) return;
    const cRect = contentEl.getBoundingClientRect();
    setCardMenu(null);

    marqueeRuntimeRef.current = {
      pointerId: e.pointerId,
      startContentX: e.clientX - cRect.left,
      startContentY: e.clientY - cRect.top,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      additive: e.shiftKey || e.metaKey || e.ctrlKey,
      baselineIds: new Set(selectedIdsRef.current),
      active: false,
    };
  };

  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: LibraryItem,
  ) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (dragSession && dragSession.phase !== "dragging") return;

    const r = e.currentTarget.getBoundingClientRect();
    const currentItems = itemsRef.current;
    const currentSelected = selectedIdsRef.current;
    const isMultiDrag = currentSelected.has(item.id) && currentSelected.size > 1;

    const draggedIds = isMultiDrag
      ? [
          item.id,
          ...currentItems
            .filter((it) => it.id !== item.id && currentSelected.has(it.id))
            .map((it) => it.id),
        ]
      : [item.id];

    const byId = new Map(currentItems.map((it) => [it.id, it] as const));
    const draggedItems = draggedIds
      .map((id) => byId.get(id))
      .filter((it): it is LibraryItem => Boolean(it));

    const draggedSet = new Set(draggedIds);
    let originalSlotIndex = 0;
    for (const it of currentItems) {
      if (it.id === item.id) break;
      if (!draggedSet.has(it.id)) originalSlotIndex += 1;
    }

    const sessionId = ++dragSessionSeqRef.current;
    dragRuntimeRef.current = {
      sessionId,
      pointerId: e.pointerId,
      leadItem: item,
      draggedIds,
      draggedItems,
      originalItems: [...currentItems],
      originalSlotIndex,
      previewSlotIndex: null,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      grabOffsetX: e.clientX - r.left,
      grabOffsetY: e.clientY - r.top,
      primaryOriginRect: {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      },
      tiltDeg: 0,
      active: false,
      outOfBounds: false,
      sidebarTarget: null,
      lastSwapAt: 0,
      lastSwapX: e.clientX,
      lastSwapY: e.clientY,
    };
  };

  const handleCardClick = (e: React.MouseEvent<HTMLElement>, item: LibraryItem) => {
    if (suppressNextCardClickRef.current) {
      suppressNextCardClickRef.current = false;
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      onToggleSelect(item.id, true);
      return;
    }
    measureContentBox();
    const r = e.currentTarget.getBoundingClientRect();
    const cardKey = `grid:${item.id}`;
    onOpenQuickLook(
      item.id,
      {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      },
      cardKey,
    );
  };

  const handleCardContextMenu = (e: React.MouseEvent, item: LibraryItem) => {
    e.preventDefault();
    const clampedX = Math.min(e.clientX, window.innerWidth - 210);
    const clampedY = Math.min(e.clientY, window.innerHeight - 280);
    setCardMenu({
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      item,
    });
  };

  if (items.length === 0) {
    return (
      <div className="atlas-empty">
        <strong>{m.emptyNothingTitle}</strong>
        <span>{inTrash ? m.emptyTrashSub : m.emptyDefaultSub}</span>
      </div>
    );
  }

  const imgFit = layoutMode === "fit" ? "contain" : "cover";
  const isHeroSession = heroPush.heroKey !== null;
  const isZoomSyncFrame = prevZoomRef.current !== zoom;
  const activeDraggedSet = useMemo(() => {
    if (!dragSession) return new Set<string>();
    return new Set(dragSession.items.map((it) => it.id));
  }, [dragSession]);
  const showDropSlotPlaceholder =
    dragSession?.phase === "dragging" &&
    !dragSession.outOfBounds &&
    !dragSession.sidebarTarget;
  const showHomeGhostPlaceholder =
    dragSession?.phase === "dragging" &&
    (dragSession.outOfBounds || Boolean(dragSession.sidebarTarget));

  return (
    <div
      ref={scrollerRef}
      className={`grid-scroller ${marqueeBox ? "grid-scroller--marquee" : ""} ${
        dragSession?.phase === "dragging" ? "grid-scroller--dragging" : ""
      }`}
      data-testid="grid-scroller"
      onScroll={measureContentBox}
      onPointerMove={(e) => {
        lastPointerRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          inside: true,
        };
      }}
      onPointerLeave={() => {
        lastPointerRef.current.inside = false;
      }}
      onPointerDown={handleScrollerPointerDown}
    >
      <div
        ref={contentRef}
        className="grid-content-inner"
        data-testid={
          layoutMode === "justified"
            ? "justified-grid"
            : layoutMode === "square"
              ? "square-grid"
              : "fit-grid"
        }
        style={{
          position: "relative",
          height: `${Math.max(240, layout.totalHeight)}px`,
        }}
      >
        {layout.cards.map((entry) => {
          const { item } = entry;
          const cardKey = `grid:${item.id}`;
          const isSelected = selectedIds.has(item.id);
          const isFocused = !isSelected && lastFocusedId === item.id;
          const isHeroHidden = activeHeroKey === cardKey;
          const isInActiveDrag = activeDraggedSet.has(item.id);
          const isRecessedSlot = isInActiveDrag && showDropSlotPlaceholder;
          const isHomeGhost = isInActiveDrag && showHomeGhostPlaceholder;

          const cardScreenRect: ScreenRect = {
            left: contentOrigin.left + entry.x,
            top: contentOrigin.top + entry.y,
            width: entry.width,
            height: entry.height,
          };
          const push = isHeroHidden
            ? { dx: 0, dy: 0, scale: 1, opacity: 1 }
            : computeNeighborPushOffset(
                cardScreenRect,
                heroPush.originRect,
                heroPush.targetRect,
                heroPush.active,
              );

          const targetOpacity = isInActiveDrag
            ? isRecessedSlot || isHomeGhost
              ? 1
              : 0
            : push.opacity;
          const targetScale = isRecessedSlot ? 0.985 : isHomeGhost ? 0.98 : push.scale;

          return (
            <motion.div
              key={item.id}
              initial={false}
              animate={{
                x: entry.x + push.dx,
                y: entry.y + push.dy,
                width: entry.width,
                height: entry.height,
                borderRadius: radius,
                opacity: targetOpacity,
                scale: targetScale,
              }}
              transition={
                isHeroSession
                  ? {
                      duration:
                        (heroPush.active
                          ? HERO_OPEN_DURATION_S
                          : HERO_CLOSE_DURATION_S) * speedMultiplier,
                      ease: HERO_MOTION_EASE,
                      opacity: {
                        duration:
                          (heroPush.active
                            ? HERO_OPEN_DURATION_S
                            : HERO_CLOSE_DURATION_S) * speedMultiplier,
                        ease: HERO_MOTION_EASE,
                      },
                    }
                  : isZoomSyncFrame
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 410,
                        damping: 35,
                        mass: 0.74,
                        opacity: { duration: 0 },
                      }
              }
              role="button"
              tabIndex={0}
              data-testid={`media-card-${item.id}`}
              data-atlas-card-id={item.id}
              data-atlas-card-key={cardKey}
              data-selected={isSelected ? "true" : "false"}
              data-hero-hidden={isHeroHidden ? "true" : "false"}
              data-push-dx={push.dx}
              data-push-dy={push.dy}
              data-push-scale={push.scale}
              className={`media-card media-card--flat ${
                isSelected || isFocused ? "media-card--selected" : ""
              } ${isRecessedSlot ? "media-card--drop-slot" : ""} ${
                isHomeGhost ? "media-card--home-ghost" : ""
              }`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: isSelected || isFocused ? 4 : 1,
                visibility: isHeroHidden ? "hidden" : "visible",
                pointerEvents: isHeroHidden || isInActiveDrag ? "none" : "auto",
              }}
              onPointerDown={(e) => handleCardPointerDown(e, item)}
              onClick={(e) => handleCardClick(e, item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  onOpenQuickLook(
                    item.id,
                    {
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                    },
                    cardKey,
                  );
                }
              }}
              onContextMenu={(e) => handleCardContextMenu(e, item)}
            >
              <div
                className="media-card-surface"
                style={{ opacity: isRecessedSlot || isHomeGhost ? 0 : 1 }}
              >
                <RichMediaCardContent item={item} theme={theme} imgFit={imgFit} />

                <button
                  type="button"
                  className={`card-hover-like ${item.liked ? "card-hover-like--liked" : ""}`}
                  aria-label={item.liked ? "Unlike item" : "Like item"}
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
                      data-testid={`card-video-play-${item.id}`}
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
            </motion.div>
          );
        })}

        {/* macOS Finder-grade Rubberband Marquee Selection Box */}
        <AnimatePresence>
          {marqueeBox && (
            <motion.div
              key="grid-finder-marquee"
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
      </div>

      {/* Tactile Floating Card Lift-Out, Fanned Stack, Snap-Back & Sidebar Fly-In Layer */}
      <DragStackOverlay
        session={dragSession}
        theme={theme}
        imgFit={imgFit}
        onFlightComplete={handleFlightComplete}
      />

      {/* Native macOS Card Context Menu */}
      <AnimatePresence>
        {cardMenu && (
          <motion.div
            className="mac-context-menu"
            style={{ left: cardMenu.x, top: cardMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mac-menu-item"
              onClick={() => {
                onOpenQuickLook(cardMenu.item.id, undefined, `grid:${cardMenu.item.id}`);
                setCardMenu(null);
              }}
            >
              <span>{m.cardOpenQuickLook}</span>
              <span style={{ opacity: 0.65, fontSize: 11 }}>Space</span>
            </button>
            <button
              type="button"
              className="mac-menu-item"
              onClick={() => {
                onToggleLike(cardMenu.item.id);
                setCardMenu(null);
              }}
            >
              <span>{cardMenu.item.liked ? m.cardUnlike : m.cardLike}</span>
            </button>
            <button
              type="button"
              className="mac-menu-item"
              onClick={() => {
                onToggleSelect(cardMenu.item.id, true);
                setCardMenu(null);
              }}
            >
              <span>
                {selectedIds.has(cardMenu.item.id)
                  ? m.dockClear
                  : m.selectedCount(1)}
              </span>
            </button>
            <div className="mac-menu-sep" />
            {collections.map((col) => (
              <button
                key={col.id}
                type="button"
                className="mac-menu-item"
                onClick={() => {
                  onMoveToCollection(cardMenu.item.id, col.id);
                  setCardMenu(null);
                }}
              >
                <span>
                  {m.cardMoveToCollection} · {col.name}
                </span>
              </button>
            ))}
            <div className="mac-menu-sep" />
            <button
              type="button"
              className="mac-menu-item"
              onClick={() => {
                onTrashOrRestore(cardMenu.item.id);
                setCardMenu(null);
              }}
            >
              <span>
                {cardMenu.item.trashed
                  ? m.cardRestoreFromTrash
                  : m.cardMoveToTrash}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
