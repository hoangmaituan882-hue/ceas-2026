import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildEmbeddedMotionSrcDoc,
  inferEmbeddedReelTheme,
  moveNodePreservingState,
  parseDurationToSeconds,
  resolveActiveHostSlot,
  type AtomicMoveStrategy,
  type AtomicSlotKind,
} from "./atomic-dom-move";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { getMessages, type AppLocale } from "./i18n";
import type { LibraryItem } from "./library-engine";
import { formatAudioTime } from "./media-helpers";
import {
  buildVideoCssFilter,
  buildVideoPreviewTransform,
  hasNonDestructiveEdits,
} from "./video-editor-engine";

export interface AtomicVideoPlaybackState {
  itemId: string;
  playing: boolean;
  elapsed: number;
  duration: number;
  sessionId: string | null;
  activeSlot: AtomicSlotKind;
  moveCount: number;
  lastStrategy: AtomicMoveStrategy | null;
}

interface ManagedPlayerEntry {
  itemId: string;
  wrapper: HTMLDivElement;
  iframe: HTMLIFrameElement | null;
  videoEl: HTMLVideoElement | null;
  state: AtomicVideoPlaybackState;
  slots: {
    quicklook: HTMLElement | null;
    pip: HTMLElement | null;
    card: HTMLElement | null;
  };
}

type Listener = () => void;

/**
 * Singleton Atomic DOM Player Registry.
 * Keeps every active embedded player (<iframe> or <video>) connected to the live DOM
 * at all times—even across React component unmounts/remounts (Grid <-> Canvas,
 * Card <-> QuickLook <-> Floating PiP)—by atomically reparenting via `slot.moveBefore(player, null)`
 * with an always-mounted hidden parking container and automatic `insertBefore` fallback.
 */
class AtomicMediaPlayerManager {
  private entries = new Map<string, ManagedPlayerEntry>();
  private parkingEl: HTMLDivElement | null = null;
  private pipItemId: string | null = null;
  private listeners = new Set<Listener>();
  private messageBound = false;
  private version = 0;

  private ensureParking(): HTMLDivElement {
    if (this.parkingEl && this.parkingEl.isConnected) {
      return this.parkingEl;
    }
    const el = document.createElement("div");
    el.setAttribute("data-atlas-atomic-parking", "true");
    el.setAttribute("aria-hidden", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    el.style.width = "320px";
    el.style.height = "180px";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.overflow = "hidden";
    el.style.zIndex = "-1";
    document.body.appendChild(el);
    this.parkingEl = el;
    return el;
  }

  private ensureMessageListener(): void {
    if (this.messageBound || typeof window === "undefined") return;
    this.messageBound = true;
    window.addEventListener("message", (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.type !== "atlas-embed-state" || typeof data.itemId !== "string") {
        return;
      }
      const entry = this.entries.get(data.itemId);
      if (!entry) return;
      entry.state = {
        ...entry.state,
        playing: Boolean(data.playing),
        elapsed: typeof data.elapsed === "number" ? data.elapsed : entry.state.elapsed,
        duration: typeof data.duration === "number" ? data.duration : entry.state.duration,
        sessionId: typeof data.sessionId === "string" ? data.sessionId : entry.state.sessionId,
      };
      this.notify();
    });
  }

