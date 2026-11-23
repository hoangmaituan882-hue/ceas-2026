import type { ViewMode } from "./library-engine";

export type AppLocale = "en" | "zh-CN";
export type QuickLookSpeed = "snappy" | "default" | "silky";
export type CanvasTidyDensity = "compact" | "balanced" | "spacious";
export type WheelZoomMode = "pinch" | "direct";
export type ExportFormat = "original" | "png" | "jpg";

export type SettingsCategoryId =
  | "general"
  | "appearance"
  | "motion"
  | "spatial"
  | "storage"
  | "shortcuts"
  | "about";

export interface AppSettings {
  locale: AppLocale;
  libraryName: string;
  defaultView: ViewMode;
  showItemCounts: boolean;
  showCardBadges: boolean;
  confirmBeforeTrash: boolean;
  autoFocusImported: boolean;
  radialNeighborPush: boolean;
  quickLookSpeed: QuickLookSpeed;
  veilOpacity: number;
  autoOpenInspector: boolean;
  canvasInertia: boolean;
  canvasTidyDensity: CanvasTidyDensity;
  wheelZoomMode: WheelZoomMode;
  storagePath: string;
  fileNamePattern: string;
  exportFormat: ExportFormat;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "en",
  libraryName: "",
  defaultView: "grid",
  showItemCounts: true,
  showCardBadges: true,
  confirmBeforeTrash: false,
  autoFocusImported: true,
  radialNeighborPush: true,
  quickLookSpeed: "default",
  veilOpacity: 0.94,
  autoOpenInspector: false,
  canvasInertia: true,
  canvasTidyDensity: "balanced",
  wheelZoomMode: "pinch",
  storagePath: "~/Pictures/Atlas Library.atlas",
  fileNamePattern: "Atlas_{yyyy}{MM}{dd}_{title}",
  exportFormat: "original",
};

export function clampVeilOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.veilOpacity;
  return Math.round(Math.min(1, Math.max(0.72, value)) * 100) / 100;
}

export function getQuickLookSpeedMultiplier(speed: QuickLookSpeed): number {
  if (speed === "snappy") return 0.76;
  if (speed === "silky") return 1.3;
  return 1;
}

export function getTidyDensityParams(density: CanvasTidyDensity): {
  rowHeight: number;
  gapX: number;
  gapY: number;
} {
  if (density === "compact") return { rowHeight: 184, gapX: 16, gapY: 16 };
  if (density === "spacious") return { rowHeight: 222, gapX: 34, gapY: 32 };
  return { rowHeight: 204, gapX: 24, gapY: 24 };
}

export function normalizeSettings(
  raw: Partial<AppSettings> | null | undefined,
): AppSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  return {
    locale: raw.locale === "zh-CN" ? "zh-CN" : "en",
    libraryName:
      typeof raw.libraryName === "string" ? raw.libraryName.slice(0, 48) : "",
    defaultView:
      raw.defaultView === "canvas" || raw.defaultView === "infinity"
        ? raw.defaultView
        : "grid",
    showItemCounts:
      typeof raw.showItemCounts === "boolean"
        ? raw.showItemCounts
        : DEFAULT_SETTINGS.showItemCounts,
    showCardBadges:
      typeof raw.showCardBadges === "boolean"
        ? raw.showCardBadges
        : DEFAULT_SETTINGS.showCardBadges,
    confirmBeforeTrash:
      typeof raw.confirmBeforeTrash === "boolean"
        ? raw.confirmBeforeTrash
        : DEFAULT_SETTINGS.confirmBeforeTrash,
    autoFocusImported:
      typeof raw.autoFocusImported === "boolean"
        ? raw.autoFocusImported
        : DEFAULT_SETTINGS.autoFocusImported,
    radialNeighborPush:
      typeof raw.radialNeighborPush === "boolean"
        ? raw.radialNeighborPush
        : DEFAULT_SETTINGS.radialNeighborPush,
    quickLookSpeed:
      raw.quickLookSpeed === "snappy" || raw.quickLookSpeed === "silky"
        ? raw.quickLookSpeed
        : "default",
    veilOpacity: clampVeilOpacity(
      raw.veilOpacity ?? DEFAULT_SETTINGS.veilOpacity,
    ),
    autoOpenInspector:
      typeof raw.autoOpenInspector === "boolean"
        ? raw.autoOpenInspector
        : DEFAULT_SETTINGS.autoOpenInspector,
    canvasInertia:
      typeof raw.canvasInertia === "boolean"
        ? raw.canvasInertia
        : DEFAULT_SETTINGS.canvasInertia,
    canvasTidyDensity:
      raw.canvasTidyDensity === "compact" ||
      raw.canvasTidyDensity === "spacious"
        ? raw.canvasTidyDensity
        : "balanced",
    wheelZoomMode:
      raw.wheelZoomMode === "direct" ? "direct" : "pinch",
    storagePath:
      typeof raw.storagePath === "string" && raw.storagePath.trim().length > 0
        ? raw.storagePath.trim()
        : DEFAULT_SETTINGS.storagePath,
    fileNamePattern:
      typeof raw.fileNamePattern === "string" &&
      raw.fileNamePattern.trim().length > 0
        ? raw.fileNamePattern.trim().slice(0, 64)
        : DEFAULT_SETTINGS.fileNamePattern,
    exportFormat:
      raw.exportFormat === "png" || raw.exportFormat === "jpg"
        ? raw.exportFormat
        : "original",
  };
}

export interface AtlasMessages {
  // Brand & library
  defaultLibraryName: string;
  localLibrarySub: (count: number) => string;
  itemCount: (count: number) => string;

  // Sidebar smart views
  navAll: string;
  navInbox: string;
  navLikes: string;
  navLinks: string;
  navUntagged: string;
  navTrash: string;
  sectionCollections: string;
  sectionTags: string;

  // Sidebar menus & sheets
  menuNewCollection: string;
  menuNewTagFolder: string;
  menuNewTag: string;
  menuNewFolder: string;
  menuShowCollections: string;
  menuShowTags: string;
  menuCollapseSection: string;
  menuExpandSection: string;
  menuHideSection: string;
  menuSortBy: string;
  sortNameAsc: string;
  sortNameDesc: string;
  sortCountDesc: string;
  menuRenameFolder: string;
  menuDeleteFolder: string;
  menuMoveToFolder: string;
  menuRemoveFromFolder: string;
  sheetNewFolderTitle: string;
  sheetRenameFolderTitle: string;
  sheetNewCollectionTitle: string;
  sheetNewTagTitle: string;
  sheetFolderPlaceholder: string;
  sheetCollectionPlaceholder: string;
  sheetTagPlaceholder: string;
  btnCancel: string;
  btnCreate: string;
  btnSave: string;

  // Library footer popover
  popoverLanguage: string;
  popoverImportFiles: string;
  popoverExportLibrary: string;
  popoverStorageUsage: string;
  popoverSettings: string;
  popoverSwitchHint: string;

