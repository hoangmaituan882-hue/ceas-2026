import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AtlasStarIcon,
  ChevronUpDownIcon,
  FolderOpenIcon,
  HardDriveIcon,
  KeyboardIcon,
  LayersIcon,
  PaletteIcon,
  RefreshIcon,
  SearchIcon,
  SettingsGearIcon,
  SparklesIcon,
} from "./AppIcons";
import { ElasticMotionBar } from "./ElasticMotionBar";
import {
  clampVeilOpacity,
  filterSettingsCategories,
  getDisplayLibraryName,
  getMessages,
  type AppLocale,
  type AppSettings,
  type CanvasTidyDensity,
  type ExportFormat,
  type QuickLookSpeed,
  type SettingsCategoryId,
  type WheelZoomMode,
} from "./i18n";
import {
  clampRadius,
  clampSpacing,
  clampZoom,
  type AppearancePrefs,
  type GridLayoutMode,
  type LibraryItem,
  type ViewMode,
} from "./library-engine";
import { StorageDiskAnalyzer } from "./StorageDiskAnalyzer";
import { formatGb } from "./storage-analyzer";

export interface SettingsModalProps {
  open: boolean;
  initialCategory?: SettingsCategoryId;
  settings: AppSettings;
  appearance: AppearancePrefs;
  items: readonly LibraryItem[];
  onClose: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onUpdateAppearance: (patch: Partial<AppearancePrefs>) => void;
  onResetDefaults: () => void;
  onEmptyTrash?: () => void;
  onNotify: (message: string) => void;
}

interface CategoryVisual {
  id: SettingsCategoryId;
  color: string;
  gradient: string;
  icon: (size: number) => ReactNode;
}

const CATEGORY_VISUALS: readonly CategoryVisual[] = [
  {
    id: "general",
    color: "#8e8e93",
    gradient: "linear-gradient(180deg, #9d9da3 0%, #7c7c82 100%)",
    icon: (size) => <SettingsGearIcon size={size} />,
  },
  {
    id: "appearance",
    color: "#ff2d55",
    gradient: "linear-gradient(180deg, #ff4568 0%, #e61e46 100%)",
    icon: (size) => <PaletteIcon size={size} />,
  },
  {
    id: "motion",
    color: "#007aff",
    gradient: "linear-gradient(180deg, #2590ff 0%, #006ee6 100%)",
    icon: (size) => <SparklesIcon size={size} />,
  },
  {
    id: "spatial",
    color: "#af52de",
    gradient: "linear-gradient(180deg, #bf67eb 0%, #993ec7 100%)",
    icon: (size) => <LayersIcon size={size} />,
  },
  {
    id: "storage",
    color: "#ff9500",
    gradient: "linear-gradient(180deg, #ffa726 0%, #e68200 100%)",
    icon: (size) => <HardDriveIcon size={size} />,
  },
  {
    id: "shortcuts",
    color: "#636366",
    gradient: "linear-gradient(180deg, #747478 0%, #525256 100%)",
    icon: (size) => <KeyboardIcon size={size} />,
  },
  {
    id: "about",
    color: "#0a84ff",
    gradient: "linear-gradient(180deg, #3298ff 0%, #0070e0 100%)",
    icon: (size) => <AtlasStarIcon size={size} />,
  },
];