  private notify(): void {
    this.version += 1;
    for (const fn of this.listeners) {
      fn();
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getVersion(): number {
    return this.version;
  }

  getPipItemId(): string | null {
    return this.pipItemId;
  }

  isItemActive(itemId: string): boolean {
    return this.entries.has(itemId);
  }

  getPlaybackState(itemId: string): AtomicVideoPlaybackState | null {
    return this.entries.get(itemId)?.state ?? null;
  }

  /**
   * Ensures a persistent live player DOM wrapper exists for `item` and is attached
   * to the document so all subsequent transfers use atomic `moveBefore()`.
   */
  ensurePlayer(item: LibraryItem): ManagedPlayerEntry {
    this.ensureMessageListener();
    const existing = this.entries.get(item.id);
    if (existing) {
      return existing;
    }

    const parking = this.ensureParking();
    const wrapper = document.createElement("div");
    wrapper.className = "atomic-player-node";
    wrapper.setAttribute("data-testid", `atomic-player-${item.id}`);
    wrapper.setAttribute("data-item-id", item.id);

    const durationSec = parseDurationToSeconds(item.duration);
    const isBlobVideo =
      item.src.startsWith("blob:") &&
      /\.(mp4|mov|webm|m4v)$/i.test(item.filename);

    let iframe: HTMLIFrameElement | null = null;
    let videoEl: HTMLVideoElement | null = null;

    if (isBlobVideo) {
      videoEl = document.createElement("video");
      videoEl.src = item.src;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      videoEl.className = "atomic-player-media";
      wrapper.appendChild(videoEl);
    } else {
      iframe = document.createElement("iframe");
      iframe.className = "atomic-player-media";
      iframe.title = item.title;
      iframe.setAttribute("data-testid", `atomic-iframe-${item.id}`);
      iframe.srcdoc = buildEmbeddedMotionSrcDoc({
        itemId: item.id,
        title: item.title,
        posterUrl: item.src,
        durationSec,
        palette: item.palette,
        reelTheme: inferEmbeddedReelTheme(item.id, item.title),
      });
      wrapper.appendChild(iframe);
    }

    const entry: ManagedPlayerEntry = {
      itemId: item.id,
      wrapper,
      iframe,
      videoEl,
      state: {
        itemId: item.id,
        playing: true,
        elapsed: 0,
        duration: durationSec,
        sessionId: null,
        activeSlot: "parking",
        moveCount: 0,
        lastStrategy: null,
      },
      slots: {
        quicklook: null,
        pip: null,
        card: null,
      },
    };

    if (videoEl) {
      videoEl.addEventListener("timeupdate", () => {
        entry.state = {
          ...entry.state,
          elapsed: videoEl!.currentTime,
          duration:
            Number.isFinite(videoEl!.duration) && videoEl!.duration > 0
              ? videoEl!.duration
              : durationSec,
          playing: !videoEl!.paused,
        };
        this.notify();
      });
      videoEl.play().catch(() => {});
    }

    // Mount once into the always-connected parking container
    parking.appendChild(wrapper);
    this.entries.set(item.id, entry);
    this.notify();
    return entry;
  }

  /**
   * Starts inline live playback for a video item (creates the persistent player
   * and moves it straight into its highest-priority mounted slot).
   */
  activateItem(item: LibraryItem): void {
    const entry = this.ensurePlayer(item);
    this.sendCommand(item.id, "play");
    this.reconcileSlot(entry);
    this.notify();
  }

  /**
   * Pins an item to the floating Picture-in-Picture mini-player.
   * When QuickLook closes right after, the player moves atomically via `moveBefore()`
   * straight into the PiP slot with zero reload!
   */
  pinToPip(item: LibraryItem): void {
    const entry = this.ensurePlayer(item);
    this.pipItemId = item.id;
    this.reconcileSlot(entry);
    this.notify();
  }

  /**
   * Releases the floating PiP slot so the live player atomically returns to its
   * mounted Grid/Canvas card slot via `moveBefore()`, or parks cleanly.
   */
  dockFromPip(itemId: string): void {
    if (this.pipItemId === itemId) {
      this.pipItemId = null;
    }
    const entry = this.entries.get(itemId);
    if (entry) {
      entry.slots.pip = null;
      this.reconcileSlot(entry);
    }
    this.notify();
  }

  /**
   * Completely stops and disposes an active embedded player.
   */
  stopItem(itemId: string): void {
    if (this.pipItemId === itemId) {
      this.pipItemId = null;
    }
    const entry = this.entries.get(itemId);
    if (!entry) return;
    entry.videoEl?.pause();
    entry.wrapper.remove();
    this.entries.delete(itemId);
    this.notify();
  }

  sendCommand(
    itemId: string,
    action: "play" | "pause" | "toggle" | "seek",
    time?: number,
  ): void {
    const entry = this.entries.get(itemId);
    if (!entry) return;

    if (entry.videoEl) {
      if (action === "play") entry.videoEl.play().catch(() => {});
      else if (action === "pause") entry.videoEl.pause();
      else if (action === "toggle") {
        if (entry.videoEl.paused) entry.videoEl.play().catch(() => {});
        else entry.videoEl.pause();
      } else if (action === "seek" && typeof time === "number") {
        entry.videoEl.currentTime = Math.max(0, Math.min(entry.state.duration, time));
      }
      entry.state = {
        ...entry.state,
        playing: !entry.videoEl.paused,
        elapsed: entry.videoEl.currentTime,
      };
      this.notify();
      return;
    }

    if (action === "play") {
      entry.state = { ...entry.state, playing: true };
    } else if (action === "pause") {
      entry.state = { ...entry.state, playing: false };
    } else if (action === "toggle") {
      entry.state = { ...entry.state, playing: !entry.state.playing };
    } else if (action === "seek" && typeof time === "number") {
      entry.state = {
        ...entry.state,
        elapsed: Math.max(0, Math.min(entry.state.duration, time)),
      };
    }

    try {
      entry.iframe?.contentWindow?.postMessage(
        { type: "atlas-embed-cmd", itemId, action, time },
        "*",
      );
    } catch {
      // ignore cross-frame race during initial frame
    }
    this.notify();
  }

  registerSlot(
    item: LibraryItem,
    kind: "quicklook" | "pip" | "card",
    slotEl: HTMLElement,
    autoCreate: boolean,
  ): void {
    const entry = autoCreate
      ? this.ensurePlayer(item)
      : this.entries.get(item.id);
    if (!entry) return;
    entry.slots[kind] = slotEl;
    this.reconcileSlot(entry);
  }

  unregisterSlot(
    itemId: string,
    kind: "quicklook" | "pip" | "card",
    slotEl: HTMLElement,
  ): void {
    const entry = this.entries.get(itemId);
    if (!entry) return;
    if (entry.slots[kind] === slotEl) {
      entry.slots[kind] = null;
    }
    // Synchronously evacuate via atomic `moveBefore()` BEFORE React detaches `slotEl`
    // so the <iframe> is NEVER disconnected from document.body!
    this.reconcileSlot(entry);
  }

  private reconcileSlot(entry: ManagedPlayerEntry): void {
    const parking = this.ensureParking();
    const targetKind = resolveActiveHostSlot({
      hasQuickLook: Boolean(entry.slots.quicklook && entry.slots.quicklook.isConnected),
      hasPip: Boolean(entry.slots.pip && entry.slots.pip.isConnected),
      hasCard: Boolean(entry.slots.card && entry.slots.card.isConnected),
    });

    const targetEl: HTMLElement =
      targetKind === "quicklook"
        ? entry.slots.quicklook!
        : targetKind === "pip"
          ? entry.slots.pip!
          : targetKind === "card"
            ? entry.slots.card!
            : parking;

    const strategy = moveNodePreservingState(targetEl, entry.wrapper, null);
    if (strategy !== "noop" || entry.state.activeSlot !== targetKind) {
      entry.wrapper.setAttribute("data-host-slot", targetKind);
      entry.wrapper.setAttribute("data-move-strategy", strategy);
      entry.state = {
        ...entry.state,
        activeSlot: targetKind,
        moveCount:
          strategy === "noop" ? entry.state.moveCount : entry.state.moveCount + 1,
        lastStrategy: strategy === "noop" ? entry.state.lastStrategy : strategy,
      };
      this.notify();
    }
  }
}

export const atomicMediaPlayerManager = new AtomicMediaPlayerManager();

export function useAtomicMediaVersion(): number {
  const [, setVer] = useState(() => atomicMediaPlayerManager.getVersion());
  useEffect(() => {
    return atomicMediaPlayerManager.subscribe(() => {
      setVer(atomicMediaPlayerManager.getVersion());
    });
  }, []);
  return atomicMediaPlayerManager.getVersion();
}

export interface AtomicVideoSlotProps {
  item: LibraryItem;
  slotKind: "quicklook" | "pip" | "card";
  autoActivate?: boolean;
  className?: string;
}

/**
 * Host slot that claims the item's persistent live player DOM node via `moveBefore()`
 * on mount and evacuates it atomically to the next highest-priority slot (or parking)
 * BEFORE React unmounts this slot.
 */
export function AtomicVideoSlot({
  item,
  slotKind,
  autoActivate = false,
  className = "",
}: AtomicVideoSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef(item);
  itemRef.current = item;
  useAtomicMediaVersion();
  const isActive = autoActivate || atomicMediaPlayerManager.isItemActive(item.id);

  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el || !isActive) return;
    atomicMediaPlayerManager.registerSlot(itemRef.current, slotKind, el, autoActivate);
    return () => {
      atomicMediaPlayerManager.unregisterSlot(itemRef.current.id, slotKind, el);
    };
  }, [item.id, slotKind, autoActivate, isActive]);

  return (
    <div
      ref={slotRef}
      className={`atomic-video-slot atomic-video-slot--${slotKind} ${className}`}
      data-testid={`atomic-slot-${slotKind}-${item.id}`}
    />
  );
}