  // Topbar
  viewGrid: string;
  viewCanvas: string;
  viewInfinity: string;
  searchPlaceholder: string;
  tooltipToggleSidebar: string;
  tooltipFilterLikes: string;
  tooltipSwitchLight: string;
  tooltipSwitchDark: string;
  tooltipImportImages: string;

  // Bottom dock & customize
  selectedCount: (count: number) => string;
  dockLike: string;
  dockTrash: string;
  dockRestore: string;
  dockClear: string;
  dockReset: string;
  dockTidyGrid: string;
  dockPackPile: string;
  dockResetView: string;
  dockRecenter: string;
  dockExportFiles: (count: number) => string;
  dockLayoutJustified: string;
  dockLayoutSquare: string;
  dockLayoutFit: string;
  dockCustomize: string;
  customizeAppearance: string;
  customizeLight: string;
  customizeDark: string;
  customizeSpacing: string;
  customizeCornerRadius: string;

  // Canvas floating toolbars & spatial tools
  canvasToolSelect: string;
  canvasToolHand: string;
  canvasToolImport: string;
  canvasToolPack: string;
  canvasToolNote: string;
  canvasToolComment: string;
  canvasToolFind: string;
  canvasZoomIn: string;
  canvasZoomOut: string;
  canvasFitView: string;
  canvasFindPlaceholder: string;
  canvasFindPrev: string;
  canvasFindNext: string;
  canvasFindClose: string;
  canvasCommentPlaceholder: string;
  canvasCommentSubmit: string;
  canvasReplyBtn: string;
  canvasReplyPlaceholder: string;
  canvasResolveComment: string;
  canvasCommentClickHint: string;
  canvasNoteTitlePlaceholder: string;
  canvasNoteBodyPlaceholder: string;
  canvasNoteLinkPlaceholder: string;
  canvasFmtEmoji: string;
  canvasFmtTextSize: string;
  canvasFmtBold: string;
  canvasFmtItalic: string;
  canvasFmtUnderline: string;
  canvasFmtCode: string;
  canvasFmtColor: string;
  canvasFmtList: string;
  canvasFmtLink: string;
  canvasFmtDeleteNote: string;
  canvasPanHint: string;
  canvasAuthorYou: string;
  canvasJustNow: string;

  // Card context menu & empty states
  cardOpenQuickLook: string;
  cardLike: string;
  cardUnlike: string;
  cardMoveToCollection: string;
  cardInboxNoCollection: string;
  cardMoveToTrash: string;
  cardRestoreFromTrash: string;
  emptyNothingTitle: string;
  emptyTrashSub: string;
  emptyDefaultSub: string;
  emptyCanvasTitle: string;
  emptyCanvasSub: string;
  emptyInfinityTitle: string;
  emptyInfinitySub: string;
  dropOverlayText: string;
  dragReturnHint: string;
  dragTargetMoveTo: (name: string) => string;
  dragTargetAddTag: (tag: string) => string;
  dragTargetLike: string;
  dragTargetTrash: string;

  // QuickLook & Inspector
  qlBackToBoard: string;
  qlImage: string;
  qlVideo: string;
  qlLink: string;
  qlAuto: string;
  qlInspectorTitle: string;
  qlInspectorPalette: string;
  qlInspectorCollection: string;
  qlInspectorInboxUnsorted: string;
  qlInspectorTags: string;
  qlInspectorAddTagPlaceholder: string;
  qlInspectorNotes: string;
  qlInspectorNotesPlaceholder: string;
  qlCopyFilename: string;
  qlExportOriginal: string;

  // Toasts
  toastShuffled: string;
  toastTidyCanvas: string;
  toastPackedPile: string;
  toastRestored: string;
  toastMovedToTrash: string;
  toastBatchMovedTo: (count: number, dest: string) => string;
  toastBatchTagged: (count: number, tag: string) => string;
  toastBatchLiked: (count: number) => string;
  toastBatchTrashed: (count: number) => string;
  toastImported: (count: number) => string;
  toastExporting: (count: number, fmt: string) => string;
  toastCreatedFolder: (name: string) => string;
  toastCreatedCollection: (name: string) => string;
  toastCreatedTag: (name: string) => string;
  toastNestedTag: (tag: string, folder: string) => string;
  toastLanguageSwitched: string;
  toastCacheCleared: string;
  toastSettingsReset: string;
  toastUpToDate: string;
  toastPathRevealed: string;

  // Settings Window (macOS style)
  settingsTitle: string;
  settingsSearchPlaceholder: string;
  settingsNoSearchResults: string;
  settingsResetDefaults: string;

  catGeneral: string;
  catGeneralDesc: string;
  catAppearance: string;
  catAppearanceDesc: string;
  catMotion: string;
  catMotionDesc: string;
  catSpatial: string;
  catSpatialDesc: string;
  catStorage: string;
  catStorageDesc: string;
  catShortcuts: string;
  catShortcutsDesc: string;
  catAbout: string;
  catAboutDesc: string;

  // Settings rows - General
  setLangTitle: string;
  setLangDesc: string;
  setDefaultViewTitle: string;
  setDefaultViewDesc: string;
  setShowCountsTitle: string;
  setShowCountsDesc: string;
  setAutoFocusImportTitle: string;
  setAutoFocusImportDesc: string;
  setConfirmTrashTitle: string;
  setConfirmTrashDesc: string;

  // Settings rows - Appearance
  setThemeTitle: string;
  setThemeDesc: string;
  setGridLayoutTitle: string;
  setGridLayoutDesc: string;
  setZoomTitle: string;
  setZoomDesc: string;
  setSpacingTitle: string;
  setSpacingDesc: string;
  setRadiusTitle: string;
  setRadiusDesc: string;
  setShowBadgesTitle: string;
  setShowBadgesDesc: string;

  // Settings rows - Motion & Preview
  setRadialPushTitle: string;
  setRadialPushDesc: string;
  setMotionSpeedTitle: string;
  setMotionSpeedDesc: string;
  speedSnappy: string;
  speedDefault: string;
  speedSilky: string;
  setVeilOpacityTitle: string;
  setVeilOpacityDesc: string;
  setAutoInspectorTitle: string;
  setAutoInspectorDesc: string;

  // Settings rows - Spatial
  setInertiaTitle: string;
  setInertiaDesc: string;
  setTidyDensityTitle: string;
  setTidyDensityDesc: string;
  densityCompact: string;
  densityBalanced: string;
  densitySpacious: string;
  setWheelZoomTitle: string;
  setWheelZoomDesc: string;
  wheelPinch: string;
  wheelDirect: string;

  // Settings rows - Storage
  setLibraryNameTitle: string;
  setLibraryNameDesc: string;
  setStoragePathTitle: string;
  btnChange: string;
  btnReveal: string;
  setFileNamePatternTitle: string;
  setFileNamePatternDesc: string;
  setExportFormatTitle: string;
  setExportFormatDesc: string;
  formatOriginal: string;
  setStorageBreakdownTitle: string;
  setStorageBreakdownDesc: (totalMb: string, count: number) => string;
  storageLegendImages: string;
  storageLegendVideos: string;
  storageLegendCache: string;
  btnClearCache: string;

