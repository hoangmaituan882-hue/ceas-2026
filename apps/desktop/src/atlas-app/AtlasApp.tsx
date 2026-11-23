import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AllGridIcon,
  ExportIcon,
  FitAspectIcon,
  HeartIcon,
  JustifiedIcon,
  SearchIcon,
  ShuffleIcon,
  SidebarToggleIcon,
  SlidersIcon,
  SquareGridIcon,
  SunMoonIcon,
  TrashIcon,
  UploadIcon,
} from "./AppIcons";
import { AtlasSidebar } from "./AtlasSidebar";
import {
  atomicMediaPlayerManager,
  FloatingPipPlayer,
} from "./AtomicMediaPlayerHost";
import { CanvasBoardView } from "./CanvasBoardView";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { GridGalleryView } from "./GridGalleryView";
import { InfinityDriftView } from "./InfinityDriftView";
import {
  getQuickLookStageDimensions,
  QuickLookLightbox,
} from "./QuickLookLightbox";
import { SettingsModal } from "./SettingsModal";
import {
  detectAssetKindFromFilename,
  generateDeterministicWaveform,
} from "./media-helpers";
import {
  computeHarmoniousCanvasClusters,
  packCanvasMosaic,
  packCanvasPile,
  resolveCanvasPushCollisions,
  type CanvasNodeBox,
} from "./canvas-physics";
import {
  computeLightboxTargetRect,
  HERO_CLOSE_DURATION_S,
  resolveHeroHandoffFlags,
  unpushCardRect,
  type HeroPushContext,
  type QuickLookPhase,
  type ScreenRect,
} from "./hero-transition";
import type { CollapseRevealHandler } from "./viewport-motion";
import {
  DEFAULT_SETTINGS,
  getDisplayLibraryName,
  getMessages,
  getQuickLookSpeedMultiplier,
  getTidyDensityParams,
  normalizeSettings,
  type AppLocale,
  type AppSettings,
  type SettingsCategoryId,
} from "./i18n";
import type { SidebarDropTarget } from "./drag-selection-engine";
import {
  clampRadius,
  clampSpacing,
  clampZoom,
  createTagFolder,
  filterLibraryItems,
  nestTagIntoFolder,
  shuffleItems,
  unnestTag,
  type AppearancePrefs,
  type CollectionItem,
  type GridLayoutMode,
  type LibraryItem,
  type TagFolder,
  type ViewMode,
} from "./library-engine";
import {
  INITIAL_COLLECTIONS,
  INITIAL_LIBRARY_ITEMS,
  INITIAL_TAG_FOLDERS,
} from "./seed-library";
import type { VideoEditRecipe } from "./video-editor-engine";
import "./atlas-app.css";

const APPEARANCE_STORAGE_KEY = "atlas-app-appearance-v1";
const SETTINGS_STORAGE_KEY = "atlas-app-settings-v1";
const VIDEO_EDITS_STORAGE_KEY = "atlas-app-video-edits-v1";
const COLLECTION_PALETTE = [
  "#ff7a18",
  "#007aff",
  "#e11d48",
  "#22c55e",
  "#8b5cf6",
  "#0ea5e9",
  "#eab308",
];

const DEFAULT_APPEARANCE: AppearancePrefs = {
  theme: "light",
  zoom: 1.1,
  spacing: 12,
  radius: 10,
  gridLayout: "justified",
};