function MacSwitch({
  checked,
  onChange,
  ariaLabel,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`mac-switch ${checked ? "mac-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="mac-switch-thumb" />
    </button>
  );
}

function MacSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  testId,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
  ariaLabel: string;
  testId?: string;
}) {
  return (
    <div className="mac-select-wrap">
      <select
        className="mac-select"
        value={value}
        aria-label={ariaLabel}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="mac-select-chevron" aria-hidden="true">
        <ChevronUpDownIcon size={12} />
      </span>
    </div>
  );
}

function MacSegmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  testIdPrefix,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
  ariaLabel: string;
  testIdPrefix?: string;
}) {
  return (
    <div className="mac-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={
              testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined
            }
            className={`mac-seg-btn ${active ? "mac-seg-btn--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MacSlider({
  value,
  min,
  max,
  step,
  displayValue,
  ariaLabel,
  testId,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  ariaLabel: string;
  testId?: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="mac-slider-group">
      <span className="mac-slider-val">{displayValue}</span>
      <ElasticMotionBar
        min={min}
        max={max}
        step={step}
        value={value}
        size="md"
        width={156}
        ariaLabel={ariaLabel}
        testId={testId}
        onChange={onChange}
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <div className="settings-row-title">{title}</div>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

export function SettingsModal({
  open,
  initialCategory = "general",
  settings,
  appearance,
  items,
  onClose,
  onUpdateSettings,
  onUpdateAppearance,
  onResetDefaults,
  onEmptyTrash,
  onNotify,
}: SettingsModalProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategoryId>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [cacheCleared, setCacheCleared] = useState(false);
  const [trashEmptied, setTrashEmptied] = useState(false);

  const m = useMemo(() => getMessages(settings.locale), [settings.locale]);

  // Sync active tab when Settings opens (e.g. direct jump from "Storage Usage…" popover item)
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setActiveCategory(initialCategory);
    }
  }, [open, initialCategory]);

  const visibleCategoryIds = useMemo(
    () => filterSettingsCategories(searchQuery, settings.locale),
    [searchQuery, settings.locale],
  );

  // If search filters out the active category, jump smoothly to the first match
  useEffect(() => {
    const firstVisible = visibleCategoryIds[0];
    if (firstVisible && !visibleCategoryIds.includes(activeCategory)) {
      setActiveCategory(firstVisible);
    }
  }, [visibleCategoryIds, activeCategory]);

  // Close with Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const categoryCopy: Record<
    SettingsCategoryId,
    { title: string; desc: string }
  > = {
    general: { title: m.catGeneral, desc: m.catGeneralDesc },
    appearance: { title: m.catAppearance, desc: m.catAppearanceDesc },
    motion: { title: m.catMotion, desc: m.catMotionDesc },
    spatial: { title: m.catSpatial, desc: m.catSpatialDesc },
    storage: { title: m.catStorage, desc: m.catStorageDesc },
    shortcuts: { title: m.catShortcuts, desc: m.catShortcutsDesc },
    about: { title: m.catAbout, desc: m.catAboutDesc },
  };

  const activeVisual =
    CATEGORY_VISUALS.find((c) => c.id === activeCategory) ??
    CATEGORY_VISUALS[0]!;

  const handleCycleStoragePath = () => {
    const presets = [
      "~/Pictures/Atlas Library.atlas",
      "~/Documents/Atlas/Studio.atlas",
      "~/iCloud Drive/Atlas Library.atlas",
    ];
    const currentIdx = presets.indexOf(settings.storagePath);
    const nextPath = presets[(currentIdx + 1) % presets.length] ?? presets[0]!;
    onUpdateSettings({ storagePath: nextPath });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="settings-backdrop"
          data-testid="settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={m.settingsTitle}
            className="settings-window"
            data-testid="settings-modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Left macOS System Settings Sidebar */}
            <aside className="settings-sidebar">
              <div className="settings-sidebar-top">
                <div className="settings-traffic-row">
                  <button
                    type="button"
                    className="mac-dot mac-dot--r settings-dot-close"
                    data-testid="settings-close-btn"
                    onClick={onClose}
                    aria-label={m.btnCancel}
                    title="Esc"
                  />
                  <span className="mac-dot mac-dot--y" aria-hidden="true" />
                  <span className="mac-dot mac-dot--g" aria-hidden="true" />
                </div>

                <h2 className="settings-sidebar-heading">{m.settingsTitle}</h2>

                <label className="settings-search-box">
                  <SearchIcon size={13} />
                  <input
                    type="text"
                    className="settings-search-input"
                    data-testid="settings-search-input"
                    placeholder={m.settingsSearchPlaceholder}
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
              </div>

              <nav
                className="settings-nav-list"
                aria-label={m.settingsTitle}
              >
                {visibleCategoryIds.length === 0 ? (
                  <div className="settings-nav-empty">
                    {m.settingsNoSearchResults}
                  </div>
                ) : (
                  visibleCategoryIds.map((catId) => {
                    const visual = CATEGORY_VISUALS.find((v) => v.id === catId)!;
                    const active = activeCategory === catId;
                    return (
                      <button
                        key={catId}
                        type="button"
                        data-testid={`settings-cat-${catId}`}
                        className={`settings-nav-item ${
                          active ? "settings-nav-item--active" : ""
                        }`}
                        onClick={() => setActiveCategory(catId)}
                      >
                        <span
                          className="settings-cat-badge"
                          style={{
                            background: active
                              ? "rgba(255, 255, 255, 0.22)"
                              : visual.gradient,
                          }}
                        >
                          {visual.icon(13)}
                        </span>
                        <span className="settings-nav-label">
                          {categoryCopy[catId].title}
                        </span>
                      </button>
                    );
                  })
                )}
              </nav>

              <div className="settings-sidebar-footer">
                <button
                  type="button"
                  className="settings-reset-link"
                  onClick={() => {
                    onResetDefaults();
                    setCacheCleared(false);
                    setTrashEmptied(false);
                  }}
                >
                  <RefreshIcon size={12} />
                  <span>{m.settingsResetDefaults}</span>
                </button>
              </div>
            </aside>

            {/* Right Detail Pane */}
            <div className="settings-main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeCategory}
                  className="settings-pane"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Hero Category Header (1:1 macOS Sequoia Settings Header) */}
                  <header className="settings-hero">
                    <div
                      className="settings-hero-badge"
                      style={{
                        background: activeVisual.gradient,
                        boxShadow: `0 8px 20px ${activeVisual.color}38`,
                      }}
                    >
                      {activeVisual.icon(22)}
                    </div>
                    <div className="settings-hero-copy">
                      <h3 className="settings-hero-title">
                        {categoryCopy[activeCategory].title}
                      </h3>
                      <p className="settings-hero-desc">
                        {categoryCopy[activeCategory].desc}
                      </p>
                    </div>
                  </header>

                  {/* ── 1. GENERAL ── */}
                  {activeCategory === "general" && (
                    <div className="settings-card">
                      <SettingRow
                        title={m.setLangTitle}
                        description={m.setLangDesc}
                        control={
                          <MacSegmented<AppLocale>
                            value={settings.locale}
                            ariaLabel={m.setLangTitle}
                            testIdPrefix="settings-locale"
                            options={[
                              { value: "en", label: "English" },
                              { value: "zh-CN", label: "简体中文" },
                            ]}
                            onChange={(locale) => {
                              onUpdateSettings({ locale });
                              onNotify(getMessages(locale).toastLanguageSwitched);
                            }}
                          />
                        }
                      />

                      <SettingRow
                        title={m.setDefaultViewTitle}
                        description={m.setDefaultViewDesc}
                        control={
                          <MacSelect<ViewMode>
                            value={settings.defaultView}
                            ariaLabel={m.setDefaultViewTitle}
                            testId="settings-default-view"
                            options={[
                              { value: "grid", label: m.viewGrid },
                              { value: "canvas", label: m.viewCanvas },
                              { value: "infinity", label: m.viewInfinity },
                            ]}
                            onChange={(defaultView) =>
                              onUpdateSettings({ defaultView })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setShowCountsTitle}
                        description={m.setShowCountsDesc}
                        control={
                          <MacSwitch
                            checked={settings.showItemCounts}
                            ariaLabel={m.setShowCountsTitle}
                            testId="settings-show-counts"
                            onChange={(showItemCounts) =>
                              onUpdateSettings({ showItemCounts })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setAutoFocusImportTitle}
                        description={m.setAutoFocusImportDesc}
                        control={
                          <MacSwitch
                            checked={settings.autoFocusImported}
                            ariaLabel={m.setAutoFocusImportTitle}
                            onChange={(autoFocusImported) =>
                              onUpdateSettings({ autoFocusImported })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setConfirmTrashTitle}
                        description={m.setConfirmTrashDesc}
                        control={
                          <MacSwitch
                            checked={settings.confirmBeforeTrash}
                            ariaLabel={m.setConfirmTrashTitle}
                            onChange={(confirmBeforeTrash) =>
                              onUpdateSettings({ confirmBeforeTrash })
                            }
                          />
                        }
                      />
                    </div>
                  )}

                  {/* ── 2. APPEARANCE ── */}
                  {activeCategory === "appearance" && (
                    <>
                      <div className="settings-card">
                        <SettingRow
                          title={m.setThemeTitle}
                          description={m.setThemeDesc}
                          control={
                            <MacSegmented<"light" | "dark">
                              value={appearance.theme}
                              ariaLabel={m.setThemeTitle}
                              testIdPrefix="settings-theme"
                              options={[
                                { value: "light", label: m.customizeLight },
                                { value: "dark", label: m.customizeDark },
                              ]}
                              onChange={(theme) => onUpdateAppearance({ theme })}
                            />
                          }
                        />

                        <SettingRow
                          title={m.setGridLayoutTitle}
                          description={m.setGridLayoutDesc}
                          control={
                            <MacSelect<GridLayoutMode>
                              value={appearance.gridLayout}
                              ariaLabel={m.setGridLayoutTitle}
                              options={[
                                {
                                  value: "justified",
                                  label: m.dockLayoutJustified,
                                },
                                {
                                  value: "square",
                                  label: m.dockLayoutSquare,
                                },
                                { value: "fit", label: m.dockLayoutFit },
                              ]}
                              onChange={(gridLayout) =>
                                onUpdateAppearance({ gridLayout })
                              }
                            />
                          }
                        />
                      </div>

                      <div className="settings-card">
                        <SettingRow
                          title={m.setZoomTitle}
                          description={m.setZoomDesc}
                          control={
                            <MacSlider
                              value={appearance.zoom}
                              min={0.65}
                              max={2.4}
                              step={0.05}
                              displayValue={`×${appearance.zoom.toFixed(1)}`}
                              ariaLabel={m.setZoomTitle}
                              onChange={(z) =>
                                onUpdateAppearance({ zoom: clampZoom(z) })
                              }
                            />
                          }
                        />

                        <SettingRow
                          title={m.setSpacingTitle}
                          description={m.setSpacingDesc}
                          control={
                            <MacSlider
                              value={appearance.spacing}
                              min={4}
                              max={28}
                              step={2}
                              displayValue={`${appearance.spacing}px`}
                              ariaLabel={m.setSpacingTitle}
                              onChange={(s) =>
                                onUpdateAppearance({ spacing: clampSpacing(s) })
                              }
                            />
                          }
                        />

                        <SettingRow
                          title={m.setRadiusTitle}
                          description={m.setRadiusDesc}
                          control={
                            <MacSlider
                              value={appearance.radius}
                              min={0}
                              max={20}
                              step={2}
                              displayValue={`${appearance.radius}px`}
                              ariaLabel={m.setRadiusTitle}
                              onChange={(r) =>
                                onUpdateAppearance({ radius: clampRadius(r) })
                              }
                            />
                          }
                        />

                        <SettingRow
                          title={m.setShowBadgesTitle}
                          description={m.setShowBadgesDesc}
                          control={
                            <MacSwitch
                              checked={settings.showCardBadges}
                              ariaLabel={m.setShowBadgesTitle}
                              testId="settings-show-badges"
                              onChange={(showCardBadges) =>
                                onUpdateSettings({ showCardBadges })
                              }
                            />
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* ── 3. MOTION & PREVIEW ── */}
                  {activeCategory === "motion" && (
                    <div className="settings-card">
                      <SettingRow
                        title={m.setRadialPushTitle}
                        description={m.setRadialPushDesc}
                        control={
                          <MacSwitch
                            checked={settings.radialNeighborPush}
                            ariaLabel={m.setRadialPushTitle}
                            testId="settings-radial-push"
                            onChange={(radialNeighborPush) =>
                              onUpdateSettings({ radialNeighborPush })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setMotionSpeedTitle}
                        description={m.setMotionSpeedDesc}
                        control={
                          <MacSegmented<QuickLookSpeed>
                            value={settings.quickLookSpeed}
                            ariaLabel={m.setMotionSpeedTitle}
                            options={[
                              { value: "snappy", label: m.speedSnappy },
                              { value: "default", label: m.speedDefault },
                              { value: "silky", label: m.speedSilky },
                            ]}
                            onChange={(quickLookSpeed) =>
                              onUpdateSettings({ quickLookSpeed })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setVeilOpacityTitle}
                        description={m.setVeilOpacityDesc}
                        control={
                          <MacSlider
                            value={Math.round(settings.veilOpacity * 100)}
                            min={72}
                            max={100}
                            step={2}
                            displayValue={`${Math.round(settings.veilOpacity * 100)}%`}
                            ariaLabel={m.setVeilOpacityTitle}
                            onChange={(pct) =>
                              onUpdateSettings({
                                veilOpacity: clampVeilOpacity(pct / 100),
                              })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setAutoInspectorTitle}
                        description={m.setAutoInspectorDesc}
                        control={
                          <MacSwitch
                            checked={settings.autoOpenInspector}
                            ariaLabel={m.setAutoInspectorTitle}
                            onChange={(autoOpenInspector) =>
                              onUpdateSettings({ autoOpenInspector })
                            }
                          />
                        }
                      />
                    </div>
                  )}

                  {/* ── 4. CANVAS & INFINITY ── */}
                  {activeCategory === "spatial" && (
                    <div className="settings-card">
                      <SettingRow
                        title={m.setInertiaTitle}
                        description={m.setInertiaDesc}
                        control={
                          <MacSwitch
                            checked={settings.canvasInertia}
                            ariaLabel={m.setInertiaTitle}
                            onChange={(canvasInertia) =>
                              onUpdateSettings({ canvasInertia })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setTidyDensityTitle}
                        description={m.setTidyDensityDesc}
                        control={
                          <MacSegmented<CanvasTidyDensity>
                            value={settings.canvasTidyDensity}
                            ariaLabel={m.setTidyDensityTitle}
                            options={[
                              { value: "compact", label: m.densityCompact },
                              { value: "balanced", label: m.densityBalanced },
                              { value: "spacious", label: m.densitySpacious },
                            ]}
                            onChange={(canvasTidyDensity) =>
                              onUpdateSettings({ canvasTidyDensity })
                            }
                          />
                        }
                      />

                      <SettingRow
                        title={m.setWheelZoomTitle}
                        description={m.setWheelZoomDesc}
                        control={
                          <MacSelect<WheelZoomMode>
                            value={settings.wheelZoomMode}
                            ariaLabel={m.setWheelZoomTitle}
                            options={[
                              { value: "pinch", label: m.wheelPinch },
                              { value: "direct", label: m.wheelDirect },
                            ]}
                            onChange={(wheelZoomMode) =>
                              onUpdateSettings({ wheelZoomMode })
                            }
                          />
                        }
                      />
                    </div>
                  )}

                  {/* ── 5. LIBRARY & STORAGE ── */}
                  {activeCategory === "storage" && (
                    <>
                      <StorageDiskAnalyzer
                        items={items}
                        theme={appearance.theme}
                        locale={settings.locale}
                        cachesCleared={cacheCleared}
                        trashEmptied={trashEmptied}
                        onClearCaches={(freedGb) => {
                          setCacheCleared(true);
                          onNotify(m.toastCachesFreed(formatGb(freedGb)));
                        }}
                        onEmptyTrash={(freedGb) => {
                          setTrashEmptied(true);
                          onEmptyTrash?.();
                          onNotify(m.toastTrashEmptied(formatGb(freedGb)));
                        }}
                        onRescanReset={() => {
                          // Allow re-inspecting disk after manual rescan
                        }}
                      />

                      <div className="settings-card">
                        <SettingRow
                          title={m.setLibraryNameTitle}
                          description={m.setLibraryNameDesc}
                          control={
                            <input
                              type="text"
                              className="mac-text-pill"
                              data-testid="settings-library-name-input"
                              placeholder={m.defaultLibraryName}
                              value={settings.libraryName}
                              onChange={(e) =>
                                onUpdateSettings({
                                  libraryName: e.target.value,
                                })
                              }
                            />
                          }
                        />

                        <SettingRow
                          title={m.setStoragePathTitle}
                          description={settings.storagePath}
                          control={
                            <div className="settings-btn-row">
                              <button
                                type="button"
                                className="mac-soft-btn"
                                onClick={handleCycleStoragePath}
                              >
                                {m.btnChange}
                              </button>
                              <button
                                type="button"
                                className="mac-ghost-icon-btn"
                                onClick={() => onNotify(m.toastPathRevealed)}
                              >
                                <FolderOpenIcon size={13} />
                                <span>{m.btnReveal}</span>
                              </button>
                            </div>
                          }
                        />

                        <SettingRow
                          title={m.setFileNamePatternTitle}
                          description={m.setFileNamePatternDesc}
                          control={
                            <input
                              type="text"
                              className="mac-text-pill mac-text-pill--mono"
                              value={settings.fileNamePattern}
                              onChange={(e) =>
                                onUpdateSettings({
                                  fileNamePattern: e.target.value,
                                })
                              }
                            />
                          }
                        />

                        <SettingRow
                          title={m.setExportFormatTitle}
                          description={m.setExportFormatDesc}
                          control={
                            <MacSegmented<ExportFormat>
                              value={settings.exportFormat}
                              ariaLabel={m.setExportFormatTitle}
                              options={[
                                { value: "original", label: m.formatOriginal },
                                { value: "png", label: "PNG" },
                                { value: "jpg", label: "JPG" },
                              ]}
                              onChange={(exportFormat) =>
                                onUpdateSettings({ exportFormat })
                              }
                            />
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* ── 6. SHORTCUTS ── */}
                  {activeCategory === "shortcuts" && (
                    <div className="settings-card">
                      {(
                        [
                          [m.scToggleSidebar, ["⌘", "B"]],
                          [m.scFocusSearch, ["⌘", "K"]],
                          [m.scOpenSettings, ["⌘", ","]],
                          [m.scSwitchViews, ["1", "2", "3"]],
                          [m.scQuickLook, ["Space", "Esc"]],
                          [m.scNavigateItems, ["←", "→"]],
                          [m.scToggleInspector, ["I"]],
                          [m.scLikeItem, ["L"]],
                          [m.scToggleTheme, ["D"]],
                          [m.scShuffleGrid, ["S"]],
                        ] as const
                      ).map(([label, keys]) => (
                        <div key={label} className="settings-row">
                          <div className="settings-row-title">{label}</div>
                          <div className="settings-keycaps">
                            {keys.map((k) => (
                              <kbd key={k} className="mac-kbd">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── 7. ABOUT ATLAS ── */}
                  {activeCategory === "about" && (
                    <div className="settings-card">
                      <div className="settings-about-hero">
                        <div className="settings-about-icon">
                          <AtlasStarIcon size={28} />
                        </div>
                        <div className="settings-about-meta">
                          <div className="settings-about-name">
                            {getDisplayLibraryName(settings)}
                          </div>
                          <div className="settings-about-sub">
                            {m.aboutTagline}
                          </div>
                          <div className="settings-about-ver">
                            {m.aboutVersion}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mac-soft-btn"
                          onClick={() => onNotify(m.toastUpToDate)}
                        >
                          {m.aboutCheckUpdates}
                        </button>
                      </div>

                      <SettingRow
                        title={m.aboutBuildChannel}
                        control={
                          <span className="settings-static-val">
                            {m.aboutBuildChannelValue}
                          </span>
                        }
                      />

                      <SettingRow
                        title={m.aboutLicense}
                        control={
                          <span className="settings-static-val">
                            {m.aboutLicenseValue}
                          </span>
                        }
                      />

                      <SettingRow
                        title="Engine"
                        control={
                          <span className="settings-static-val">
                            {m.aboutEngine}
                          </span>
                        }
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