  // Interactive Local Disk Storage Analyzer
  storageOfTotalUsed: (totalGb: number) => string;
  storageRescan: string;
  storageCalculating: string;
  storageClearingCaches: string;
  storageEmptyingTrash: string;
  storageHoverPrompt: string;
  storageLiveQuotaLabel: string;
  storageFreedSummary: (freed: string, avail: string) => string;
  storageFooterScanning: string;
  storageFooterReclaiming: string;
  storageFooterCachesHint: (gb: string) => string;
  storageFooterTrashHint: (gb: string) => string;
  storageFooterAllClean: string;
  storageBtnClearCaches: string;
  storageBtnEmptyTrash: string;
  toastCachesFreed: (gb: string) => string;
  toastTrashEmptied: (gb: string) => string;

  // Settings rows - Shortcuts
  scToggleSidebar: string;
  scFocusSearch: string;
  scOpenSettings: string;
  scSwitchViews: string;
  scQuickLook: string;
  scNavigateItems: string;
  scToggleInspector: string;
  scLikeItem: string;
  scToggleTheme: string;
  scShuffleGrid: string;

  // Settings rows - About
  aboutTagline: string;
  aboutVersion: string;
  aboutEngine: string;
  aboutCheckUpdates: string;
  aboutBuildChannel: string;
  aboutBuildChannelValue: string;
  aboutLicense: string;
  aboutLicenseValue: string;

  // Rich Media types & interactive QuickLook players
  sectionMedia: string;
  navModels3d: string;
  navAudio: string;
  navFonts: string;
  navGifs: string;
  qlAudio: string;
  qlModel3d: string;
  qlFont: string;
  qlGif: string;
  mediaPlay: string;
  mediaPause: string;
  mediaLoop: string;
  videoScrubLabel: string;
  videoPopOutPip: string;
  videoPipShort: string;
  videoPipWindowLabel: string;
  videoReturnQuickLook: string;
  videoDockToCard: string;
  videoClosePip: string;
  audioScrubLabel: string;
  audioVolume: string;
  audioMute: string;
  audioUnmute: string;
  audioMuted: string;
  modelVerts: string;
  modelTris: string;
  modelShowControls: string;
  modelHideControls: string;
  modelMatPbr: string;
  modelMatClay: string;
  modelMatWire: string;
  modelLightStudio: string;
  modelLightWarm: string;
  modelLightDramatic: string;
  modelExplode: string;
  modelTurntable: string;
  fontStylesUnit: string;
  fontTabSpecimen: string;
  fontTabWaterfall: string;
  fontTabGlyphs: string;
  fontPaperLight: string;
  fontPaperDark: string;
  fontSizeLabel: string;
  fontTrackingLabel: string;
  fontLeadingLabel: string;
  fontCopiedGlyph: string;
  gifFramesUnit: string;
  gifPrevFrame: string;
  gifNextFrame: string;
  gifScrubLabel: string;
}

