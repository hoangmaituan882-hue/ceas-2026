import { useEffect, useMemo, useRef, useState } from "react";
import { LinkIcon } from "./AppIcons";
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
import {
  computeInfinityWallTiles,
  type LibraryItem,
  type ThemeMode,
} from "./library-engine";
import { RichMediaCardContent } from "./RichMediaCardContent";

export interface InfinityDriftViewProps {
  items: readonly LibraryItem[];
  theme: ThemeMode;
  zoom: number;
  spacing: number;
  radius: number;
  activeHeroKey: string | null;
  lastFocusedKey: string | null;
  heroPush: HeroPushContext;
  recenterSignal: number;
  locale: AppLocale;
  showCardBadges: boolean;
  speedMultiplier: number;
  inertiaEnabled: boolean;
  wheelZoomMode: WheelZoomMode;
  onZoomChange: (nextZoom: number) => void;
  onOpenQuickLook: (id: string, originRect?: ScreenRect, originKey?: string) => void;
}

export function InfinityDriftView({
  items,
  theme,
  zoom,
  spacing,
  radius,
  activeHeroKey,
  lastFocusedKey,
  heroPush,
  recenterSignal,
  locale,
  showCardBadges,
  speedMultiplier,
  inertiaEnabled,
  wheelZoomMode,
  onZoomChange,
  onOpenQuickLook,
}: InfinityDriftViewProps) {
  const m = getMessages(locale);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [offset, setOffset] = useState({ x: -120, y: -42 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const prevZoomRef = useRef(zoom);
  const wheelPanTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    captured: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    origOffsetX: number;
    origOffsetY: number;
    vx: number;
    vy: number;
    moved: boolean;
    clickedTile: {
      id: string;
      key: string;
      el: HTMLElement;
    } | null;
  } | null>(null);
  const coastRafRef = useRef<number | null>(null);
  const handledPointerClickRef = useRef(false);

  const stopCoasting = () => {
    if (coastRafRef.current !== null) {
      cancelAnimationFrame(coastRafRef.current);
      coastRafRef.current = null;
    }
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      setViewport({
        width: Math.max(320, el.clientWidth),
        height: Math.max(320, el.clientHeight),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep viewport center anchored when zooming Infinity wall smoothly (Video 00:11–00:18)
  useEffect(() => {
    const prevZoom = prevZoomRef.current;
    if (prevZoom !== zoom && prevZoom > 0) {
      const ratio = zoom / prevZoom;
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      setIsPanning(false);
      setOffset((prev) => ({
        x: Math.round(cx - (cx - prev.x) * ratio),
        y: Math.round(cy - (cy - prev.y) * ratio),
      }));
      prevZoomRef.current = zoom;
    }
  }, [zoom, viewport.width, viewport.height]);

  useEffect(() => {
    stopCoasting();
    setIsPanning(false);
    setOffset({ x: -120, y: -42 });
  }, [recenterSignal]);

  useEffect(() => {
    return () => {
      stopCoasting();
      if (wheelPanTimerRef.current !== null) {
        window.clearTimeout(wheelPanTimerRef.current);
      }
    };
  }, []);

  const visibleTiles = useMemo(
    () =>
      computeInfinityWallTiles(
        items,
        viewport.width,
        viewport.height,
        offset.x,
        offset.y,
        zoom,
        spacing,
      ),
    [items, viewport.width, viewport.height, offset.x, offset.y, zoom, spacing],
  );

  const openTileQuickLook = (el: HTMLElement, id: string, key: string) => {
    const r = el.getBoundingClientRect();
    onOpenQuickLook(
      id,
      {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      },
      key,
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    stopCoasting();
    handledPointerClickRef.current = false;

    const targetEl = e.target as HTMLElement | null;
    const tileEl = targetEl?.closest<HTMLElement>("[data-atlas-card-key]") ?? null;
    const tileId = tileEl?.getAttribute("data-atlas-card-id") ?? null;
    const tileKey = tileEl?.getAttribute("data-atlas-card-key") ?? null;

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      captured: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      origOffsetX: offset.x,
      origOffsetY: offset.y,
      vx: 0,
      vy: 0,
      moved: false,
      clickedTile:
        tileEl && tileId && tileKey
          ? { id: tileId, key: tileKey, el: tileEl }
          : null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !drag.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      drag.moved = true;
      setIsDragging(true);
      setIsPanning(true);
      if (!drag.captured) {
        try {
          e.currentTarget.setPointerCapture(drag.pointerId);
          drag.captured = true;
        } catch {
          // Ignore if pointer already released
        }
      }
    }
    if (!drag.moved) return;

    drag.vx = e.clientX - drag.lastX;
    drag.vy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    setOffset({ x: drag.origOffsetX + dx, y: drag.origOffsetY + dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !drag.active) return;
    drag.active = false;
    setIsDragging(false);

    if (drag.captured) {
      try {
        e.currentTarget.releasePointerCapture(drag.pointerId);
      } catch {
        // Ignore if capture already released
      }
    }

    // Clean click without drag on an Infinity tile -> launch exact per-tile Hero Morph!
    if (!drag.moved && drag.clickedTile && e.type === "pointerup") {
      setIsPanning(false);
      handledPointerClickRef.current = true;
      const { el, id, key } = drag.clickedTile;
      openTileQuickLook(el, id, key);
      return;
    }

    let vx = drag.vx * 0.9;
    let vy = drag.vy * 0.9;
    if (inertiaEnabled && drag.moved && Math.hypot(vx, vy) > 1.2) {
      const step = () => {
        vx *= 0.92;
        vy *= 0.92;
        if (Math.hypot(vx, vy) < 0.28) {
          coastRafRef.current = null;
          setIsPanning(false);
          return;
        }
        setOffset((prev) => ({ x: prev.x + vx, y: prev.y + vy }));
        coastRafRef.current = requestAnimationFrame(step);
      };
      coastRafRef.current = requestAnimationFrame(step);
    } else {
      setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    stopCoasting();
    const shouldZoom =
      wheelZoomMode === "direct" || e.ctrlKey || e.metaKey;
    if (shouldZoom) {
      e.preventDefault();
      setIsPanning(false);
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      onZoomChange(zoom + delta);
    } else {
      setIsPanning(true);
      if (wheelPanTimerRef.current !== null) {
        window.clearTimeout(wheelPanTimerRef.current);
      }
      wheelPanTimerRef.current = window.setTimeout(() => {
        setIsPanning(false);
        wheelPanTimerRef.current = null;
      }, 140);
      setOffset((prev) => ({
        x: prev.x - e.deltaX * 0.95,
        y: prev.y - e.deltaY * 0.95,
      }));
    }
  };

  if (items.length === 0) {
    return (
      <div className="atlas-empty">
        <strong>{m.emptyInfinityTitle}</strong>
        <span>{m.emptyInfinitySub}</span>
      </div>
    );
  }

  const stageRect = stageRef.current?.getBoundingClientRect();
  const stageLeft = stageRect?.left ?? 0;
  const stageTop = stageRect?.top ?? 0;
  const isHeroSession = heroPush.heroKey !== null;
  const pushDurationMs = Math.round(
    (heroPush.active ? HERO_OPEN_DURATION_S : HERO_CLOSE_DURATION_S) *
      speedMultiplier *
      1000,
  );

  return (
    <div
      ref={stageRef}
      className={`infinity-stage ${isDragging ? "infinity-stage--dragging" : ""}`}
      data-testid="infinity-stage"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {visibleTiles.map((tile) => {
        const isHeroHidden = activeHeroKey === tile.key;
        const isFocused = lastFocusedKey === tile.key;

        const tileScreenRect: ScreenRect = {
          left: stageLeft + tile.x,
          top: stageTop + tile.y,
          width: tile.width,
          height: tile.height,
        };
        const push = isHeroHidden
          ? { dx: 0, dy: 0, scale: 1, opacity: 1 }
          : computeNeighborPushOffset(
              tileScreenRect,
              heroPush.originRect,
              heroPush.targetRect,
              heroPush.active,
            );

        const tileTransition = isHeroHidden
          ? "none"
          : isHeroSession
            ? `transform ${pushDurationMs}ms ${HERO_CSS_EASE}, opacity ${pushDurationMs}ms ${HERO_CSS_EASE}, box-shadow 180ms ease`
            : isPanning
              ? "box-shadow 180ms ease"
              : `transform 260ms ${HERO_CSS_EASE}, width 260ms ${HERO_CSS_EASE}, height 260ms ${HERO_CSS_EASE}, border-radius 200ms ease, box-shadow 180ms ease`;

        return (
          <div
            key={tile.key}
            role="button"
            tabIndex={0}
            data-atlas-card-id={tile.item.id}
            data-atlas-card-key={tile.key}
            data-hero-hidden={isHeroHidden ? "true" : "false"}
            data-push-dx={push.dx}
            data-push-dy={push.dy}
            data-push-scale={push.scale}
            data-testid={`infinity-tile-${tile.key}`}
            className={`infinity-tile ${isFocused ? "infinity-tile--focused" : ""}`}
            style={{
              width: `${tile.width}px`,
              height: `${tile.height}px`,
              borderRadius: `${radius}px`,
              opacity: push.opacity,
              visibility: isHeroHidden ? "hidden" : "visible",
              transform: `translate3d(${tile.x + push.dx}px, ${tile.y + push.dy}px, 0) scale(${push.scale})`,
              transition: tileTransition,
            }}
            onClick={(e) => {
              if (handledPointerClickRef.current) {
                handledPointerClickRef.current = false;
                return;
              }
              if (!dragRef.current?.moved) {
                openTileQuickLook(e.currentTarget, tile.item.id, tile.key);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openTileQuickLook(e.currentTarget, tile.item.id, tile.key);
              }
            }}
          >
            <RichMediaCardContent
              item={tile.item}
              theme={theme}
              interactiveAudio={false}
            />

            {showCardBadges && tile.item.kind === "video" && (
              <span className="card-video-badge">
                <span aria-hidden="true">▶</span>
                <span>{tile.item.duration ?? "0:08"}</span>
              </span>
            )}

            {showCardBadges && tile.item.kind === "model3d" && tile.item.modelMeta && (
              <span className="card-type-badge">
                3D · {tile.item.modelMeta.format}
              </span>
            )}

            {showCardBadges && tile.item.kind === "gif" && (
              <span className="card-type-badge">GIF</span>
            )}

            {showCardBadges && tile.item.kind === "link" && tile.item.domain && (
              <span className="card-link-pill">
                <LinkIcon size={11} />
                <span>{tile.item.domain}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