export interface VideoQuickLookStageProps {
  item: LibraryItem;
  locale: AppLocale;
  onPinToPip: (item: LibraryItem) => void;
  onEnterEdit?: (item: LibraryItem) => void;
}

/**
 * QuickLook Video Stage backed by `AtomicVideoSlot` (`moveBefore`) + tactile
 * `#F2901B` ElasticMotionBar timeline + seamless Picture-in-Picture pop-out +
 * non-destructive Video Studio entry.
 */
export function VideoQuickLookStage({
  item,
  locale,
  onPinToPip,
  onEnterEdit,
}: VideoQuickLookStageProps) {
  const m = getMessages(locale);
  useAtomicMediaVersion();

  useEffect(() => {
    window.getSelection?.()?.removeAllRanges();
  }, [item.id]);

  const snap = atomicMediaPlayerManager.getPlaybackState(item.id);
  const playing = snap?.playing ?? true;
  const elapsed = snap?.elapsed ?? 0;
  const duration = snap?.duration ?? parseDurationToSeconds(item.duration);
  const isEdited = hasNonDestructiveEdits(item.videoEdit, item);
  const savedFilter = item.videoEdit
    ? buildVideoCssFilter(item.videoEdit.grade)
    : "none";
  const savedTransform = item.videoEdit
    ? buildVideoPreviewTransform(item.videoEdit.transform)
    : "none";

  return (
    <div
      className="ql-video-stage"
      data-testid="ql-video-stage"
      data-video-edited={isEdited ? "true" : "false"}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="ql-video-media-wrap"
        data-testid="ql-video-media-wrap"
        style={{
          filter: savedFilter,
          transform: savedTransform,
        }}
      >
        <AtomicVideoSlot item={item} slotKind="quicklook" autoActivate />
      </div>

      <div className="ql-video-controls-bar">
        <button
          type="button"
          className="ql-video-icon-btn"
          data-testid="ql-video-play-toggle"
          aria-label={playing ? m.mediaPause : m.mediaPlay}
          onClick={() => atomicMediaPlayerManager.sendCommand(item.id, "toggle")}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="2.5" y="2" width="3.2" height="10" rx="0.9" />
              <rect x="8.3" y="2" width="3.2" height="10" rx="0.9" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3.6 2.1L11.8 7L3.6 11.9V2.1Z" />
            </svg>
          )}
        </button>

        <span className="ql-video-time" data-testid="ql-video-elapsed">
          {formatAudioTime(elapsed)}
        </span>

        <div className="ql-video-scrubber-wrap">
          <ElasticMotionBar
            min={0}
            max={Math.max(1, Math.round(duration * 10))}
            step={1}
            value={Math.round(elapsed * 10)}
            size="sm"
            width="100%"
            ariaLabel={m.videoScrubLabel}
            testId="ql-video-scrubber"
            onChange={(tenths) => {
              atomicMediaPlayerManager.sendCommand(item.id, "seek", tenths / 10);
            }}
          />
        </div>

        <span className="ql-video-time ql-video-time--dim">
          {formatAudioTime(duration)}
        </span>

        {onEnterEdit && (
          <button
            type="button"
            className={`ql-video-edit-btn ${isEdited ? "ql-video-edit-btn--edited" : ""}`}
            data-testid="ql-video-edit-btn"
            title={m.videoEditBtn}
            aria-label={m.videoEditBtn}
            onClick={() => onEnterEdit(item)}
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
            {isEdited && <span className="ql-video-edited-dot" aria-hidden="true" />}
          </button>
        )}

        <button
          type="button"
          className="ql-video-pip-btn"
          data-testid="ql-video-pip-btn"
          title={m.videoPopOutPip}
          aria-label={m.videoPopOutPip}
          onClick={() => onPinToPip(item)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="2" />
            <rect x="7.8" y="7.6" width="4.6" height="3.8" rx="0.9" fill="currentColor" stroke="none" />
          </svg>
          <span>{m.videoPipShort}</span>
        </button>
      </div>
    </div>
  );
}