const EN_MESSAGES: AtlasMessages = {
  defaultLibraryName: "Atlas Library",
  localLibrarySub: (count) =>
    `${count} ${count === 1 ? "item" : "items"} · Local`,
  itemCount: (count) => `${count} ${count === 1 ? "item" : "items"}`,

  navAll: "All",
  navInbox: "Inbox",
  navLikes: "Likes",
  navLinks: "Links",
  navUntagged: "Untagged",
  navTrash: "Trash",
  sectionCollections: "COLLECTIONS",
  sectionTags: "TAGS",

  menuNewCollection: "New collection",
  menuNewTagFolder: "New tag folder",
  menuNewTag: "New tag",
  menuNewFolder: "New folder",
  menuShowCollections: "Show Collections section",
  menuShowTags: "Show Tags section",
  menuCollapseSection: "Collapse section",
  menuExpandSection: "Expand section",
  menuHideSection: "Hide section",
  menuSortBy: "Sort by",
  sortNameAsc: "Name (A–Z)",
  sortNameDesc: "Name (Z–A)",
  sortCountDesc: "Most items",
  menuRenameFolder: "Rename folder",
  menuDeleteFolder: "Delete folder",
  menuMoveToFolder: "Move to folder",
  menuRemoveFromFolder: "Remove from folder",
  sheetNewFolderTitle: "New folder",
  sheetRenameFolderTitle: "Rename folder",
  sheetNewCollectionTitle: "New collection",
  sheetNewTagTitle: "New tag",
  sheetFolderPlaceholder: "Folder name",
  sheetCollectionPlaceholder: "Collection name",
  sheetTagPlaceholder: "Tag name",
  btnCancel: "Cancel",
  btnCreate: "Create",
  btnSave: "Save",

  popoverLanguage: "Language",
  popoverImportFiles: "Import Files…",
  popoverExportLibrary: "Export Library…",
  popoverStorageUsage: "Storage Usage…",
  popoverSettings: "Settings…",
  popoverSwitchHint: "Active local library",

  viewGrid: "Grid",
  viewCanvas: "Canvas",
  viewInfinity: "Infinity",
  searchPlaceholder: "Search...",
  tooltipToggleSidebar: "Toggle sidebar (⌘B)",
  tooltipFilterLikes: "Filter liked items",
  tooltipSwitchLight: "Switch to Light mode (D)",
  tooltipSwitchDark: "Switch to Dark mode (D)",
  tooltipImportImages: "Import local images",

  selectedCount: (count) => `${count} selected`,
  dockLike: "Like",
  dockTrash: "Trash",
  dockRestore: "Restore",
  dockClear: "Clear",
  dockReset: "Reset",
  dockTidyGrid: "Pack Board",
  dockPackPile: "Pack Pile",
  dockResetView: "Reset View",
  dockRecenter: "Recenter",
  dockExportFiles: (count) =>
    `Export ${count} ${count === 1 ? "file" : "files"}`,
  dockLayoutJustified: "Justified rows",
  dockLayoutSquare: "Square grid",
  dockLayoutFit: "Aspect fit",
  dockCustomize: "Customize appearance",
  customizeAppearance: "Appearance",
  customizeLight: "Light",
  customizeDark: "Dark",
  customizeSpacing: "Spacing",
  customizeCornerRadius: "Corner Radius",

  canvasToolSelect: "Select & Push (V)",
  canvasToolHand: "Pan Canvas (H / Space)",
  canvasToolImport: "Add media to canvas",
  canvasToolPack: "Pack Board",
  canvasToolNote: "Note",
  canvasToolComment: "Comment",
  canvasToolFind: "Find on canvas (⌘F)",
  canvasZoomIn: "Zoom in",
  canvasZoomOut: "Zoom out",
  canvasFitView: "Fit all to view (0)",
  canvasFindPlaceholder: "Find on canvas…",
  canvasFindPrev: "Previous match",
  canvasFindNext: "Next match",
  canvasFindClose: "Close find bar",
  canvasCommentPlaceholder: "Add a comment",
  canvasCommentSubmit: "Post comment",
  canvasReplyBtn: "Reply",
  canvasReplyPlaceholder: "Write a reply…",
  canvasResolveComment: "Resolve",
  canvasCommentClickHint: "Click anywhere on canvas to pin a comment",
  canvasNoteTitlePlaceholder: "Note heading…",
  canvasNoteBodyPlaceholder: "Write a quick direction, critique, or caption…",
  canvasNoteLinkPlaceholder: "https://reference-link.com",
  canvasFmtEmoji: "Add reaction",
  canvasFmtTextSize: "Text size",
  canvasFmtBold: "Bold",
  canvasFmtItalic: "Italic",
  canvasFmtUnderline: "Underline",
  canvasFmtCode: "Monospace",
  canvasFmtColor: "Note color",
  canvasFmtList: "Bullet list",
  canvasFmtLink: "Attach link",
  canvasFmtDeleteNote: "Delete note",
  canvasPanHint: "Drag anywhere to pan canvas",
  canvasAuthorYou: "You",
  canvasJustNow: "Just now",

  cardOpenQuickLook: "Open Quick Look",
  cardLike: "Like",
  cardUnlike: "Unlike",
  cardMoveToCollection: "Move to Collection",
  cardInboxNoCollection: "Inbox (No collection)",
  cardMoveToTrash: "Move to Trash",
  cardRestoreFromTrash: "Restore from Trash",
  emptyNothingTitle: "Nothing here yet",
  emptyTrashSub: "Trash is empty.",
  emptyDefaultSub:
    "Try clearing filters, or drop images anywhere to add them to your library.",
  emptyCanvasTitle: "Empty Canvas",
  emptyCanvasSub:
    "Select a collection or clear search to arrange references freely.",
  emptyInfinityTitle: "Infinity Field Empty",
  emptyInfinitySub:
    "Choose another section to drift endlessly through references.",
  dropOverlayText: "Drop images to add to Atlas library",
  dragReturnHint: "↩ Release to return",
  dragTargetMoveTo: (name) => `→ ${name}`,
  dragTargetAddTag: (tag) => `+ #${tag}`,
  dragTargetLike: "♥ Add to Likes",
  dragTargetTrash: "→ Trash",

  qlBackToBoard: "Back to board (Esc)",
  qlImage: "Image",
  qlVideo: "Video",
  qlLink: "Link",
  qlAuto: "Auto",
  qlInspectorTitle: "Title",
  qlInspectorPalette: "Palette",
  qlInspectorCollection: "Collection",
  qlInspectorInboxUnsorted: "Inbox (Unsorted)",
  qlInspectorTags: "Tags",
  qlInspectorAddTagPlaceholder: "Add #tag and press Enter",
  qlInspectorNotes: "Notes",
  qlInspectorNotesPlaceholder: "Add reference notes...",
  qlCopyFilename: "Copy filename",
  qlExportOriginal: "Export original",

  toastShuffled: "Shuffled grid",
  toastTidyCanvas: "Packed board into a tidy mosaic",
  toastPackedPile: "Packed selected cards into a pile",
  toastRestored: "Restored item",
  toastMovedToTrash: "Moved to Trash",
  toastBatchMovedTo: (count, dest) =>
    `Moved ${count} ${count === 1 ? "item" : "items"} to ${dest}`,
  toastBatchTagged: (count, tag) =>
    `Tagged ${count} ${count === 1 ? "item" : "items"} with #${tag}`,
  toastBatchLiked: (count) =>
    `Liked ${count} ${count === 1 ? "item" : "items"}`,
  toastBatchTrashed: (count) =>
    `Moved ${count} ${count === 1 ? "item" : "items"} to Trash`,
  toastImported: (count) =>
    `Imported ${count} ${count === 1 ? "image" : "images"}`,
  toastExporting: (count, fmt) =>
    `Exporting ${count} ${count === 1 ? "file" : "files"} (${fmt})`,
  toastCreatedFolder: (name) => `Created folder "${name}"`,
  toastCreatedCollection: (name) => `Created collection "${name}"`,
  toastCreatedTag: (name) => `Created tag #${name}`,
  toastNestedTag: (tag, folder) => `Moved #${tag} into "${folder}"`,
  toastLanguageSwitched: "Language switched to English",
  toastCacheCleared: "Thumbnail cache cleared (14.2 MB freed)",
  toastSettingsReset: "Settings restored to macOS defaults",
  toastUpToDate: "Atlas 2.4.0 is up to date",
  toastPathRevealed: "Revealed library bundle in Finder",

  settingsTitle: "Settings",
  settingsSearchPlaceholder: "Search settings",
  settingsNoSearchResults: "No matching settings",
  settingsResetDefaults: "Reset Defaults",

  catGeneral: "General",
  catGeneralDesc: "Language, launch workspace, and everyday library behavior",
  catAppearance: "Appearance",
  catAppearanceDesc: "Theme surface, card geometry, density, and badges",
  catMotion: "Motion & Preview",
  catMotionDesc: "Quick Look hero morph, neighbor parting, and veil ambiance",
  catSpatial: "Canvas & Infinity",
  catSpatialDesc: "Whiteboard physics, tidy spacing, and trackpad zooming",
  catStorage: "Library & Storage",
  catStorageDesc: "Local bundle location, naming tokens, and export format",
  catShortcuts: "Shortcuts",
  catShortcutsDesc: "Native macOS keyboard commands across all three views",
  catAbout: "About Atlas",
  catAboutDesc: "Version, build channel, and local spatial engine details",

  setLangTitle: "Interface Language",
  setLangDesc: "Switch display language instantly across all menus and panels",
  setDefaultViewTitle: "Default Startup View",
  setDefaultViewDesc: "Choose which view opens when launching your library",
  setShowCountsTitle: "Show Item Counts",
  setShowCountsDesc: "Display live numeric badges in the sidebar and header",
  setAutoFocusImportTitle: "Focus Newly Imported Media",
  setAutoFocusImportDesc: "Automatically highlight newly added images",
  setConfirmTrashTitle: "Gentle Trash Protection",
  setConfirmTrashDesc: "Keep deleted references recoverable in Trash",

  setThemeTitle: "Appearance Mode",
  setThemeDesc: "Seamless native Light and Dark surfaces synced immediately",
  setGridLayoutTitle: "Grid Layout Style",
  setGridLayoutDesc: "How cards arrange inside the Grid view",
  setZoomTitle: "Card Scale",
  setZoomDesc: "Live zoom multiplier applied across Grid, Canvas, and Infinity",
  setSpacingTitle: "Card Spacing",
  setSpacingDesc: "Breathing room between gallery tiles",
  setRadiusTitle: "Corner Radius",
  setRadiusDesc: "Continuous macOS squircle rounding on media frames",
  setShowBadgesTitle: "Media Corner Badges",
  setShowBadgesDesc: "Show video duration pills and source link domains on cards",

  setRadialPushTitle: "Radial Neighbor Parting",
  setRadialPushDesc:
    "Smoothly push surrounding cards outward on open and gather back on close",
  setMotionSpeedTitle: "Hero Transition Tempo",
  setMotionSpeedDesc: "Duration curve for shared-element Quick Look morphing",
  speedSnappy: "Snappy",
  speedDefault: "Default",
  speedSilky: "Silky",
  setVeilOpacityTitle: "Backdrop Veil Opacity",
  setVeilOpacityDesc: "How softly the gallery remains visible behind Quick Look",
  setAutoInspectorTitle: "Auto-Open Inspector",
  setAutoInspectorDesc: "Reveal palette, tags, and notes automatically on open",

  setInertiaTitle: "Momentum Glide Inertia",
  setInertiaDesc: "Smooth trackpad coasting when panning Canvas and Infinity",
  setTidyDensityTitle: "Tidy Grid Spacing",
  setTidyDensityDesc: "Row rhythm when arranging freeform Canvas items",
  densityCompact: "Compact",
  densityBalanced: "Balanced",
  densitySpacious: "Spacious",
  setWheelZoomTitle: "Scroll Wheel Zoom",
  setWheelZoomDesc: "Use ⌘ + Scroll / Pinch or direct scroll wheel to zoom",
  wheelPinch: "⌘ + Scroll",
  wheelDirect: "Direct Scroll",

  setLibraryNameTitle: "Library Display Name",
  setLibraryNameDesc: "Shown in the sidebar footer and window header",
  setStoragePathTitle: "Library Location",
  btnChange: "Change…",
  btnReveal: "Open",
  setFileNamePatternTitle: "Export Filename Pattern",
  setFileNamePatternDesc: "Tokens: {yyyy} {MM} {dd} {title}",
  setExportFormatTitle: "Export Format",
  setExportFormatDesc: "Preferred output container when exporting media",
  formatOriginal: "Original",
  setStorageBreakdownTitle: "Local Storage Usage",
  setStorageBreakdownDesc: (totalMb, count) =>
    `${totalMb} MB used across ${count} local references`,
  storageLegendImages: "Images",
  storageLegendVideos: "Videos",
  storageLegendCache: "Thumbnails",
  btnClearCache: "Clear Cache",

  storageOfTotalUsed: (totalGb) => `of ${totalGb} GB used`,
  storageRescan: "Rescan",
  storageCalculating: "Calculating",
  storageClearingCaches: "Clearing caches",
  storageEmptyingTrash: "Emptying the Trash",
  storageHoverPrompt: "Hover a section to see what's in it",
  storageLiveQuotaLabel: "Browser Quota",
  storageFreedSummary: (freed, avail) => `Freed ${freed}. ${avail} available`,
  storageFooterScanning: "Looking for things you can clear…",
  storageFooterReclaiming: "Reclaiming disk space…",
  storageFooterCachesHint: (gb) =>
    `Caches are using ${gb}. Apps rebuild them when they need them.`,
  storageFooterTrashHint: (gb) =>
    `The Trash is holding ${gb} of things you've already deleted.`,
  storageFooterAllClean: "Nothing else is worth clearing right now.",
  storageBtnClearCaches: "Clear caches",
  storageBtnEmptyTrash: "Empty Trash",
  toastCachesFreed: (gb) => `Cleared caches (${gb} freed)`,
  toastTrashEmptied: (gb) => `Emptied Trash (${gb} freed)`,

  scToggleSidebar: "Toggle Sidebar",
  scFocusSearch: "Focus Search",
  scOpenSettings: "Open Settings",
  scSwitchViews: "Switch Grid / Canvas / Infinity",
  scQuickLook: "Close Quick Look",
  scNavigateItems: "Previous / Next Media",
  scToggleInspector: "Toggle Quick Look Inspector",
  scLikeItem: "Like Current Media",
  scToggleTheme: "Toggle Light / Dark Mode",
  scShuffleGrid: "Shuffle Grid Order",

  aboutTagline: "Spatial visual reference library crafted for macOS",
  aboutVersion: "Version 2.4.0 (Build 2408)",
  aboutEngine: "Spatial GPU Compositor · Zero-jank Hero Transitions",
  aboutCheckUpdates: "Check for Updates",
  aboutBuildChannel: "Release Channel",
  aboutBuildChannelValue: "Stable (macOS Universal)",
  aboutLicense: "Library Storage",
  aboutLicenseValue: "100% Local-First · Private",

  sectionMedia: "MEDIA",
  navModels3d: "3D Models",
  navAudio: "Audio",
  navFonts: "Fonts",
  navGifs: "GIFs",
  qlAudio: "Audio",
  qlModel3d: "3D Model",
  qlFont: "Font",
  qlGif: "GIF",
  mediaPlay: "Play",
  mediaPause: "Pause",
  mediaLoop: "Loop",
  videoScrubLabel: "Video timeline",
  videoPopOutPip: "Float Mini-Player (seamless playback)",
  videoPipShort: "Float",
  videoPipWindowLabel: "Floating mini-player",
  videoReturnQuickLook: "Return to Quick Look",
  videoDockToCard: "Dock back to card",
  videoClosePip: "Close mini-player",
  audioScrubLabel: "Audio timeline",
  audioVolume: "Volume",
  audioMute: "Mute",
  audioUnmute: "Unmute",
  audioMuted: "Muted",
  modelVerts: "verts",
  modelTris: "tris",
  modelShowControls: "Show Controls",
  modelHideControls: "Hide Controls",
  modelMatPbr: "PBR",
  modelMatClay: "Clay",
  modelMatWire: "Wireframe",
  modelLightStudio: "Studio",
  modelLightWarm: "Warm",
  modelLightDramatic: "Dramatic",
  modelExplode: "Explode",
  modelTurntable: "Turntable",
  fontStylesUnit: "styles",
  fontTabSpecimen: "Specimen",
  fontTabWaterfall: "Waterfall",
  fontTabGlyphs: "Glyphs",
  fontPaperLight: "Light Paper",
  fontPaperDark: "Dark Paper",
  fontSizeLabel: "Size",
  fontTrackingLabel: "Tracking",
  fontLeadingLabel: "Leading",
  fontCopiedGlyph: "Copied glyph",
  gifFramesUnit: "frames",
  gifPrevFrame: "Previous frame",
  gifNextFrame: "Next frame",
  gifScrubLabel: "GIF frame scrubber",
};

