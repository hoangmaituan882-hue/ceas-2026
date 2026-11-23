import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AllGridIcon,
  AtlasStarIcon,
  AudioWaveIcon,
  CheckIcon,
  ChevronIcon,
  ChevronUpDownIcon,
  Cube3DIcon,
  ExportIcon,
  FolderIcon,
  FontTypeIcon,
  GifMotionIcon,
  GlobeIcon,
  HardDriveIcon,
  HashTagIcon,
  HeartIcon,
  InboxIcon,
  LinkIcon,
  PlusIcon,
  SettingsGearIcon,
  SidebarToggleIcon,
  TrashIcon,
  UploadIcon,
} from "./AppIcons";
import { getMessages, type AppLocale } from "./i18n";
import {
  collectAllTags,
  getSmartCounts,
  getTagFolderItemCount,
  getTagItemCount,
  type CollectionItem,
  type LibraryItem,
  type TagFolder,
} from "./library-engine";

export interface AtlasSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  items: readonly LibraryItem[];
  collections: readonly CollectionItem[];
  tagFolders: readonly TagFolder[];
  customTags: readonly string[];
  activeNav: string;
  locale: AppLocale;
  libraryName: string;
  showItemCounts: boolean;
  onSelectNav: (nav: string) => void;
  onChangeLocale: (locale: AppLocale) => void;
  onOpenStorage: () => void;
  onOpenSettings: () => void;
  onExportLibrary: () => void;
  onCreateCollection: (name: string) => string | null;
  onCreateTagFolder: (name: string) => string | null;
  onCreateTag: (name: string) => string | null;
  onNestTag: (tagName: string, folderId: string) => void;
  onUnnestTag: (tagName: string) => void;
  onToggleFolderCollapse: (folderId: string) => void;
  onDropItemToCollection: (itemId: string, collectionId: string | null) => void;
  onImportClick: () => void;
  activeCardDropKey?: string | null;
  pulseTargetKey?: string | null;
}

type SheetKind = "folder" | "tag" | "collection";
type TagSortMode = "name" | "count";

interface ContextMenuState {
  x: number;
  y: number;
  kind: "tags-section" | "collections-section" | "tag-item" | "sidebar-plus";
  tagName?: string;
}

interface PointerTagDrag {
  tag: string;
  isNested: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

const SPRING_LAYOUT = {
  type: "spring" as const,
  stiffness: 440,
  damping: 35,
  mass: 0.72,
};

const SPRING_ACTIVE_PILL = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
};

function ActiveRowHighlight({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      layoutId="atlas-sidebar-active-pill"
      className="nav-row-active-bg"
      transition={SPRING_ACTIVE_PILL}
      aria-hidden="true"
    />
  );
}