export interface FloatingPipPlayerProps {
  items: readonly LibraryItem[];
  locale: AppLocale;
  onExpandQuickLook: (itemId: string) => void;
}

/**
 * Floating macOS Porcelain Mini-Player (Picture-in-Picture) powered by `moveBefore()`.
 * Keeps embedded video/motion playback running seamlessly while browsing Grid,
 * Canvas, or Infinity views, and can atomically dock back into any card or QuickLook.
 */
export function FloatingPipPlayer({
  items,
  locale,
  onExpandQuickLook,
}: FloatingPipPlayerProps) {
  const m = getMessages(locale);
  useAtomicMediaVersion();
  const pipId = atomicMediaPlayerManager.getPipItemId();
  const item = pipId ? items.find((it) => it.id === pipId) ?? null : null;
  const snap = pipId ? atomicMediaPlayerManager.getPlaybackState(pipId) : null;

  if (!item) return null;

  const playing = snap?.playing ?? true;
  const elapsed = snap?.elapsed ?? 0;
  const duration = snap?.duration ?? parseDurationToSeconds(item.duration);

  return (
    <motion.aside
      className="atomic-pip-dock"
      data-testid="atomic-pip-dock"
      aria-label={m.videoPipWindowLabel}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <div className="atomic-pip-viewport">
        <AtomicVideoSlot item={item} slotKind="pip" autoActivate />

        <div className="atomic-pip-overlay-top">
          <span className="atomic-pip-title">{item.title}</span>
          <div className="atomic-pip-actions">
            <button
              type="button"
              className="atomic-pip-btn"
              data-testid="pip-expand-btn"
              title={m.videoReturnQuickLook}
              aria-label={m.videoReturnQuickLook}
              onClick={() => onExpandQuickLook(item.id)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8.5 2H12v3.5M12 2L7.5 6.5M5.5 12H2V8.5M2 12l4.5-4.5" />
              </svg>
            </button>
            <button
              type="button"
              className="atomic-pip-btn"
              data-testid="pip-dock-card-btn"
              title={m.videoDockToCard}
              aria-label={m.videoDockToCard}
              onClick={() => atomicMediaPlayerManager.dockFromPip(item.id)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="1.8" y="2.2" width="10.4" height="9.6" rx="1.8" />
                <path d="M5 7h4M7 5v4" />
              </svg>
            </button>
            <button
              type="button"
              className="atomic-pip-btn"
              data-testid="pip-close-btn"
              title={m.videoClosePip}
              aria-label={m.videoClosePip}
              onClick={() => atomicMediaPlayerManager.stopItem(item.id)}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="atomic-pip-bar">
        <button
          type="button"
          className="atomic-pip-play-btn"
          data-testid="pip-play-toggle"
          aria-label={playing ? m.mediaPause : m.mediaPlay}
          onClick={() => atomicMediaPlayerManager.sendCommand(item.id, "toggle")}
        >
          {playing ? (
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

        <div className="atomic-pip-scrub">
          <ElasticMotionBar
            min={0}
            max={Math.max(1, Math.round(duration * 10))}
            step={1}
            value={Math.round(elapsed * 10)}
            size="xs"
            width="100%"
            ariaLabel={m.videoScrubLabel}
            testId="pip-video-scrubber"
            onChange={(tenths) => {
              atomicMediaPlayerManager.sendCommand(item.id, "seek", tenths / 10);
            }}
          />
        </div>

        <span className="atomic-pip-time" data-testid="pip-elapsed">
          {formatAudioTime(elapsed)}
        </span>
      </div>
    </motion.aside>
  );
}