const ZH_MESSAGES: AtlasMessages = {
  defaultLibraryName: "Atlas 资料库",
  localLibrarySub: (count) => `共 ${count} 项 · 本地资料库`,
  itemCount: (count) => `${count} 项`,

  navAll: "全部",
  navInbox: "收件箱",
  navLikes: "喜欢",
  navLinks: "链接",
  navUntagged: "未标签",
  navTrash: "废纸篓",
  sectionCollections: "合集",
  sectionTags: "标签",

  menuNewCollection: "新建合集",
  menuNewTagFolder: "新建标签文件夹",
  menuNewTag: "新建标签",
  menuNewFolder: "新建文件夹",
  menuShowCollections: "显示「合集」分区",
  menuShowTags: "显示「标签」分区",
  menuCollapseSection: "收起分区",
  menuExpandSection: "展开分区",
  menuHideSection: "隐藏分区",
  menuSortBy: "排序方式",
  sortNameAsc: "名称（A–Z）",
  sortNameDesc: "名称（Z–A）",
  sortCountDesc: "数量优先",
  menuRenameFolder: "重命名文件夹",
  menuDeleteFolder: "删除文件夹",
  menuMoveToFolder: "移入文件夹",
  menuRemoveFromFolder: "移出文件夹",
  sheetNewFolderTitle: "新建文件夹",
  sheetRenameFolderTitle: "重命名文件夹",
  sheetNewCollectionTitle: "新建合集",
  sheetNewTagTitle: "新建标签",
  sheetFolderPlaceholder: "输入文件夹名称",
  sheetCollectionPlaceholder: "输入合集名称",
  sheetTagPlaceholder: "输入标签名称",
  btnCancel: "取消",
  btnCreate: "创建",
  btnSave: "保存",

  popoverLanguage: "界面语言",
  popoverImportFiles: "导入本地文件…",
  popoverExportLibrary: "导出当前资料库…",
  popoverStorageUsage: "本地存储占用…",
  popoverSettings: "设置…",
  popoverSwitchHint: "当前本地资料库",

  viewGrid: "网格",
  viewCanvas: "白板",
  viewInfinity: "无限",
  searchPlaceholder: "搜索资料库...",
  tooltipToggleSidebar: "切换侧边栏 (⌘B)",
  tooltipFilterLikes: "仅看喜欢的项目",
  tooltipSwitchLight: "切换浅色外观 (D)",
  tooltipSwitchDark: "切换深色外观 (D)",
  tooltipImportImages: "导入本地图片",

  selectedCount: (count) => `已选 ${count} 项`,
  dockLike: "喜欢",
  dockTrash: "移到废纸篓",
  dockRestore: "恢复",
  dockClear: "取消选择",
  dockReset: "重置",
  dockTidyGrid: "整理布局",
  dockPackPile: "聚拢选中",
  dockResetView: "重置视图",
  dockRecenter: "回到中心",
  dockExportFiles: (count) => `导出 ${count} 个文件`,
  dockLayoutJustified: "等高瀑布流",
  dockLayoutSquare: "方形网格",
  dockLayoutFit: "完整比例",
  dockCustomize: "自定义外观",
  customizeAppearance: "外观模式",
  customizeLight: "浅色",
  customizeDark: "深色",
  customizeSpacing: "卡片间距",
  customizeCornerRadius: "圆角大小",

  canvasToolSelect: "选择与推挤 (V)",
  canvasToolHand: "拖动画布 (H / 空格)",
  canvasToolImport: "导入图片到白板",
  canvasToolPack: "整理布局",
  canvasToolNote: "便签",
  canvasToolComment: "批注",
  canvasToolFind: "在白板中查找 (⌘F)",
  canvasZoomIn: "放大画布",
  canvasZoomOut: "缩小画布",
  canvasFitView: "适应全部内容 (0)",
  canvasFindPlaceholder: "在白板中搜索卡片、便签或批注…",
  canvasFindPrev: "上一处匹配",
  canvasFindNext: "下一处匹配",
  canvasFindClose: "关闭查找",
  canvasCommentPlaceholder: "添加一条批注",
  canvasCommentSubmit: "发送批注",
  canvasReplyBtn: "回复",
  canvasReplyPlaceholder: "输入回复内容…",
  canvasResolveComment: "已解决",
  canvasCommentClickHint: "点击白板任意位置即可放置批注",
  canvasNoteTitlePlaceholder: "便签标题…",
  canvasNoteBodyPlaceholder: "记录灵感方向、修改建议或分组说明…",
  canvasNoteLinkPlaceholder: "https://参考链接.com",
  canvasFmtEmoji: "添加表情",
  canvasFmtTextSize: "字号切换",
  canvasFmtBold: "加粗",
  canvasFmtItalic: "斜体",
  canvasFmtUnderline: "下划线",
  canvasFmtCode: "等宽代码",
  canvasFmtColor: "卡片色调",
  canvasFmtList: "项目列表",
  canvasFmtLink: "附加链接",
  canvasFmtDeleteNote: "删除便签",
  canvasPanHint: "按住任意位置即可拖动画布",
  canvasAuthorYou: "我",
  canvasJustNow: "刚刚",

  cardOpenQuickLook: "快速预览",
  cardLike: "喜欢",
  cardUnlike: "取消喜欢",
  cardMoveToCollection: "移动到合集",
  cardInboxNoCollection: "收件箱（未分类）",
  cardMoveToTrash: "移到废纸篓",
  cardRestoreFromTrash: "从废纸篓恢复",
  emptyNothingTitle: "这里还没有内容",
  emptyTrashSub: "废纸篓为空。",
  emptyDefaultSub: "尝试清除筛选条件，或直接拖入本地图片添加到资料库。",
  emptyCanvasTitle: "空白白板",
  emptyCanvasSub: "选择一个合集或清空搜索词，即可自由排布灵感卡片。",
  emptyInfinityTitle: "无限画布为空",
  emptyInfinitySub: "切换到其他分区以无边界浏览视觉参考。",
  dropOverlayText: "松开鼠标即可导入到 Atlas 资料库",
  dragReturnHint: "↩ 松开回到原位",
  dragTargetMoveTo: (name) => `→ ${name}`,
  dragTargetAddTag: (tag) => `+ #${tag}`,
  dragTargetLike: "♥ 移入喜欢",
  dragTargetTrash: "→ 废纸篓",

  qlBackToBoard: "返回画板 (Esc)",
  qlImage: "图片",
  qlVideo: "视频",
  qlLink: "链接",
  qlAuto: "适应",
  qlInspectorTitle: "标题",
  qlInspectorPalette: "主色板",
  qlInspectorCollection: "所属合集",
  qlInspectorInboxUnsorted: "收件箱（未归档）",
  qlInspectorTags: "标签",
  qlInspectorAddTagPlaceholder: "输入 #标签 后按回车",
  qlInspectorNotes: "备注",
  qlInspectorNotesPlaceholder: "添加灵感与参考备注...",
  qlCopyFilename: "复制文件名",
  qlExportOriginal: "导出原图",

  toastShuffled: "已随机重排网格",
  toastTidyCanvas: "已将白板聚拢为整齐布局",
  toastPackedPile: "已将选中卡片聚拢成堆",
  toastRestored: "已恢复项目",
  toastMovedToTrash: "已移到废纸篓",
  toastBatchMovedTo: (count, dest) => `已将 ${count} 项移入「${dest}」`,
  toastBatchTagged: (count, tag) => `已为 ${count} 项添加标签 #${tag}`,
  toastBatchLiked: (count) => `已将 ${count} 项标记为喜欢`,
  toastBatchTrashed: (count) => `已将 ${count} 项移到废纸篓`,
  toastImported: (count) => `已导入 ${count} 张图片`,
  toastExporting: (count, fmt) => `正在导出 ${count} 个文件（${fmt}）`,
  toastCreatedFolder: (name) => `已创建文件夹「${name}」`,
  toastCreatedCollection: (name) => `已创建合集「${name}」`,
  toastCreatedTag: (name) => `已创建标签 #${name}`,
  toastNestedTag: (tag, folder) => `已将 #${tag} 移入「${folder}」`,
  toastLanguageSwitched: "界面语言已切换为简体中文",
  toastCacheCleared: "已清理缩略图缓存（释放 14.2 MB）",
  toastSettingsReset: "已恢复 macOS 默认设置",
  toastUpToDate: "Atlas 2.4.0 已是最新版本",
  toastPathRevealed: "已在访达中定位资料库位置",

  settingsTitle: "设置",
  settingsSearchPlaceholder: "搜索设置",
  settingsNoSearchResults: "没有找到匹配的设置项",
  settingsResetDefaults: "恢复默认",

  catGeneral: "通用",
  catGeneralDesc: "语言、启动视图以及日常资料库交互行为",
  catAppearance: "外观",
  catAppearanceDesc: "深浅色主题、卡片几何比例、间距密度与角标",
  catMotion: "动效与预览",
  catMotionDesc: "快速预览主图变形、周围图片径向避让与遮罩通透度",
  catSpatial: "白板与无限",
  catSpatialDesc: "白板惯性物理、整理密度与滚轮缩放习惯",
  catStorage: "资料库与存储",
  catStorageDesc: "本地资料库路径、导出命名模板与存储空间占用",
  catShortcuts: "快捷键",
  catShortcutsDesc: "覆盖网格、白板与无限视图的原生 macOS 快捷键",
  catAbout: "关于 Atlas",
  catAboutDesc: "版本信息、发布通道与本地空间渲染引擎说明",

  setLangTitle: "界面语言",
  setLangDesc: "实时切换全部菜单、侧边栏、预览与设置面板语言",
  setDefaultViewTitle: "默认启动视图",
  setDefaultViewDesc: "打开资料库时默认进入的浏览模式",
  setShowCountsTitle: "显示项目计数",
  setShowCountsDesc: "在侧边栏与顶部标题栏显示实时数量角标",
  setAutoFocusImportTitle: "导入后自动聚焦",
  setAutoFocusImportDesc: "拖入或导入新素材后自动高亮新卡片",
  setConfirmTrashTitle: "安全删除保护",
  setConfirmTrashDesc: "移入废纸篓的素材保留完整元数据并支持随时恢复",

  setThemeTitle: "外观主题",
  setThemeDesc: "全局同步原生浅色与深色磨砂视觉层",
  setGridLayoutTitle: "网格排列样式",
  setGridLayoutDesc: "控制网格视图中的卡片排布与裁切方式",
  setZoomTitle: "卡片缩放比例",
  setZoomDesc: "实时调节网格、白板与无限画布的卡片尺寸",
  setSpacingTitle: "卡片间距",
  setSpacingDesc: "卡片之间的视觉留白宽度",
  setRadiusTitle: "卡片圆角",
  setRadiusDesc: "苹果风格的平滑圆角弧度",
  setShowBadgesTitle: "显示媒体角标",
  setShowBadgesDesc: "在卡片角落显示视频时长标签与来源域名胶囊",

  setRadialPushTitle: "周围图片径向避让",
  setRadialPushDesc: "打开大图时将周围卡片顺滑挤开，关闭时同频聚拢回位",
  setMotionSpeedTitle: "预览过渡节奏",
  setMotionSpeedDesc: "控制主图放大与回落的 Apple 缓动时长",
  speedSnappy: "利落",
  speedDefault: "标准",
  speedSilky: "柔和",
  setVeilOpacityTitle: "预览遮罩浓度",
  setVeilOpacityDesc: "调节大图预览时背景画廊的隐约通透程度",
  setAutoInspectorTitle: "预览时自动展开检查器",
  setAutoInspectorDesc: "打开大图时自动显示右侧色板、标签与备注栏",

  setInertiaTitle: "画布惯性滑动",
  setInertiaDesc: "在白板与无限视图拖拽后保留顺滑的减速滑行",
  setTidyDensityTitle: "整理网格密度",
  setTidyDensityDesc: "点击「整理网格」时白板卡片的排布松紧度",
  densityCompact: "紧凑",
  densityBalanced: "均衡",
  densitySpacious: "舒展",
  setWheelZoomTitle: "滚轮缩放方式",
  setWheelZoomDesc: "设置双指/⌘+滚轮缩放，或直接使用滚轮缩放画布",
  wheelPinch: "⌘ + 滚轮",
  wheelDirect: "直接滚轮",

  setLibraryNameTitle: "资料库显示名称",
  setLibraryNameDesc: "显示于左下角资料库切换按钮与顶部栏",
  setStoragePathTitle: "资料库存储位置",
  btnChange: "更改...",
  btnReveal: "打开",
  setFileNamePatternTitle: "导出文件名格式",
  setFileNamePatternDesc: "可用占位符：{yyyy} {MM} {dd} {title}",
  setExportFormatTitle: "导出图片格式",
  setExportFormatDesc: "批量导出或单图导出时的首选封装格式",
  formatOriginal: "原图格式",
  setStorageBreakdownTitle: "本地存储占用",
  setStorageBreakdownDesc: (totalMb, count) =>
    `共 ${count} 份本地视觉参考，已使用 ${totalMb} MB`,
  storageLegendImages: "图片",
  storageLegendVideos: "视频",
  storageLegendCache: "缩略图缓存",
  btnClearCache: "清理缓存",

  storageOfTotalUsed: (totalGb) => `已使用 / 共 ${totalGb} GB`,
  storageRescan: "重新扫描",
  storageCalculating: "正在计算",
  storageClearingCaches: "正在清理缓存",
  storageEmptyingTrash: "正在清倒废纸篓",
  storageHoverPrompt: "悬停在任意分区上以查看其具体内容",
  storageLiveQuotaLabel: "浏览器存储配额",
  storageFreedSummary: (freed, avail) => `已释放 ${freed}，当前可用 ${avail}`,
  storageFooterScanning: "正在查找可以安全清理的空间占用…",
  storageFooterReclaiming: "正在释放本地磁盘空间…",
  storageFooterCachesHint: (gb) =>
    `缓存占用了 ${gb}。应用程序会在需要时自动重建它们。`,
  storageFooterTrashHint: (gb) =>
    `废纸篓中保留了 ${gb} 你已删除的文件。`,
  storageFooterAllClean: "当前没有其他值得清理的空间占用。",
  storageBtnClearCaches: "清理缓存",
  storageBtnEmptyTrash: "清倒废纸篓",
  toastCachesFreed: (gb) => `已清理本地缓存（释放 ${gb}）`,
  toastTrashEmptied: (gb) => `已清倒废纸篓（释放 ${gb}）`,

  scToggleSidebar: "展开 / 收起侧边栏",
  scFocusSearch: "聚焦搜索框",
  scOpenSettings: "打开设置窗口",
  scSwitchViews: "切换 网格 / 白板 / 无限",
  scQuickLook: "关闭快速预览",
  scNavigateItems: "切换上一张 / 下一张",
  scToggleInspector: "展开 / 收起检查器",
  scLikeItem: "收藏当前预览图片",
  scToggleTheme: "切换浅色 / 深色外观",
  scShuffleGrid: "随机重排网格",

  aboutTagline: "专为 macOS 打造的本地空间视觉灵感库",
  aboutVersion: "版本 2.4.0 (Build 2408)",
  aboutEngine: "空间 GPU 合成引擎 · 零闪烁共享元素过渡",
  aboutCheckUpdates: "检查更新",
  aboutBuildChannel: "更新通道",
  aboutBuildChannelValue: "正式版 (macOS 通用架构)",
  aboutLicense: "数据隐私",
  aboutLicenseValue: "100% 本地优先 · 离线可用",

  sectionMedia: "媒体类型",
  navModels3d: "3D 模型",
  navAudio: "音频",
  navFonts: "字体",
  navGifs: "GIF 动图",
  qlAudio: "音频",
  qlModel3d: "3D 模型",
  qlFont: "字体",
  qlGif: "GIF 动图",
  mediaPlay: "播放",
  mediaPause: "暂停",
  mediaLoop: "循环",
  videoScrubLabel: "视频进度条",
  videoPopOutPip: "浮窗播放（无缝衔接不中断）",
  videoPipShort: "浮窗",
  videoPipWindowLabel: "悬浮画中画播放器",
  videoReturnQuickLook: "回到快速预览",
  videoDockToCard: "归位至卡片继续播放",
  videoClosePip: "关闭悬浮播放",
  audioScrubLabel: "音频进度条",
  audioVolume: "音量",
  audioMute: "静音",
  audioUnmute: "取消静音",
  audioMuted: "已静音",
  modelVerts: "顶点",
  modelTris: "三角面",
  modelShowControls: "展开控制台",
  modelHideControls: "收起控制台",
  modelMatPbr: "原材质",
  modelMatClay: "白模",
  modelMatWire: "线框",
  modelLightStudio: "摄影棚",
  modelLightWarm: "暖光",
  modelLightDramatic: "暗调",
  modelExplode: "拆解视图",
  modelTurntable: "自动旋转",
  fontStylesUnit: "个字重",
  fontTabSpecimen: "自由试字",
  fontTabWaterfall: "阶梯字号",
  fontTabGlyphs: "字符集",
  fontPaperLight: "浅色画纸",
  fontPaperDark: "深色画纸",
  fontSizeLabel: "字号",
  fontTrackingLabel: "字距",
  fontLeadingLabel: "行高",
  fontCopiedGlyph: "已复制字符",
  gifFramesUnit: "帧",
  gifPrevFrame: "上一帧",
  gifNextFrame: "下一帧",
  gifScrubLabel: "GIF 帧进度",
};