export function AtlasSidebar({
  collapsed,
  onToggleCollapse,
  items,
  collections,
  tagFolders,
  customTags,
  activeNav,
  locale,
  libraryName,
  showItemCounts,
  onSelectNav,
  onChangeLocale,
  onOpenStorage,
  onOpenSettings,
  onExportLibrary,
  onCreateCollection,
  onCreateTagFolder,
  onCreateTag,
  onNestTag,
  onUnnestTag,
  onToggleFolderCollapse,
  onDropItemToCollection,
  onImportClick,
  activeCardDropKey = null,
  pulseTargetKey = null,
}: AtlasSidebarProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [collectionsHidden, setCollectionsHidden] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [tagsHidden, setTagsHidden] = useState(false);
  const [tagSort, setTagSort] = useState<TagSortMode>("name");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sortSubmenuOpen, setSortSubmenuOpen] = useState(false);
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [sheetInput, setSheetInput] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Drag states (pointer-driven for tags, HTML5 for grid media -> collections)
  const [tagDrag, setTagDrag] = useState<PointerTagDrag | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRootTags, setDragOverRootTags] = useState(false);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Smooth edge feathering for scrollbar-free vertical scroll
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });
  const scrollRef = useRef<HTMLElement | null>(null);
  const sheetInputRef = useRef<HTMLInputElement | null>(null);
  const libraryFooterRef = useRef<HTMLDivElement | null>(null);
  const suppressNextTagClickRef = useRef(false);
  const tagDragRef = useRef<PointerTagDrag | null>(null);

  const counts = useMemo(() => getSmartCounts(items), [items]);

  // Dismiss library popover on outside click or Escape
  useEffect(() => {
    if (!libraryMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        libraryFooterRef.current &&
        !libraryFooterRef.current.contains(e.target as Node)
      ) {
        setLibraryMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLibraryMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [libraryMenuOpen]);

  const allTags = useMemo(() => {
    const merged = new Set<string>([...collectAllTags(items), ...customTags]);
    const list = [...merged];
    if (tagSort === "count") {
      return list.sort((a, b) => {
        const diff = getTagItemCount(items, b) - getTagItemCount(items, a);
        return diff !== 0 ? diff : a.localeCompare(b);
      });
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [items, customTags, tagSort]);

  const nestedTagSet = useMemo(() => {
    const set = new Set<string>();
    for (const folder of tagFolders) {
      for (const t of folder.tags) set.add(t);
    }
    return set;
  }, [tagFolders]);

  const topLevelTags = useMemo(
    () => allTags.filter((tag) => !nestedTagSet.has(tag)),
    [allTags, nestedTagSet],
  );

  const updateScrollFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollFade((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    );
  }, []);

  useEffect(() => {
    updateScrollFade();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    updateScrollFade,
    mediaOpen,
    collectionsOpen,
    collectionsHidden,
    tagsOpen,
    tagsHidden,
    tagFolders,
    topLevelTags.length,
  ]);

  useEffect(() => {
    if (!contextMenu) {
      setSortSubmenuOpen(false);
      return;
    }
    const handlePointer = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!sheet) return;
    const id = window.setTimeout(() => {
      sheetInputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(id);
  }, [sheet]);

  // Global window pointer listeners for smooth custom macOS tag drag-and-drop (Video 00:07–00:14)
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      const current = tagDragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const dist = Math.hypot(e.clientX - current.startX, e.clientY - current.startY);
      if (!current.active && dist < 4) return;

      const next: PointerTagDrag = {
        ...current,
        x: e.clientX,
        y: e.clientY,
        active: true,
      };
      tagDragRef.current = next;
      setTagDrag(next);

      // Hit-test folder groups (header + nested children area) & root tags drop zone
      const hits = document.elementsFromPoint(e.clientX, e.clientY);
      let foundFolderId: string | null = null;
      let foundRootZone = false;

      for (const hit of hits) {
        if (!(hit instanceof HTMLElement)) continue;
        const folderId = hit.dataset.dropFolderId;
        if (folderId) {
          foundFolderId = folderId;
          break;
        }
        if (hit.dataset.dropRootTags === "true") {
          foundRootZone = true;
        }
      }

      setDragOverFolderId(foundFolderId);
      setDragOverRootTags(!foundFolderId && current.isNested && foundRootZone);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const current = tagDragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      tagDragRef.current = null;
      setTagDrag(null);

      if (current.active) {
        suppressNextTagClickRef.current = true;
        window.setTimeout(() => {
          suppressNextTagClickRef.current = false;
        }, 120);

        const hits = document.elementsFromPoint(e.clientX, e.clientY);
        let targetFolderId: string | null = null;
        let hitRootZone = false;

        for (const hit of hits) {
          if (!(hit instanceof HTMLElement)) continue;
          const folderId = hit.dataset.dropFolderId;
          if (folderId) {
            targetFolderId = folderId;
            break;
          }
          if (hit.dataset.dropRootTags === "true") {
            hitRootZone = true;
          }
        }

        if (targetFolderId) {
          onNestTag(current.tag, targetFolderId);
        } else if (current.isNested && hitRootZone) {
          onUnnestTag(current.tag);
        }
      }

      setDragOverFolderId(null);
      setDragOverRootTags(false);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [onNestTag, onUnnestTag]);

  const startTagPointerDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    tag: string,
    isNested: boolean,
  ) => {
    if (e.button !== 0) return;
    tagDragRef.current = {
      tag,
      isNested,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
  };

  const openSheet = (kind: SheetKind) => {
    setContextMenu(null);
    setSheet(kind);
    setSheetInput("");
    setSheetError(null);
  };

  const handleSheetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheet) return;
    let err: string | null = null;
    if (sheet === "folder") {
      err = onCreateTagFolder(sheetInput);
      if (!err) {
        setTagsHidden(false);
        setTagsOpen(true);
      }
    } else if (sheet === "tag") {
      err = onCreateTag(sheetInput);
      if (!err) {
        setTagsHidden(false);
        setTagsOpen(true);
      }
    } else if (sheet === "collection") {
      err = onCreateCollection(sheetInput);
      if (!err) {
        setCollectionsHidden(false);
        setCollectionsOpen(true);
      }
    }
    if (err) {
      setSheetError(err);
    } else {
      setSheet(null);
      setSheetInput("");
      setSheetError(null);
    }
  };

  const openMenuAt = (
    x: number,
    y: number,
    kind: ContextMenuState["kind"],
    tagName?: string,
  ) => {
    const clampedX = Math.min(x, window.innerWidth - 208);
    const clampedY = Math.min(y, window.innerHeight - 230);
    setSortSubmenuOpen(false);
    setContextMenu({
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      kind,
      tagName,
    });
  };

  const collectionCount = (colId: string) =>
    items.filter((it) => !it.trashed && it.collectionId === colId).length;

  const extractDraggedItemId = (dt: DataTransfer): string => {
    const custom = dt.getData("application/x-atlas-item-id");
    if (custom) return custom;
    const plain = dt.getData("text/plain");
    if (plain.startsWith("atlas-item:")) return plain.slice("atlas-item:".length);
    return "";
  };

  return (
    <>
      <aside
        className={`atlas-sidebar ${collapsed ? "atlas-sidebar--collapsed" : ""} ${
          tagDrag?.active ? "atlas-sidebar--dragging-tag" : ""
        }`}
        aria-label="Library sidebar"
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="mac-dots" aria-hidden="true">
              <span className="mac-dot mac-dot--r" />
              <span className="mac-dot mac-dot--y" />
              <span className="mac-dot mac-dot--g" />
            </div>
            <button
              type="button"
              className="sidebar-icon-btn"
              onClick={onToggleCollapse}
              title={m.tooltipToggleSidebar}
              aria-label={m.tooltipToggleSidebar}
            >
              <SidebarToggleIcon size={15} />
            </button>
          </div>

          <button
            type="button"
            className="sidebar-icon-btn"
            data-testid="sidebar-top-plus-btn"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              openMenuAt(rect.left - 134, rect.bottom + 6, "sidebar-plus");
            }}
            title={m.menuNewFolder}
            aria-label={m.menuNewFolder}
          >
            <PlusIcon size={14} />
          </button>
        </div>

        <div className="sidebar-scroll-shell">
          <div
            className={`sidebar-scroll-fade sidebar-scroll-fade--top ${
              scrollFade.top ? "sidebar-scroll-fade--visible" : ""
            }`}
            aria-hidden="true"
          />

          <nav
            ref={scrollRef}
            className="sidebar-scroll"
            aria-label="Library sections"
            onScroll={updateScrollFade}
          >
            <LayoutGroup id="atlas-sidebar-nav">
              {/* Smart Views */}
              <div className="sidebar-smart-list">
                <button
                  type="button"
                  className={`nav-row ${activeNav === "all" ? "nav-row--active" : ""}`}
                  onClick={() => onSelectNav("all")}
                >
                  <ActiveRowHighlight active={activeNav === "all"} />
                  <span className="nav-row-icon">
                    <AllGridIcon />
                  </span>
                  <span className="nav-row-label">{m.navAll}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.all}</span>}
                </button>

                <button
                  type="button"
                  data-drop-sidebar-target="inbox"
                  data-testid="sidebar-drop-inbox"
                  className={`nav-row ${activeNav === "inbox" ? "nav-row--active" : ""} ${
                    dragOverColId === "__inbox__" || activeCardDropKey === "inbox"
                      ? "nav-row--drop-target"
                      : ""
                  } ${pulseTargetKey === "inbox" ? "nav-row--drop-pulse" : ""}`}
                  onClick={() => onSelectNav("inbox")}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/x-atlas-item-id")) {
                      e.preventDefault();
                      setDragOverColId("__inbox__");
                    }
                  }}
                  onDragLeave={() => setDragOverColId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColId(null);
                    const itemId = extractDraggedItemId(e.dataTransfer);
                    if (itemId) onDropItemToCollection(itemId, null);
                  }}
                >
                  <ActiveRowHighlight active={activeNav === "inbox"} />
                  <span className="nav-row-icon">
                    <InboxIcon />
                  </span>
                  <span className="nav-row-label">{m.navInbox}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.inbox}</span>}
                </button>

                <button
                  type="button"
                  data-drop-sidebar-target="likes"
                  data-testid="sidebar-drop-likes"
                  className={`nav-row ${activeNav === "likes" ? "nav-row--active" : ""} ${
                    activeCardDropKey === "likes" ? "nav-row--drop-target" : ""
                  } ${pulseTargetKey === "likes" ? "nav-row--drop-pulse" : ""}`}
                  onClick={() => onSelectNav("likes")}
                >
                  <ActiveRowHighlight active={activeNav === "likes"} />
                  <span className="nav-row-icon">
                    <HeartIcon />
                  </span>
                  <span className="nav-row-label">{m.navLikes}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.likes}</span>}
                </button>

                <button
                  type="button"
                  className={`nav-row ${activeNav === "links" ? "nav-row--active" : ""}`}
                  onClick={() => onSelectNav("links")}
                >
                  <ActiveRowHighlight active={activeNav === "links"} />
                  <span className="nav-row-icon">
                    <LinkIcon />
                  </span>
                  <span className="nav-row-label">{m.navLinks}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.links}</span>}
                </button>

                <button
                  type="button"
                  className={`nav-row ${activeNav === "untagged" ? "nav-row--active" : ""}`}
                  onClick={() => onSelectNav("untagged")}
                >
                  <ActiveRowHighlight active={activeNav === "untagged"} />
                  <span className="nav-row-icon">
                    <FolderIcon />
                  </span>
                  <span className="nav-row-label">{m.navUntagged}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.untagged}</span>}
                </button>

                <button
                  type="button"
                  data-drop-sidebar-target="trash"
                  data-testid="sidebar-drop-trash"
                  className={`nav-row ${activeNav === "trash" ? "nav-row--active" : ""} ${
                    activeCardDropKey === "trash"
                      ? "nav-row--drop-target nav-row--drop-target-danger"
                      : ""
                  } ${pulseTargetKey === "trash" ? "nav-row--drop-pulse" : ""}`}
                  onClick={() => onSelectNav("trash")}
                >
                  <ActiveRowHighlight active={activeNav === "trash"} />
                  <span className="nav-row-icon">
                    <TrashIcon />
                  </span>
                  <span className="nav-row-label">{m.navTrash}</span>
                  {showItemCounts && <span className="nav-row-count">{counts.trash}</span>}
                </button>
              </div>

              {/* MEDIA TYPES (3D Models, Audio, Fonts, GIFs) */}
              <div className="sidebar-section">
                <div className="sidebar-section-head">
                  <button
                    type="button"
                    className="sidebar-section-title"
                    onClick={() => setMediaOpen((v) => !v)}
                    aria-expanded={mediaOpen}
                  >
                    <span>{m.sectionMedia}</span>
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {mediaOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      {(
                        [
                          ["media:model3d", m.navModels3d, counts.model3d, Cube3DIcon, "nav-media-model3d"],
                          ["media:audio", m.navAudio, counts.audio, AudioWaveIcon, "nav-media-audio"],
                          ["media:font", m.navFonts, counts.font, FontTypeIcon, "nav-media-font"],
                          ["media:gif", m.navGifs, counts.gif, GifMotionIcon, "nav-media-gif"],
                        ] as const
                      ).map(([navKey, label, count, IconComp, testId]) => (
                        <button
                          key={navKey}
                          type="button"
                          data-testid={testId}
                          className={`nav-row ${activeNav === navKey ? "nav-row--active" : ""}`}
                          onClick={() => onSelectNav(navKey)}
                        >
                          <ActiveRowHighlight active={activeNav === navKey} />
                          <span className="nav-row-icon">
                            <IconComp />
                          </span>
                          <span className="nav-row-label">{label}</span>
                          {showItemCounts && <span className="nav-row-count">{count}</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* COLLECTIONS */}
              {!collectionsHidden && (
                <div className="sidebar-section">
                  <div
                    className="sidebar-section-head"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openMenuAt(e.clientX, e.clientY, "collections-section");
                    }}
                  >
                    <button
                      type="button"
                      className="sidebar-section-title"
                      onClick={() => setCollectionsOpen((v) => !v)}
                      aria-expanded={collectionsOpen}
                    >
                      <span>{m.sectionCollections}</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-section-add"
                      onClick={() => openSheet("collection")}
                      title={m.menuNewCollection}
                      aria-label={m.menuNewCollection}
                    >
                      <PlusIcon size={12} />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {collectionsOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        {collections.map((col) => {
                          const navKey = `collection:${col.id}`;
                          const count = collectionCount(col.id);
                          const isDropTarget =
                            dragOverColId === col.id || activeCardDropKey === navKey;
                          const isPulsing = pulseTargetKey === navKey;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              data-drop-sidebar-target={navKey}
                              data-testid={`sidebar-collection-${col.id}`}
                              className={`nav-row ${activeNav === navKey ? "nav-row--active" : ""} ${
                                isDropTarget ? "nav-row--drop-target" : ""
                              } ${isPulsing ? "nav-row--drop-pulse" : ""}`}
                              onClick={() => onSelectNav(navKey)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverColId(col.id);
                              }}
                              onDragLeave={() => setDragOverColId(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverColId(null);
                                const itemId = extractDraggedItemId(e.dataTransfer);
                                if (itemId) onDropItemToCollection(itemId, col.id);
                              }}
                            >
                              <ActiveRowHighlight active={activeNav === navKey} />
                              <span
                                className="sidebar-col-dot"
                                style={{ background: col.color }}
                                aria-hidden="true"
                              />
                              <span className="nav-row-label">{col.name}</span>
                              {showItemCounts && (
                                <span
                                  className="nav-row-count"
                                  data-testid={`sidebar-collection-count-${col.id}`}
                                >
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* TAGS (1:1 Video 00:00–00:14 folder creation & pointer drag-and-drop tag nesting!) */}
              {!tagsHidden && (
                <div className="sidebar-section" data-drop-root-tags="true">
                  <div
                    className={`sidebar-section-head ${
                      dragOverRootTags ? "sidebar-section-head--drop-target" : ""
                    }`}
                    data-testid="tags-section-header"
                    data-drop-root-tags="true"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openMenuAt(e.clientX, e.clientY, "tags-section");
                    }}
                  >
                    <button
                      type="button"
                      className="sidebar-section-title"
                      onClick={() => setTagsOpen((v) => !v)}
                      aria-expanded={tagsOpen}
                    >
                      <span>{m.sectionTags}</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-section-add"
                      data-testid="tags-add-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMenuAt(rect.left - 8, rect.bottom + 6, "tags-section");
                      }}
                      title={m.menuNewFolder}
                      aria-label={m.sectionTags}
                    >
                      <PlusIcon size={12} />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {tagsOpen && (
                      <motion.div
                        data-testid="tags-section-list"
                        data-drop-root-tags="true"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                        onContextMenu={(e) => {
                          if (e.target === e.currentTarget) {
                            e.preventDefault();
                            openMenuAt(e.clientX, e.clientY, "tags-section");
                          }
                        }}
                      >
                        {/* Tag Folders */}
                        {tagFolders.map((folder) => {
                          const navKey = `tag-folder:${folder.id}`;
                          const folderCount = getTagFolderItemCount(items, folder);
                          const isDropTarget = dragOverFolderId === folder.id;

                          return (
                            <motion.div
                              key={folder.id}
                              layout="position"
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={SPRING_LAYOUT}
                              data-testid={`tag-folder-group-${folder.name}`}
                              data-drop-folder-id={folder.id}
                              className="tag-folder-group"
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                data-testid={`tag-folder-${folder.name}`}
                                data-drop-folder-id={folder.id}
                                className={`nav-row nav-row--folder ${
                                  activeNav === navKey ? "nav-row--active" : ""
                                } ${isDropTarget ? "nav-row--drop-target" : ""}`}
                                onClick={() => onSelectNav(navKey)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelectNav(navKey);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openMenuAt(e.clientX, e.clientY, "tags-section");
                                }}
                              >
                                <ActiveRowHighlight active={activeNav === navKey} />
                                <span className="nav-row-icon">
                                  <FolderIcon />
                                </span>
                                <span className="nav-row-label">{folder.name}</span>

                                <AnimatePresence mode="popLayout" initial={false}>
                                  {showItemCounts && folderCount > 0 && (
                                    <motion.span
                                      key={`${folder.id}-${folderCount}`}
                                      className="nav-row-count"
                                      data-testid={`tag-folder-count-${folder.name}`}
                                      initial={{ opacity: 0, scale: 0.72 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.72 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 520,
                                        damping: 30,
                                      }}
                                    >
                                      {folderCount}
                                    </motion.span>
                                  )}
                                </AnimatePresence>

                                <button
                                  type="button"
                                  className="nav-folder-chevron"
                                  aria-label={
                                    folder.collapsed ? "Expand folder" : "Collapse folder"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFolderCollapse(folder.id);
                                  }}
                                >
                                  <ChevronIcon open={!folder.collapsed} size={11} />
                                </button>
                              </div>

                              <AnimatePresence initial={false}>
                                {!folder.collapsed && folder.tags.length > 0 && (
                                  <motion.div
                                    data-drop-folder-id={folder.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                      duration: 0.22,
                                      ease: [0.22, 1, 0.36, 1],
                                    }}
                                    style={{ overflow: "hidden" }}
                                  >
                                    {folder.tags.map((nestedTag) => {
                                      const tagNavKey = `tag:${nestedTag}`;
                                      const tagCount = getTagItemCount(items, nestedTag);
                                      const isDraggingThis =
                                        tagDrag?.active && tagDrag.tag === nestedTag;

                                      return (
                                        <motion.button
                                          key={nestedTag}
                                          layout="position"
                                          initial={{ opacity: 0, x: -8 }}
                                          animate={{
                                            opacity: isDraggingThis ? 0.34 : 1,
                                            x: 0,
                                          }}
                                          exit={{ opacity: 0, x: -6 }}
                                          transition={SPRING_LAYOUT}
                                          type="button"
                                          data-testid={`nested-tag-${nestedTag}`}
                                          data-drop-folder-id={folder.id}
                                          data-drop-sidebar-target={tagNavKey}
                                          className={`nav-row nav-row--nested ${
                                            activeNav === tagNavKey ? "nav-row--active" : ""
                                          } ${activeCardDropKey === tagNavKey ? "nav-row--drop-target" : ""} ${
                                            pulseTargetKey === tagNavKey ? "nav-row--drop-pulse" : ""
                                          }`}
                                          onPointerDown={(e) =>
                                            startTagPointerDrag(e, nestedTag, true)
                                          }
                                          onClick={() => {
                                            if (suppressNextTagClickRef.current) return;
                                            onSelectNav(tagNavKey);
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openMenuAt(
                                              e.clientX,
                                              e.clientY,
                                              "tag-item",
                                              nestedTag,
                                            );
                                          }}
                                        >
                                          <ActiveRowHighlight active={activeNav === tagNavKey} />
                                          <span className="nav-row-icon">
                                            <HashTagIcon size={13} />
                                          </span>
                                          <span className="nav-row-label">{nestedTag}</span>
                                          {showItemCounts && <span className="nav-row-count">{tagCount}</span>}
                                        </motion.button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}

                        {/* Top-Level Tags */}
                        {topLevelTags.map((tag) => {
                          const navKey = `tag:${tag}`;
                          const count = getTagItemCount(items, tag);
                          const isDraggingThis = tagDrag?.active && tagDrag.tag === tag;

                          return (
                            <motion.button
                              key={tag}
                              layout="position"
                              animate={{ opacity: isDraggingThis ? 0.34 : 1 }}
                              transition={SPRING_LAYOUT}
                              type="button"
                              data-testid={`tag-row-${tag}`}
                              data-drop-root-tags="true"
                              data-drop-sidebar-target={navKey}
                              className={`nav-row ${
                                activeNav === navKey ? "nav-row--active" : ""
                              } ${activeCardDropKey === navKey ? "nav-row--drop-target" : ""} ${
                                pulseTargetKey === navKey ? "nav-row--drop-pulse" : ""
                              }`}
                              onPointerDown={(e) => startTagPointerDrag(e, tag, false)}
                              onClick={() => {
                                if (suppressNextTagClickRef.current) return;
                                onSelectNav(navKey);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openMenuAt(e.clientX, e.clientY, "tag-item", tag);
                              }}
                            >
                              <ActiveRowHighlight active={activeNav === navKey} />
                              <span className="nav-row-icon">
                                <HashTagIcon size={13} />
                              </span>
                              <span className="nav-row-label">{tag}</span>
                              {showItemCounts && <span className="nav-row-count">{count}</span>}
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </LayoutGroup>
          </nav>

          <div
            className={`sidebar-scroll-fade sidebar-scroll-fade--bottom ${
              scrollFade.bottom ? "sidebar-scroll-fade--visible" : ""
            }`}
            aria-hidden="true"
          />
        </div>

        <div className="sidebar-bottom" ref={libraryFooterRef}>
          {/* Upward Native macOS Frosted Library Popover (Language + Settings + Library Actions) */}
          <AnimatePresence>
            {libraryMenuOpen && (
              <motion.div
                className="library-menu-popover"
                data-testid="library-menu-popover"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  className="library-popover-card"
                  onClick={() => {
                    onSelectNav("all");
                    setLibraryMenuOpen(false);
                  }}
                >
                  <span className="library-popover-emblem">
                    <AtlasStarIcon size={14} />
                  </span>
                  <span className="library-popover-meta">
                    <span className="library-popover-name">{libraryName}</span>
                    <span className="library-popover-sub">
                      {m.localLibrarySub(counts.all)}
                    </span>
                  </span>
                  <span className="library-popover-check" aria-hidden="true">
                    <CheckIcon size={12} />
                  </span>
                </button>

                <div className="library-popover-sep" />

                {/* Inline Bilingual Switcher (English / 简体中文) */}
                <div
                  className="library-popover-lang-row"
                  data-testid="library-locale-switcher"
                >
                  <span className="library-popover-lang-label">
                    <GlobeIcon size={13} />
                    <span>{m.popoverLanguage}</span>
                  </span>
                  <div className="library-lang-seg" role="radiogroup" aria-label={m.popoverLanguage}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={locale === "en"}
                      data-testid="popover-locale-en"
                      className={`library-lang-btn ${
                        locale === "en" ? "library-lang-btn--active" : ""
                      }`}
                      onClick={() => onChangeLocale("en")}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={locale === "zh-CN"}
                      data-testid="popover-locale-zh"
                      className={`library-lang-btn ${
                        locale === "zh-CN" ? "library-lang-btn--active" : ""
                      }`}
                      onClick={() => onChangeLocale("zh-CN")}
                    >
                      中文
                    </button>
                  </div>
                </div>

                <div className="library-popover-sep" />

                <button
                  type="button"
                  className="library-popover-item"
                  onClick={() => {
                    setLibraryMenuOpen(false);
                    onImportClick();
                  }}
                >
                  <UploadIcon size={13} />
                  <span style={{ flex: 1 }}>{m.popoverImportFiles}</span>
                </button>

                <button
                  type="button"
                  className="library-popover-item"
                  onClick={() => {
                    setLibraryMenuOpen(false);
                    onExportLibrary();
                  }}
                >
                  <ExportIcon size={13} />
                  <span style={{ flex: 1 }}>{m.popoverExportLibrary}</span>
                </button>

                <div className="library-popover-sep" />

                <button
                  type="button"
                  className="library-popover-item"
                  data-testid="open-storage-analyzer-btn"
                  onClick={() => {
                    setLibraryMenuOpen(false);
                    onOpenStorage();
                  }}
                >
                  <HardDriveIcon size={13} />
                  <span style={{ flex: 1 }}>{m.popoverStorageUsage}</span>
                </button>

                <button
                  type="button"
                  className="library-popover-item library-popover-item--settings"
                  data-testid="open-settings-btn"
                  onClick={() => {
                    setLibraryMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <SettingsGearIcon size={13} />
                  <span style={{ flex: 1 }}>{m.popoverSettings}</span>
                  <span className="library-popover-shortcut">⌘,</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            className={`library-switcher ${
              libraryMenuOpen ? "library-switcher--open" : ""
            }`}
            data-testid="library-switcher-btn"
            aria-expanded={libraryMenuOpen}
            aria-haspopup="menu"
            onClick={() => setLibraryMenuOpen((v) => !v)}
            title={m.popoverSwitchHint}
          >
            <AtlasStarIcon size={14} />
            <span className="library-switcher-name">{libraryName}</span>
            <span className="library-switcher-chevron" aria-hidden="true">
              <ChevronUpDownIcon size={11} />
            </span>
          </button>
          <button
            type="button"
            className="sidebar-icon-btn"
            onClick={onImportClick}
            title={m.tooltipImportImages}
            aria-label={m.tooltipImportImages}
          >
            <UploadIcon size={15} />
          </button>
        </div>
      </aside>

      {/* Video 00:08 / 00:10 / 00:12 Authentic Floating macOS Tag Drag Ghost */}
      <AnimatePresence>
        {tagDrag?.active && (
          <motion.div
            className="sidebar-tag-drag-ghost"
            data-testid="sidebar-tag-drag-ghost"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 0.96, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            style={{
              left: tagDrag.x + 10,
              top: tagDrag.y - 14,
            }}
          >
            <HashTagIcon size={13} />
            <span>{tagDrag.tag}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video 00:02 Native macOS Frosted Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="mac-context-menu"
            data-testid="mac-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -3 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {contextMenu.kind === "sidebar-plus" ? (
              <>
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => openSheet("collection")}
                >
                  <span>{m.menuNewCollection}</span>
                </button>
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => openSheet("folder")}
                >
                  <span>{m.menuNewTagFolder}</span>
                </button>
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => openSheet("tag")}
                >
                  <span>{m.menuNewTag}</span>
                </button>
                {(tagsHidden || collectionsHidden) && (
                  <>
                    <div className="mac-menu-sep" />
                    {collectionsHidden && (
                      <button
                        type="button"
                        className="mac-menu-item"
                        onClick={() => {
                          setCollectionsHidden(false);
                          setCollectionsOpen(true);
                          setContextMenu(null);
                        }}
                      >
                        <span>{m.menuShowCollections}</span>
                      </button>
                    )}
                    {tagsHidden && (
                      <button
                        type="button"
                        className="mac-menu-item"
                        onClick={() => {
                          setTagsHidden(false);
                          setTagsOpen(true);
                          setContextMenu(null);
                        }}
                      >
                        <span>{m.menuShowTags}</span>
                      </button>
                    )}
                  </>
                )}
              </>
            ) : contextMenu.kind === "collections-section" ? (
              <>
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => openSheet("collection")}
                >
                  <span>{m.menuNewCollection}</span>
                </button>
                <div className="mac-menu-sep" />
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => {
                    setCollectionsOpen((v) => !v);
                    setContextMenu(null);
                  }}
                >
                  <span>
                    {collectionsOpen ? m.menuCollapseSection : m.menuExpandSection}
                  </span>
                </button>
                <button
                  type="button"
                  className="mac-menu-item"
                  onClick={() => {
                    setCollectionsHidden(true);
                    setContextMenu(null);
                  }}
                >
                  <span>{m.menuHideSection}</span>
                </button>
              </>
            ) : contextMenu.kind === "tags-section" ? (
              <>
                <button
                  type="button"
                  className="mac-menu-item"
                  onMouseEnter={() => setSortSubmenuOpen(false)}
                  onClick={() => openSheet("tag")}
                >
                  <span>{m.menuNewTag}</span>
                </button>
                <button
                  type="button"
                  className="mac-menu-item"
                  data-testid="menu-new-folder"
                  onMouseEnter={() => setSortSubmenuOpen(false)}
                  onClick={() => openSheet("folder")}
                >
                  <span>{m.menuNewFolder}</span>
                </button>
                <div className="mac-menu-sep" />
                <button
                  type="button"
                  className="mac-menu-item"
                  onMouseEnter={() => setSortSubmenuOpen(false)}
                  onClick={() => {
                    setTagsOpen((v) => !v);
                    setContextMenu(null);
                  }}
                >
                  <span>
                    {tagsOpen ? m.menuCollapseSection : m.menuExpandSection}
                  </span>
                </button>
                <button
                  type="button"
                  className="mac-menu-item"
                  onMouseEnter={() => setSortSubmenuOpen(false)}
                  onClick={() => {
                    setTagsHidden(true);
                    setContextMenu(null);
                  }}
                >
                  <span>{m.menuHideSection}</span>
                </button>
                <div className="mac-menu-sep" />
                <div
                  className="mac-menu-submenu-wrap"
                  onMouseEnter={() => setSortSubmenuOpen(true)}
                >
                  <button
                    type="button"
                    className={`mac-menu-item ${sortSubmenuOpen ? "mac-menu-item--hover" : ""}`}
                    onClick={() => setSortSubmenuOpen((v) => !v)}
                  >
                    <span>{m.menuSortBy}</span>
                    <span className="mac-menu-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>

                  <AnimatePresence>
                    {sortSubmenuOpen && (
                      <motion.div
                        className="mac-context-submenu"
                        initial={{ opacity: 0, scale: 0.96, x: -4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.96, x: -4 }}
                        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <button
                          type="button"
                          className="mac-menu-item"
                          onClick={() => {
                            setTagSort("name");
                            setContextMenu(null);
                          }}
                        >
                          <span className="mac-menu-check">
                            {tagSort === "name" && <CheckIcon size={12} />}
                          </span>
                          <span style={{ flex: 1 }}>{m.sortNameAsc}</span>
                        </button>
                        <button
                          type="button"
                          className="mac-menu-item"
                          onClick={() => {
                            setTagSort("count");
                            setContextMenu(null);
                          }}
                        >
                          <span className="mac-menu-check">
                            {tagSort === "count" && <CheckIcon size={12} />}
                          </span>
                          <span style={{ flex: 1 }}>{m.sortCountDesc}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              contextMenu.tagName && (
                <>
                  <button
                    type="button"
                    className="mac-menu-item"
                    onClick={() => {
                      onSelectNav(`tag:${contextMenu.tagName}`);
                      setContextMenu(null);
                    }}
                  >
                    <span>#{contextMenu.tagName}</span>
                  </button>
                  {tagFolders.length > 0 && <div className="mac-menu-sep" />}
                  {tagFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className="mac-menu-item"
                      onClick={() => {
                        if (contextMenu.tagName) {
                          onNestTag(contextMenu.tagName, folder.id);
                        }
                        setContextMenu(null);
                      }}
                    >
                      <span>
                        {m.menuMoveToFolder} · {folder.name}
                      </span>
                    </button>
                  ))}
                  {nestedTagSet.has(contextMenu.tagName) && (
                    <>
                      <div className="mac-menu-sep" />
                      <button
                        type="button"
                        className="mac-menu-item"
                        onClick={() => {
                          if (contextMenu.tagName) onUnnestTag(contextMenu.tagName);
                          setContextMenu(null);
                        }}
                      >
                        <span>{m.menuRemoveFromFolder}</span>
                      </button>
                    </>
                  )}
                  <div className="mac-menu-sep" />
                  <button
                    type="button"
                    className="mac-menu-item"
                    onClick={() => openSheet("folder")}
                  >
                    <span>{m.menuNewFolder}</span>
                  </button>
                </>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video 00:03–00:06 Native macOS Frosted Glass Sheet Modal */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            className="mac-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={() => setSheet(null)}
          >
            <motion.form
              className="mac-sheet"
              data-testid="mac-sheet-modal"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 4 }}
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSheetSubmit}
            >
              <div className="mac-sheet-folder-badge" aria-hidden="true">
                {sheet === "tag" ? (
                  <HashTagIcon size={20} />
                ) : (
                  <span className="mac-sheet-squircle-core" />
                )}
              </div>
              <h2 className="mac-sheet-title">
                {sheet === "folder"
                  ? m.sheetNewFolderTitle
                  : sheet === "tag"
                    ? m.sheetNewTagTitle
                    : m.sheetNewCollectionTitle}
              </h2>
              <input
                ref={sheetInputRef}
                type="text"
                className="mac-sheet-input"
                data-testid="mac-sheet-input"
                placeholder={
                  sheet === "folder"
                    ? m.sheetFolderPlaceholder
                    : sheet === "tag"
                      ? m.sheetTagPlaceholder
                      : m.sheetCollectionPlaceholder
                }
                value={sheetInput}
                onChange={(e) => {
                  setSheetInput(e.target.value);
                  if (sheetError) setSheetError(null);
                }}
              />
              {sheetError && <p className="mac-sheet-error">{sheetError}</p>}
              <div className="mac-sheet-actions">
                <button
                  type="button"
                  className="mac-sheet-cancel"
                  onClick={() => setSheet(null)}
                >
                  {m.btnCancel}
                </button>
                <button
                  type="submit"
                  className="mac-sheet-ok"
                  data-testid="mac-sheet-ok"
                >
                  {m.btnCreate}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