function loadAppearance(): AppearancePrefs {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      zoom: clampZoom(parsed.zoom ?? DEFAULT_APPEARANCE.zoom),
      spacing: clampSpacing(parsed.spacing ?? DEFAULT_APPEARANCE.spacing),
      radius: clampRadius(parsed.radius ?? DEFAULT_APPEARANCE.radius),
      gridLayout:
        parsed.gridLayout === "square" || parsed.gridLayout === "fit"
          ? parsed.gridLayout
          : "justified",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function loadSavedVideoEdits(): Record<string, VideoEditRecipe> {
  try {
    const raw = window.localStorage.getItem(VIDEO_EDITS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VideoEditRecipe>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildInitialLibraryItems(): LibraryItem[] {
  const savedVideoEdits = loadSavedVideoEdits();
  const layout = computeHarmoniousCanvasClusters(INITIAL_LIBRARY_ITEMS, 12, 128);
  return INITIAL_LIBRARY_ITEMS.map((item, idx) => {
    const p = layout[item.id];
    const savedEdit = savedVideoEdits[item.id];
    if (!p) {
      return savedEdit ? { ...item, videoEdit: savedEdit } : item;
    }
    return {
      ...item,
      ...(savedEdit ? { videoEdit: savedEdit } : {}),
      canvasX: p.x,
      canvasY: p.y,
      canvasW: p.w,
      canvasZ: idx + 1,
    };
  });
}

export function AtlasApp() {
  const [items, setItems] = useState<LibraryItem[]>(buildInitialLibraryItems);
  const [collections, setCollections] =
    useState<CollectionItem[]>(INITIAL_COLLECTIONS);
  const [tagFolders, setTagFolders] =
    useState<TagFolder[]>(INITIAL_TAG_FOLDERS);
  const [customTags, setCustomTags] = useState<string[]>([]);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialCategory, setSettingsInitialCategory] =
    useState<SettingsCategoryId>("general");

  const [activeNav, setActiveNav] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadSettings().defaultView);
  const [appearance, setAppearance] = useState<AppearancePrefs>(loadAppearance);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [likedOnly, setLikedOnly] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastFocused, setLastFocused] = useState<{
    id: string;
    key: string | null;
  } | null>(null);
  const [quickLookState, setQuickLookState] = useState<{
    id: string;
    originItemId: string;
    originCardKey: string | null;
    originRect: ScreenRect | null;
    returnRect: ScreenRect | null;
    phase: QuickLookPhase;
  } | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const [canvasResetSignal, setCanvasResetSignal] = useState(0);
  const [infinityRecenterSignal, setInfinityRecenterSignal] = useState(0);
  const [activeSidebarDropKey, setActiveSidebarDropKey] = useState<string | null>(null);
  const [sidebarPulseKey, setSidebarPulseKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const sidebarPulseTimerRef = useRef<number | null>(null);
  const revealHandlerRef = useRef<CollapseRevealHandler | null>(null);
  const quickLookStateRef = useRef(quickLookState);
  quickLookStateRef.current = quickLookState;

  const handleRegisterRevealHandler = useCallback(
    (handler: CollapseRevealHandler | null) => {
      revealHandlerRef.current = handler;
    },
    [],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify(appearance),
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [appearance]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [settings]);

  const handleUpdateVideoEdit = useCallback(
    (id: string, recipe: VideoEditRecipe | undefined) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, videoEdit: recipe } : it)),
      );
      try {
        const current = loadSavedVideoEdits();
        if (recipe) {
          current[id] = recipe;
        } else {
          delete current[id];
        }
        window.localStorage.setItem(
          VIDEO_EDITS_STORAGE_KEY,
          JSON.stringify(current),
        );
      } catch {
        // Ignore storage quota issues
      }
    },
    [],
  );

  const m = useMemo(() => getMessages(settings.locale), [settings.locale]);
  const displayLibraryName = useMemo(
    () => getDisplayLibraryName(settings),
    [settings],
  );
  const speedMultiplier = useMemo(
    () => getQuickLookSpeedMultiplier(settings.quickLookSpeed),
    [settings.quickLookSpeed],
  );

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }));
  }, []);

  const handleChangeLocale = useCallback(
    (nextLocale: AppLocale) => {
      setSettings((prev) => ({ ...prev, locale: nextLocale }));
      notify(getMessages(nextLocale).toastLanguageSwitched);
    },
    [notify],
  );

  const handleResetAllDefaults = useCallback(() => {
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, locale: prev.locale }));
    setAppearance({ ...DEFAULT_APPEARANCE });
    notify(m.toastSettingsReset);
  }, [m.toastSettingsReset, notify]);

  const handleEmptyTrashItems = useCallback(() => {
    setItems((prev) => prev.filter((it) => !it.trashed));
  }, []);

  const filteredItems = useMemo(() => {
    const base = filterLibraryItems(
      items,
      activeNav,
      searchQuery,
      likedOnly,
      tagFolders,
    );
    return shuffleSeed > 0 ? shuffleItems(base, shuffleSeed) : base;
  }, [items, activeNav, searchQuery, likedOnly, tagFolders, shuffleSeed]);

  const quickLookPhase = quickLookState?.phase ?? null;
  const heroHandoff = resolveHeroHandoffFlags(
    quickLookPhase,
    settings.radialNeighborPush,
  );
  const quickLookId = quickLookState?.id ?? null;
  const activeHeroKey =
    quickLookState && heroHandoff.hideUnderlyingCard
      ? quickLookState.id === quickLookState.originItemId && quickLookState.originCardKey
        ? quickLookState.originCardKey
        : `${viewMode}:${quickLookState.id}`
      : null;
  const isLightboxOpen = quickLookPhase === "open";

  const resolveLiveRestingCardRect = useCallback(
    (itemId: string, preferredKey: string | null): ScreenRect | null => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let el: HTMLElement | null = null;

      if (preferredKey) {
        el = document.querySelector<HTMLElement>(
          `[data-atlas-card-key="${CSS.escape(preferredKey)}"]`,
        );
      }
      if (!el) {
        const candidates = [
          ...document.querySelectorAll<HTMLElement>(
            `[data-atlas-card-id="${CSS.escape(itemId)}"]`,
          ),
        ];
        let bestDist = Infinity;
        for (const node of candidates) {
          const r = node.getBoundingClientRect();
          if (r.width < 10 || r.height < 10) continue;
          if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) continue;
          const dist = Math.hypot(
            r.left + r.width / 2 - vw / 2,
            r.top + r.height / 2 - vh / 2,
          );
          if (dist < bestDist) {
            bestDist = dist;
            el = node;
          }
        }
      }
      if (!el) return null;

      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return null;
      const pushDx = Number(el.dataset.pushDx ?? "0") || 0;
      const pushDy = Number(el.dataset.pushDy ?? "0") || 0;
      const pushScale = Number(el.dataset.pushScale ?? "1") || 1;
      return unpushCardRect(
        { left: r.left, top: r.top, width: r.width, height: r.height },
        pushDx,
        pushDy,
        pushScale,
      );
    },
    [],
  );

  const openQuickLook = useCallback(
    (id: string, originRect?: ScreenRect, originKey?: string) => {
      const resolvedKey = originKey ?? `${viewMode}:${id}`;
      const rect = originRect ?? resolveLiveRestingCardRect(id, resolvedKey);
      setCustomizeOpen(false);
      setLastFocused({ id, key: resolvedKey });
      setQuickLookState({
        id,
        originItemId: id,
        originCardKey: resolvedKey,
        originRect: rect,
        returnRect: rect,
        phase: "open",
      });
    },
    [viewMode, resolveLiveRestingCardRect],
  );

  const requestCloseQuickLook = useCallback(() => {
    const prev = quickLookStateRef.current;
    if (!prev || prev.phase !== "open") return;

    const targetKey =
      prev.id === prev.originItemId
        ? prev.originCardKey
        : `${viewMode}:${prev.id}`;
    const closeDurationMs = Math.round(
      HERO_CLOSE_DURATION_S * speedMultiplier * 1000,
    );
    const revealed = revealHandlerRef.current?.(
      prev.id,
      targetKey,
      closeDurationMs,
    );
    const resolvedKey = revealed?.cardKey ?? targetKey;
    const resolvedReturn =
      revealed?.rect ??
      (prev.id === prev.originItemId && prev.originRect
        ? prev.originRect
        : resolveLiveRestingCardRect(prev.id, resolvedKey));

    setLastFocused({ id: prev.id, key: resolvedKey });
    setQuickLookState((cur) => {
      if (!cur || cur.phase !== "open") return cur;
      return {
        ...cur,
        originItemId: cur.id,
        originCardKey: resolvedKey,
        returnRect: resolvedReturn,
        phase: "closing",
      };
    });
  }, [viewMode, speedMultiplier, resolveLiveRestingCardRect]);

  const beginLandingQuickLook = useCallback(() => {
    setQuickLookState((prev) => {
      if (!prev || prev.phase === "landing") return prev;
      return { ...prev, phase: "landing" };
    });
  }, []);

  // Double-buffered CoreAnimation-style landing handoff:
  // `phase: "landing"` flips `activeHeroKey` to null immediately so the real card
  // underneath becomes synchronously `visibility: visible` while the hero frame
  // remains composited cleanly on top for 2 animation frames before unmounting.
  useEffect(() => {
    if (quickLookState?.phase !== "landing") return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setQuickLookState((prev) => (prev?.phase === "landing" ? null : prev));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [quickLookState?.phase]);

  const quickLookItem = useMemo(
    () => (quickLookId ? items.find((it) => it.id === quickLookId) ?? null : null),
    [items, quickLookId],
  );

  const heroPushContext = useMemo<HeroPushContext>(() => {
    if (!quickLookState || !quickLookItem) {
      return { active: false, heroKey: null, originRect: null, targetRect: null };
    }
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const dims = getQuickLookStageDimensions(quickLookItem);
    const targetRect = computeLightboxTargetRect(
      vw,
      vh,
      dims.width,
      dims.height,
      false,
    );
    return {
      active: heroHandoff.neighborsPushed,
      heroKey: activeHeroKey,
      originRect: quickLookState.returnRect ?? quickLookState.originRect,
      targetRect,
    };
  }, [quickLookState, quickLookItem, activeHeroKey, heroHandoff.neighborsPushed]);

  const activeHeading = useMemo(() => {
    if (activeNav === "all") return displayLibraryName;
    if (activeNav === "inbox") return m.navInbox;
    if (activeNav === "likes") return m.navLikes;
    if (activeNav === "links") return m.navLinks;
    if (activeNav === "untagged") return m.navUntagged;
    if (activeNav === "trash") return m.navTrash;
    if (activeNav === "media:model3d") return m.navModels3d;
    if (activeNav === "media:audio") return m.navAudio;
    if (activeNav === "media:font") return m.navFonts;
    if (activeNav === "media:gif") return m.navGifs;
    if (activeNav.startsWith("collection:")) {
      const id = activeNav.slice("collection:".length);
      return collections.find((c) => c.id === id)?.name ?? m.sectionCollections;
    }
    if (activeNav.startsWith("tag:")) {
      return `#${activeNav.slice("tag:".length)}`;
    }
    if (activeNav.startsWith("tag-folder:")) {
      const id = activeNav.slice("tag-folder:".length);
      return tagFolders.find((f) => f.id === id)?.name ?? m.sectionTags;
    }
    return displayLibraryName;
  }, [activeNav, collections, tagFolders, displayLibraryName, m]);

  // Global macOS-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setCustomizeOpen(false);
        setSettingsOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isEditing || quickLookId || settingsOpen) return;

      if (e.key === "1") {
        setViewMode("grid");
      } else if (e.key === "2") {
        setViewMode("canvas");
      } else if (e.key === "3") {
        setViewMode("infinity");
      } else if (e.key.toLowerCase() === "d") {
        setAppearance((prev) => ({
          ...prev,
          theme: prev.theme === "dark" ? "light" : "dark",
        }));
      } else if (e.key.toLowerCase() === "s" && viewMode === "grid") {
        setShuffleSeed((s) => s + 1);
        notify(m.toastShuffled);
      } else if (e.key === "=" || e.key === "+") {
        setAppearance((prev) => ({ ...prev, zoom: clampZoom(prev.zoom + 0.15) }));
      } else if (e.key === "-") {
        setAppearance((prev) => ({ ...prev, zoom: clampZoom(prev.zoom - 0.15) }));
      } else if (e.key === " ") {
        const firstSelected = [...selectedIds][0];
        const fallback = filteredItems[0]?.id;
        const targetId = firstSelected ?? fallback;
        if (targetId) {
          e.preventDefault();
          openQuickLook(targetId);
        }
      } else if (e.key === "Escape") {
        if (customizeOpen) {
          setCustomizeOpen(false);
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        } else if (lastFocused) {
          setLastFocused(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    quickLookId,
    settingsOpen,
    selectedIds,
    lastFocused,
    filteredItems,
    customizeOpen,
    viewMode,
    notify,
    openQuickLook,
    m.toastShuffled,
  ]);

  const handleCommitOrder = useCallback((orderedVisibleIds: string[]) => {
    setShuffleSeed(0);
    setItems((prev) => {
      const visibleSet = new Set(orderedVisibleIds);
      const byId = new Map(prev.map((it) => [it.id, it] as const));
      const orderedVisible = orderedVisibleIds
        .map((id) => byId.get(id))
        .filter((it): it is LibraryItem => Boolean(it));
      let cursor = 0;
      return prev.map((it) => {
        if (!visibleSet.has(it.id)) return it;
        const replacement = orderedVisible[cursor];
        cursor += 1;
        return replacement ?? it;
      });
    });
  }, []);

  const handleSetSelectedIds = useCallback((nextIds: Set<string>) => {
    setSelectedIds(nextIds);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastFocused(null);
  }, []);

  const triggerSidebarPulse = useCallback((targetKey: string) => {
    setSidebarPulseKey(targetKey);
    if (sidebarPulseTimerRef.current !== null) {
      window.clearTimeout(sidebarPulseTimerRef.current);
    }
    sidebarPulseTimerRef.current = window.setTimeout(() => {
      setSidebarPulseKey(null);
      sidebarPulseTimerRef.current = null;
    }, 520);
  }, []);

  const handleDropToSidebar = useCallback(
    (itemIds: string[], target: SidebarDropTarget) => {
      if (itemIds.length === 0) return;
      const idSet = new Set(itemIds);
      const count = itemIds.length;
      triggerSidebarPulse(target.key);

      if (target.kind === "collection") {
        setItems((prev) =>
          prev.map((it) =>
            idSet.has(it.id)
              ? { ...it, collectionId: target.collectionId, trashed: false }
              : it,
          ),
        );
        const colName =
          collections.find((c) => c.id === target.collectionId)?.name ??
          m.sectionCollections;
        notify(m.toastBatchMovedTo(count, colName));
      } else if (target.kind === "inbox") {
        setItems((prev) =>
          prev.map((it) =>
            idSet.has(it.id) ? { ...it, collectionId: null, trashed: false } : it,
          ),
        );
        notify(m.toastBatchMovedTo(count, m.navInbox));
      } else if (target.kind === "likes") {
        setItems((prev) =>
          prev.map((it) => (idSet.has(it.id) ? { ...it, liked: true } : it)),
        );
        notify(m.toastBatchLiked(count));
      } else if (target.kind === "trash") {
        setItems((prev) =>
          prev.map((it) => (idSet.has(it.id) ? { ...it, trashed: true } : it)),
        );
        notify(m.toastBatchTrashed(count));
      } else if (target.kind === "tag") {
        setItems((prev) =>
          prev.map((it) =>
            idSet.has(it.id) && !it.tags.includes(target.tagName)
              ? { ...it, tags: [...it.tags, target.tagName] }
              : it,
          ),
        );
        notify(m.toastBatchTagged(count, target.tagName));
      }

      setSelectedIds(new Set());
    },
    [collections, m, notify, triggerSidebarPulse],
  );

  const handleToggleSelect = (id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(additive ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleLike = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, liked: !it.liked } : it)),
    );
  };

  const handleMoveToCollection = (id: string, collectionId: string | null) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, collectionId } : it)),
    );
    const colName = collectionId
      ? collections.find((c) => c.id === collectionId)?.name ?? "Collection"
      : "Inbox";
    notify(`Moved to ${colName}`);
  };

  const handleTrashOrRestore = (id: string) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const nextTrashed = !target.trashed;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, trashed: nextTrashed } : it)),
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    notify(nextTrashed ? "Moved to Trash" : "Restored to Library");
  };

  const handleBatchLike = () => {
    if (selectedIds.size === 0) return;
    setItems((prev) =>
      prev.map((it) => (selectedIds.has(it.id) ? { ...it, liked: true } : it)),
    );
    notify(`Liked ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}`);
  };

  const handleBatchTrash = () => {
    if (selectedIds.size === 0) return;
    const restoring = activeNav === "trash";
    const count = selectedIds.size;
    setItems((prev) =>
      prev.map((it) =>
        selectedIds.has(it.id) ? { ...it, trashed: !restoring } : it,
      ),
    );
    setSelectedIds(new Set());
    notify(
      restoring
        ? `Restored ${count} item${count > 1 ? "s" : ""}`
        : `Moved ${count} item${count > 1 ? "s" : ""} to Trash`,
    );
  };

  const handleExportSelection = () => {
    const targets =
      selectedIds.size > 0
        ? filteredItems.filter((it) => selectedIds.has(it.id))
        : filteredItems.slice(0, 1);
    if (targets.length === 0) return;
    const first = targets[0];
    if (first && targets.length === 1) {
      const link = document.createElement("a");
      link.href = first.src;
      link.download = first.filename;
      link.click();
      notify(`Exported ${first.filename}`);
      return;
    }
    notify(`Ready to export ${targets.length} files`);
  };

  const handleCreateCollection = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Collection name cannot be empty.";
    if (collections.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return "A collection with this name already exists.";
    }
    const color =
      COLLECTION_PALETTE[collections.length % COLLECTION_PALETTE.length] ??
      "#007aff";
    const id = `col-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${collections.length + 1}`;
    setCollections((prev) => [...prev, { id, name: trimmed, color }]);
    notify(`Created collection "${trimmed}"`);
    return null;
  };

  const handleCreateTagFolder = (name: string): string | null => {
    const result = createTagFolder(tagFolders, name);
    if (result.error) return result.error;
    setTagFolders(result.folders);
    notify(`Created folder "${result.created?.name ?? name}"`);
    return null;
  };

  const handleCreateTag = (name: string): string | null => {
    const cleaned = name.trim().replace(/^#+/, "");
    if (!cleaned) return "Tag name cannot be empty.";
    setCustomTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    notify(`Created tag #${cleaned}`);
    return null;
  };

  const handleNestTag = (tagName: string, folderId: string) => {
    const folder = tagFolders.find((f) => f.id === folderId);
    setTagFolders((prev) => nestTagIntoFolder(prev, tagName, folderId));
    if (folder) {
      notify(`Nested #${tagName} in ${folder.name}`);
    }
  };

  const handleUnnestTag = (tagName: string) => {
    setTagFolders((prev) => unnestTag(prev, tagName));
    notify(`Moved #${tagName} out of folder`);
  };

  const handleToggleFolderCollapse = (folderId: string) => {
    setTagFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
      ),
    );
  };

  const handleAddTagToItem = (id: string, tag: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id && !it.tags.includes(tag)
          ? { ...it, tags: [...it.tags, tag] }
          : it,
      ),
    );
  };

  const handleRemoveTagFromItem = (id: string, tag: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, tags: it.tags.filter((t) => t !== tag) } : it,
      ),
    );
  };

  const handleUpdateNote = (id: string, note: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, note } : it)),
    );
  };

  const handleCanvasMoveItems = useCallback(
    (updates: readonly { id: string; x: number; y: number; w?: number }[]) => {
      if (updates.length === 0) return;
      const byId = new Map(updates.map((u) => [u.id, u] as const));
      setItems((prev) =>
        prev.map((it) => {
          const u = byId.get(it.id);
          if (!u) return it;
          return {
            ...it,
            canvasX: u.x,
            canvasY: u.y,
            canvasW: u.w ?? it.canvasW,
          };
        }),
      );
    },
    [],
  );

  const handleCanvasBringToFront = (id: string) => {
    setItems((prev) => {
      const maxZ = prev.reduce((acc, it) => Math.max(acc, it.canvasZ), 1);
      return prev.map((it) =>
        it.id === id ? { ...it, canvasZ: maxZ + 1 } : it,
      );
    });
  };

  const handlePackSelectedPile = () => {
    if (selectedIds.size < 2) return;
    const boxes: CanvasNodeBox[] = filteredItems.map((it) => {
      const aspect = it.height > 0 ? it.width / it.height : 1;
      return {
        id: it.id,
        x: it.canvasX,
        y: it.canvasY,
        width: it.canvasW,
        height: Math.round(it.canvasW / aspect),
      };
    });
    const packed = packCanvasPile(boxes, selectedIds, 12, 148);
    setItems((prev) =>
      prev.map((it) => {
        const p = packed[it.id];
        if (!p) return it;
        return { ...it, canvasX: p.x, canvasY: p.y, canvasW: p.w };
      }),
    );
    notify(m.toastPackedPile);
  };

  const handleTidyCanvas = () => {
    const { rowHeight, gapX } = getTidyDensityParams(
      settings.canvasTidyDensity,
    );
    const mosaicRowHeight = Math.max(122, Math.round(rowHeight * 0.65));
    const mosaicGap = Math.max(10, Math.min(18, Math.round(gapX * 0.55)));
    setItems((prev) => {
      const visibleIds = new Set(filteredItems.map((it) => it.id));
      const placements = packCanvasMosaic(
        filteredItems,
        mosaicGap,
        mosaicRowHeight,
        24,
        14,
        1040,
      );
      return prev.map((it, idx) => {
        if (!visibleIds.has(it.id)) return it;
        const p = placements[it.id];
        if (!p) return it;
        return {
          ...it,
          canvasX: p.x,
          canvasY: p.y,
          canvasW: p.w,
          canvasZ: idx + 1,
        };
      });
    });
    setCanvasResetSignal((v) => v + 1);
    notify(m.toastTidyCanvas);
  };

  const handleImportFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const activeCollectionId = activeNav.startsWith("collection:")
        ? activeNav.slice("collection:".length)
        : null;

      const formatSize = (bytes: number) =>
        bytes >= 1024 * 1024
          ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(bytes / 1024))} KB`;

      const created: LibraryItem[] = await Promise.all(
        files.map(async (file, idx) => {
          const url = URL.createObjectURL(file);
          const kind = detectAssetKindFromFilename(file.name, file.type);
          const baseTitle = file.name.replace(/\.[^.]+$/, "");
          const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
          const id = `imported-${Date.now()}-${idx}`;
          const common = {
            id,
            title: baseTitle,
            filename: file.name,
            src: url,
            collectionId: activeCollectionId,
            liked: false,
            trashed: false,
            note: "Imported locally into Atlas library.",
            addedAt: "Just now",
            canvasX: 80 + idx * 44,
            canvasY: 80 + idx * 36,
            canvasW: 268,
            canvasZ: 40 + idx,
          };

          if (kind === "audio") {
            const audioFmt =
              ext === "WAV" || ext === "FLAC" || ext === "MP3" || ext === "AIFF" || ext === "OGG"
                ? ext
                : "MP3";
            return {
              ...common,
              width: 1200,
              height: 820,
              kind: "audio",
              tags: ["audio", "imported"],
              palette: ["#007aff", "#1d1d1f", "#f5f5f7"],
              audioMeta: {
                artist: "Local Audio",
                bpm: 112,
                sampleRate: "48 kHz · 24-bit",
                format: audioFmt,
                durationSec: 45,
                peaks: generateDeterministicWaveform(Date.now() + idx * 19, 64),
                synthPreset: "ambient-pad",
                audioUrl: url,
              },
            };
          }

          if (kind === "model3d") {
            const modelFmt =
              ext === "GLB" || ext === "GLTF" || ext === "OBJ" || ext === "USDZ"
                ? ext
                : "GLB";
            return {
              ...common,
              width: 1200,
              height: 920,
              kind: "model3d",
              tags: ["3d", "imported"],
              palette: ["#1c1c1e", "#d4d4d8", "#007aff"],
              modelMeta: {
                format: modelFmt,
                preset: "optical-camera",
                vertices: 24600,
                triangles: 48200,
                materialsCount: 4,
                fileSize: formatSize(file.size),
                modelUrl: url,
              },
            };
          }

          if (kind === "font") {
            const fontFmt =
              ext === "OTF" || ext === "WOFF2" || ext === "TTF" || ext === "WOFF"
                ? ext
                : "OTF";
            const loadedFamily = `AtlasLocalFont_${idx}_${Date.now()}`;
            let cssFontFamily = `"Plus Jakarta Sans", -apple-system, sans-serif`;
            try {
              const buf = await file.arrayBuffer();
              const face = new FontFace(loadedFamily, buf);
              await face.load();
              document.fonts.add(face);
              cssFontFamily = `"${loadedFamily}", -apple-system, sans-serif`;
            } catch {
              // Keep graceful fallback font if browser cannot decode local font file
            }
            return {
              ...common,
              width: 1160,
              height: 880,
              kind: "font",
              tags: ["typography", "imported"],
              palette: ["#1c1c1e", "#f7f5f0", "#007aff"],
              fontMeta: {
                family: baseTitle,
                foundry: "Local Font",
                format: fontFmt,
                styleCount: 1,
                weights: [400, 600, 700],
                sampleGlyph: "Aa",
                sampleHeadline: baseTitle,
                sampleBody:
                  "Sphinx of black quartz, judge my vow. 0123456789 — 字体实时排版预览。",
                cssFontFamily,
                specimenTone: "paper",
                fontUrl: url,
              },
            };
          }

          if (kind === "gif") {
            return {
              ...common,
              width: 1200,
              height: 900,
              kind: "gif",
              tags: ["gif", "motion", "imported"],
              palette: ["#007aff", "#ff8a2b", "#141518"],
              gifMeta: {
                fps: 24,
                frames: 48,
                loop: true,
                fileSize: formatSize(file.size),
                animationKind: "fluid-orb",
                gifUrl: url,
              },
            };
          }

          return await new Promise<LibraryItem>((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({
                ...common,
                width: img.naturalWidth || 1200,
                height: img.naturalHeight || 900,
                kind: kind === "video" ? "video" : "image",
                tags: ["imported"],
                palette: ["#1c1c1e", "#e5e5e5", "#007aff"],
              });
            };
            img.onerror = () => {
              resolve({
                ...common,
                width: 1200,
                height: 900,
                kind: kind === "video" ? "video" : "image",
                tags: ["imported"],
                palette: ["#1c1c1e", "#e5e5e5", "#007aff"],
              });
            };
            img.src = url;
          });
        }),
      );

      setItems((prev) => {
        const combined = [...created, ...prev];
        const createdIds = new Set(created.map((c) => c.id));
        const boxes: CanvasNodeBox[] = combined.map((it) => {
          const aspect = it.height > 0 ? it.width / it.height : 1;
          return {
            id: it.id,
            x: it.canvasX,
            y: it.canvasY,
            width: it.canvasW,
            height: Math.round(it.canvasW / aspect),
          };
        });
        const resolved = resolveCanvasPushCollisions(boxes, createdIds, 12, 18);
        return combined.map((it) => {
          const pos = resolved.positions[it.id];
          return pos ? { ...it, canvasX: pos.x, canvasY: pos.y } : it;
        });
      });
      notify(
        settings.locale === "zh-CN"
          ? `已导入 ${created.length} 个资料文件`
          : `Imported ${created.length} file${created.length > 1 ? "s" : ""}`,
      );
    },
    [activeNav, notify, settings.locale],
  );

  const sidebarOffset = sidebarCollapsed ? 0 : 232;
  const exportCount = selectedIds.size > 0 ? selectedIds.size : filteredItems.length;
  const veilRgba =
    appearance.theme === "dark"
      ? `rgba(25, 25, 27, ${settings.veilOpacity})`
      : `rgba(255, 255, 255, ${settings.veilOpacity})`;

  return (
    <div
      className={`atlas-shell ${isLightboxOpen ? "atlas-shell--lightbox-open" : ""}`}
      data-atlas-theme={appearance.theme}
      data-atlas-locale={settings.locale}
      style={{
        ["--sidebar-offset" as string]: `${sidebarOffset}px`,
        ["--bg-lightbox-veil" as string]: veilRgba,
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDraggingFiles(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setIsDraggingFiles(false);
          void handleImportFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.gif,.glb,.gltf,.obj,.ttf,.otf,.woff,.woff2"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) {
            void handleImportFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Floating Frosted macOS Sidebar */}
      <AtlasSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        items={items}
        collections={collections}
        tagFolders={tagFolders}
        customTags={customTags}
        activeNav={activeNav}
        locale={settings.locale}
        libraryName={displayLibraryName}
        showItemCounts={settings.showItemCounts}
        onSelectNav={(nav) => {
          setActiveNav(nav);
          setSelectedIds(new Set());
        }}
        onChangeLocale={handleChangeLocale}
        onOpenStorage={() => {
          setCustomizeOpen(false);
          setSettingsInitialCategory("storage");
          setSettingsOpen(true);
        }}
        onOpenSettings={() => {
          setCustomizeOpen(false);
          setSettingsInitialCategory("general");
          setSettingsOpen(true);
        }}
        onExportLibrary={handleExportSelection}
        onCreateCollection={handleCreateCollection}
        onCreateTagFolder={handleCreateTagFolder}
        onCreateTag={handleCreateTag}
        onNestTag={handleNestTag}
        onUnnestTag={handleUnnestTag}
        onToggleFolderCollapse={handleToggleFolderCollapse}
        onDropItemToCollection={handleMoveToCollection}
        onImportClick={() => fileInputRef.current?.click()}
        activeCardDropKey={activeSidebarDropKey}
        pulseTargetKey={sidebarPulseKey}
      />

      {/* Full-Bleed Main Workspace */}
      <main className="atlas-workspace">
        <div
          className={`atlas-topbar-mask ${viewMode === "infinity" ? "atlas-topbar-mask--overlay" : ""}`}
          aria-hidden="true"
        />

        {/* Floating Translucent Top Bar (Videos 1 & 4 airy chrome) */}
        <header
          className={`atlas-topbar ${viewMode === "infinity" ? "atlas-topbar--overlay" : ""}`}
        >
          <div className="topbar-left">
            {sidebarCollapsed && (
              <button
                type="button"
                className="topbar-icon-btn"
                onClick={() => setSidebarCollapsed(false)}
                title={m.tooltipToggleSidebar}
                aria-label={m.tooltipToggleSidebar}
              >
                <SidebarToggleIcon size={15} />
              </button>
            )}
            <div className="topbar-title-group">
              <h1 className="topbar-title" data-testid="active-view-title">
                {activeHeading}
              </h1>
              {settings.showItemCounts && (
                <span className="topbar-subtitle">
                  {m.itemCount(filteredItems.length)}
                </span>
              )}
            </div>
          </div>

          {/* Center Floating Segmented Pill: Grid | Canvas | Infinity */}
          <div className="topbar-center">
            <div
              className="view-segmented"
              role="tablist"
              aria-label="View mode"
            >
              {(["grid", "canvas", "infinity"] as const).map((mode) => {
                const active = viewMode === mode;
                const label =
                  mode === "grid"
                    ? m.viewGrid
                    : mode === "canvas"
                      ? m.viewCanvas
                      : m.viewInfinity;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`view-tab-${mode}`}
                    className={`view-seg-btn ${active ? "view-seg-btn--active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {active && (
                      <motion.span
                        layoutId="atlas-view-pill"
                        className="view-seg-thumb"
                        transition={{
                          type: "spring",
                          stiffness: 480,
                          damping: 36,
                        }}
                      />
                    )}
                    <span className="view-seg-label">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top-Right Airy macOS Tools (Video 1 & Video 4) */}
          <div className="topbar-right">
            <label className="search-capsule" aria-label={m.searchPlaceholder}>
              <SearchIcon size={14} />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder={m.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>

            <button
              type="button"
              className={`topbar-icon-btn ${likedOnly ? "topbar-icon-btn--liked" : ""}`}
              onClick={() => setLikedOnly((v) => !v)}
              title={m.tooltipFilterLikes}
              aria-label={m.tooltipFilterLikes}
            >
              <HeartIcon size={15} filled={likedOnly} />
            </button>

            <button
              type="button"
              className="topbar-icon-btn"
              data-testid="theme-toggle-btn"
              onClick={() =>
                setAppearance((prev) => ({
                  ...prev,
                  theme: prev.theme === "dark" ? "light" : "dark",
                }))
              }
              title={
                appearance.theme === "dark"
                  ? m.tooltipSwitchLight
                  : m.tooltipSwitchDark
              }
              aria-label={
                appearance.theme === "dark"
                  ? m.tooltipSwitchLight
                  : m.tooltipSwitchDark
              }
            >
              <SunMoonIcon dark={appearance.theme === "dark"} size={15} />
            </button>

            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title={m.tooltipImportImages}
              aria-label={m.tooltipImportImages}
            >
              <UploadIcon size={15} />
            </button>
          </div>
        </header>

        {/* Active View Stage with Smooth Cross-View Spring Bloom (Video 00:10 -> 00:11) */}
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === "grid" && (
            <motion.div
              key="view-grid"
              className="view-stage-wrapper"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <GridGalleryView
                items={filteredItems}
                collections={collections}
                theme={appearance.theme}
                zoom={appearance.zoom}
                spacing={appearance.spacing}
                radius={appearance.radius}
                layoutMode={appearance.gridLayout}
                selectedIds={selectedIds}
                lastFocusedId={lastFocused?.id ?? null}
                activeHeroKey={activeHeroKey}
                heroPush={heroPushContext}
                inTrash={activeNav === "trash"}
                locale={settings.locale}
                showCardBadges={settings.showCardBadges}
                speedMultiplier={speedMultiplier}
                onZoomChange={(z) =>
                  setAppearance((prev) => ({ ...prev, zoom: clampZoom(z) }))
                }
                onCommitOrder={handleCommitOrder}
                onOpenQuickLook={openQuickLook}
                onToggleSelect={handleToggleSelect}
                onSetSelectedIds={handleSetSelectedIds}
                onClearSelection={handleClearSelection}
                onToggleLike={handleToggleLike}
                onMoveToCollection={handleMoveToCollection}
                onTrashOrRestore={handleTrashOrRestore}
                onHoverSidebarTarget={setActiveSidebarDropKey}
                onDropToSidebar={handleDropToSidebar}
                onRegisterRevealHandler={handleRegisterRevealHandler}
              />
            </motion.div>
          )}

          {viewMode === "canvas" && (
            <motion.div
              key="view-canvas"
              className="view-stage-wrapper"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <CanvasBoardView
                items={filteredItems}
                collections={collections}
                theme={appearance.theme}
                zoom={appearance.zoom}
                radius={appearance.radius}
                selectedIds={selectedIds}
                lastFocusedId={lastFocused?.id ?? null}
                activeHeroKey={activeHeroKey}
                heroPush={heroPushContext}
                sidebarOffset={sidebarOffset}
                resetSignal={canvasResetSignal}
                locale={settings.locale}
                showCardBadges={settings.showCardBadges}
                speedMultiplier={speedMultiplier}
                inertiaEnabled={settings.canvasInertia}
                wheelZoomMode={settings.wheelZoomMode}
                onZoomChange={(z) =>
                  setAppearance((prev) => ({ ...prev, zoom: clampZoom(z) }))
                }
                onMoveItems={handleCanvasMoveItems}
                onBringToFront={handleCanvasBringToFront}
                onSelectItem={handleToggleSelect}
                onSetSelectedIds={handleSetSelectedIds}
                onToggleLike={handleToggleLike}
                onClearSelection={handleClearSelection}
                onOpenQuickLook={openQuickLook}
                onHoverSidebarTarget={setActiveSidebarDropKey}
                onDropToSidebar={handleDropToSidebar}
                onImportClick={() => fileInputRef.current?.click()}
                onTidyCanvas={handleTidyCanvas}
                onRegisterRevealHandler={handleRegisterRevealHandler}
              />
            </motion.div>
          )}

          {viewMode === "infinity" && (
            <motion.div
              key="view-infinity"
              className="view-stage-wrapper"
              initial={{ opacity: 0, scale: 0.975 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <InfinityDriftView
                items={filteredItems}
                theme={appearance.theme}
                zoom={appearance.zoom}
                spacing={appearance.spacing}
                radius={appearance.radius}
                activeHeroKey={activeHeroKey}
                lastFocusedKey={lastFocused?.key ?? null}
                heroPush={heroPushContext}
                recenterSignal={infinityRecenterSignal}
                locale={settings.locale}
                showCardBadges={settings.showCardBadges}
                speedMultiplier={speedMultiplier}
                inertiaEnabled={settings.canvasInertia}
                wheelZoomMode={settings.wheelZoomMode}
                onZoomChange={(z) =>
                  setAppearance((prev) => ({ ...prev, zoom: clampZoom(z) }))
                }
                onOpenQuickLook={openQuickLook}
                onRegisterRevealHandler={handleRegisterRevealHandler}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Floating Frosted Control Dock (Videos 1 & 3) */}
        <div
          className={`bottom-dock ${
            viewMode === "canvas" ? "bottom-dock--canvas" : ""
          }`}
        >
          <div
            className={
              viewMode === "canvas" && selectedIds.size > 0
                ? "bottom-dock-canvas-batch"
                : undefined
            }
          >
            {selectedIds.size > 0 ? (
              <div className="dock-pill" data-testid="batch-selection-dock">
                <span style={{ padding: "0 6px", fontWeight: 500, color: "var(--ink-1)" }}>
                  {m.selectedCount(selectedIds.size)}
                </span>
                <span className="dock-sep" />
                {viewMode === "canvas" && selectedIds.size >= 2 && (
                  <button
                    type="button"
                    className="dock-btn dock-btn--active"
                    data-testid="canvas-pack-pile-btn"
                    onClick={handlePackSelectedPile}
                  >
                    <AllGridIcon size={13} />
                    <span>{m.dockPackPile}</span>
                  </button>
                )}
                <button type="button" className="dock-btn" onClick={handleBatchLike}>
                  <HeartIcon size={13} />
                  <span>{m.dockLike}</span>
                </button>
                <button
                  type="button"
                  className="dock-btn dock-btn--danger"
                  onClick={handleBatchTrash}
                >
                  <TrashIcon size={13} />
                  <span>{activeNav === "trash" ? m.dockRestore : m.dockTrash}</span>
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  onClick={() => setSelectedIds(new Set())}
                >
                  {m.dockClear}
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="dock-pill" data-testid="grid-shuffle-dock">
                <button
                  type="button"
                  className={`dock-btn ${shuffleSeed > 0 ? "dock-btn--active" : ""}`}
                  data-testid="shuffle-btn"
                  onClick={() => {
                    setShuffleSeed((s) => s + 1);
                    notify(m.toastShuffled);
                  }}
                  title={m.scShuffleGrid}
                  aria-label={m.scShuffleGrid}
                >
                  <ShuffleIcon size={14} />
                </button>
                {shuffleSeed > 0 && (
                  <>
                    <span className="dock-sep" />
                    <button
                      type="button"
                      className="dock-btn"
                      onClick={() => setShuffleSeed(0)}
                    >
                      {m.dockReset}
                    </button>
                  </>
                )}
              </div>
            ) : viewMode === "canvas" ? null : (
              <div className="dock-pill">
                <button
                  type="button"
                  className="dock-btn"
                  onClick={() => setInfinityRecenterSignal((v) => v + 1)}
                >
                  {m.dockRecenter}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dock-pill" data-testid="bottom-right-dock">
              <div className="dock-slider-wrap">
                <SearchIcon size={13} />
                <ElasticMotionBar
                  min={0.65}
                  max={2.4}
                  step={0.05}
                  value={appearance.zoom}
                  size="sm"
                  width={108}
                  ariaLabel={m.setZoomTitle}
                  testId="zoom-slider"
                  onChange={(nextZoom) =>
                    setAppearance((prev) => ({
                      ...prev,
                      zoom: clampZoom(nextZoom),
                    }))
                  }
                />
                <span className="dock-zoom-val">×{appearance.zoom.toFixed(1)}</span>
              </div>

              {viewMode === "grid" && (
                <>
                  <span className="dock-sep" />
                  {(
                    [
                      ["justified", JustifiedIcon, m.dockLayoutJustified],
                      ["square", SquareGridIcon, m.dockLayoutSquare],
                      ["fit", FitAspectIcon, m.dockLayoutFit],
                    ] as const
                  ).map(([mode, IconComp, title]) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`layout-mode-${mode}`}
                      className={`dock-btn ${
                        appearance.gridLayout === mode ? "dock-btn--active" : ""
                      }`}
                      title={title}
                      aria-label={title}
                      onClick={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          gridLayout: mode as GridLayoutMode,
                        }))
                      }
                    >
                      <IconComp size={14} />
                    </button>
                  ))}
                </>
              )}

              <span className="dock-sep" />
              <button
                type="button"
                data-testid="customize-btn"
                className={`dock-btn ${customizeOpen ? "dock-btn--active" : ""}`}
                title={m.dockCustomize}
                aria-label={m.dockCustomize}
                onClick={() => setCustomizeOpen((v) => !v)}
              >
                <SlidersIcon size={14} />
              </button>
            </div>

            {exportCount > 0 && (
              <button
                type="button"
                className="dock-export-btn"
                data-testid="dock-export-btn"
                onClick={handleExportSelection}
              >
                <ExportIcon size={13} />
                <span>
                  {m.dockExportFiles(
                    selectedIds.size > 0 ? selectedIds.size : exportCount,
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Frosted Customize Appearance Popover */}
        <AnimatePresence>
          {customizeOpen && (
            <motion.div
              className="customize-popover"
              data-testid="customize-popover"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="customize-row">
                <div className="customize-label">
                  <span>{m.customizeAppearance}</span>
                </div>
                <div className="customize-theme-seg">
                  <button
                    type="button"
                    className={`customize-theme-btn ${
                      appearance.theme === "light" ? "customize-theme-btn--active" : ""
                    }`}
                    onClick={() =>
                      setAppearance((prev) => ({ ...prev, theme: "light" }))
                    }
                  >
                    {m.customizeLight}
                  </button>
                  <button
                    type="button"
                    className={`customize-theme-btn ${
                      appearance.theme === "dark" ? "customize-theme-btn--active" : ""
                    }`}
                    onClick={() =>
                      setAppearance((prev) => ({ ...prev, theme: "dark" }))
                    }
                  >
                    {m.customizeDark}
                  </button>
                </div>
              </div>

              <div className="customize-row">
                <div className="customize-label">
                  <span>{m.customizeSpacing}</span>
                  <span>{appearance.spacing}px</span>
                </div>
                <ElasticMotionBar
                  min={4}
                  max={28}
                  step={2}
                  value={appearance.spacing}
                  size="md"
                  width="100%"
                  ariaLabel={m.customizeSpacing}
                  testId="customize-spacing-slider"
                  onChange={(nextSpacing) =>
                    setAppearance((prev) => ({
                      ...prev,
                      spacing: clampSpacing(nextSpacing),
                    }))
                  }
                />
              </div>

              <div className="customize-row">
                <div className="customize-label">
                  <span>{m.customizeCornerRadius}</span>
                  <span>{appearance.radius}px</span>
                </div>
                <ElasticMotionBar
                  min={0}
                  max={20}
                  step={2}
                  value={appearance.radius}
                  size="md"
                  width="100%"
                  ariaLabel={m.customizeCornerRadius}
                  testId="customize-radius-slider"
                  onChange={(nextRadius) =>
                    setAppearance((prev) => ({
                      ...prev,
                      radius: clampRadius(nextRadius),
                    }))
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Native macOS System Settings Floating Window */}
      <SettingsModal
        open={settingsOpen}
        initialCategory={settingsInitialCategory}
        settings={settings}
        appearance={appearance}
        items={items}
        onClose={() => setSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onUpdateAppearance={(patch) =>
          setAppearance((prev) => ({ ...prev, ...patch }))
        }
        onResetDefaults={handleResetAllDefaults}
        onEmptyTrash={handleEmptyTrashItems}
        onNotify={notify}
      />

      {/* Full-Window Shared-Element Hero Morph QuickLook Lightbox */}
      <QuickLookLightbox
        item={quickLookItem}
        originRect={quickLookState?.originRect ?? null}
        returnRect={quickLookState?.returnRect ?? null}
        cardRadius={appearance.radius}
        phase={quickLookPhase}
        theme={appearance.theme}
        locale={settings.locale}
        speedMultiplier={speedMultiplier}
        autoOpenInspector={settings.autoOpenInspector}
        items={filteredItems}
        collections={collections}
        onRequestClose={requestCloseQuickLook}
        onCloseComplete={beginLandingQuickLook}
        onNavigate={(id) =>
          setQuickLookState((prev) => {
            if (!prev) return null;
            const navKey = `${viewMode}:${id}`;
            const navResting = resolveLiveRestingCardRect(id, navKey);
            return {
              ...prev,
              id,
              returnRect: navResting ?? prev.returnRect,
            };
          })
        }
        onToggleLike={handleToggleLike}
        onUpdateCollection={handleMoveToCollection}
        onAddTagToItem={handleAddTagToItem}
        onRemoveTagFromItem={handleRemoveTagFromItem}
        onUpdateNote={handleUpdateNote}
        onTrashOrRestore={handleTrashOrRestore}
        onPinToPip={(targetItem) => {
          atomicMediaPlayerManager.pinToPip(targetItem);
          requestCloseQuickLook();
        }}
        onUpdateVideoEdit={handleUpdateVideoEdit}
        onNotify={notify}
      />

      {/* Seamless Atomic moveBefore() Floating Picture-in-Picture Mini-Player */}
      <FloatingPipPlayer
        items={items}
        locale={settings.locale}
        onExpandQuickLook={(id) => {
          openQuickLook(id);
        }}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="atlas-toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Drop Overlay */}
      {isDraggingFiles && (
        <div className="drop-overlay">{m.dropOverlayText}</div>
      )}
    </div>
  );
}