export function getMessages(locale: AppLocale): AtlasMessages {
  return locale === "zh-CN" ? ZH_MESSAGES : EN_MESSAGES;
}

export function getDisplayLibraryName(settings: AppSettings): string {
  const custom = settings.libraryName.trim();
  if (custom.length > 0) return custom;
  return getMessages(settings.locale).defaultLibraryName;
}

export interface SettingsCategoryMeta {
  id: SettingsCategoryId;
  keywords: string[];
}

export const SETTINGS_CATEGORIES: readonly SettingsCategoryMeta[] = [
  {
    id: "general",
    keywords: [
      "general",
      "language",
      "chinese",
      "english",
      "startup",
      "default",
      "count",
      "trash",
      "import",
      "通用",
      "语言",
      "中文",
      "英文",
      "翻译",
      "启动",
      "计数",
      "废纸篓",
    ],
  },
  {
    id: "appearance",
    keywords: [
      "appearance",
      "theme",
      "dark",
      "light",
      "grid",
      "zoom",
      "spacing",
      "radius",
      "corner",
      "badge",
      "外观",
      "主题",
      "深色",
      "浅色",
      "网格",
      "缩放",
      "间距",
      "圆角",
      "角标",
    ],
  },
  {
    id: "motion",
    keywords: [
      "motion",
      "animation",
      "preview",
      "quicklook",
      "radial",
      "push",
      "speed",
      "veil",
      "opacity",
      "inspector",
      "动效",
      "预览",
      "避让",
      "挤开",
      "速度",
      "遮罩",
      "检查器",
    ],
  },
  {
    id: "spatial",
    keywords: [
      "canvas",
      "infinity",
      "whiteboard",
      "inertia",
      "momentum",
      "tidy",
      "wheel",
      "scroll",
      "zoom",
      "白板",
      "无限",
      "惯性",
      "整理",
      "滚轮",
    ],
  },
  {
    id: "storage",
    keywords: [
      "library",
      "storage",
      "path",
      "folder",
      "filename",
      "export",
      "png",
      "jpg",
      "cache",
      "资料库",
      "存储",
      "位置",
      "路径",
      "文件名",
      "导出",
      "格式",
      "缓存",
    ],
  },
  {
    id: "shortcuts",
    keywords: [
      "shortcut",
      "keyboard",
      "hotkey",
      "command",
      "key",
      "快捷键",
      "键盘",
    ],
  },
  {
    id: "about",
    keywords: ["about", "version", "update", "atlas", "关于", "版本", "更新"],
  },
];

export function filterSettingsCategories(
  query: string,
  locale: AppLocale,
): SettingsCategoryId[] {
  const q = query.trim().toLowerCase();
  if (!q) return SETTINGS_CATEGORIES.map((c) => c.id);
  const m = getMessages(locale);
  const labelMap: Record<SettingsCategoryId, string> = {
    general: `${m.catGeneral} ${m.catGeneralDesc}`,
    appearance: `${m.catAppearance} ${m.catAppearanceDesc}`,
    motion: `${m.catMotion} ${m.catMotionDesc}`,
    spatial: `${m.catSpatial} ${m.catSpatialDesc}`,
    storage: `${m.catStorage} ${m.catStorageDesc}`,
    shortcuts: `${m.catShortcuts} ${m.catShortcutsDesc}`,
    about: `${m.catAbout} ${m.catAboutDesc}`,
  };
  return SETTINGS_CATEGORIES.filter(
    (c) =>
      labelMap[c.id].toLowerCase().includes(q) ||
      c.keywords.some((kw) => kw.includes(q)),
  ).map((c) => c.id);
}
