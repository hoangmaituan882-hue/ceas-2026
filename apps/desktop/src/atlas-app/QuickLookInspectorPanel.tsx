import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon, CopyIcon, MagicWandIcon } from "./AppIcons";
import { getMessages, type AppLocale } from "./i18n";
import {
  distributeSimilarMasonry,
  generateSmartTitleSuggestion,
  rankSimilarItems,
  type SimilarItemMatch,
} from "./inspector-similarity";
import type { CollectionItem, LibraryItem, ThemeMode } from "./library-engine";
import { isRichInteractiveKind } from "./media-helpers";
import { RichMediaCardContent } from "./RichMediaCardContent";

export type InspectorTabId = "info" | "similar";

export interface QuickLookInspectorPanelProps {
  item: LibraryItem;
  allItems: readonly LibraryItem[];
  collections: readonly CollectionItem[];
  theme: ThemeMode;
  locale: AppLocale;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateCollection: (id: string, collectionId: string | null) => void;
  onAddTagToItem: (id: string, tag: string) => void;
  onRemoveTagFromItem: (id: string, tag: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onSelectSimilar: (id: string) => void;
  onCloseMobile?: () => void;
  onNotify: (message: string) => void;
}

const TAB_SLIDE_VARIANTS = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir * 14,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: -dir * 14,
  }),
};

function SimilarMasonryCard({
  match,
  theme,
  index,
  onSelect,
}: {
  match: SimilarItemMatch;
  theme: ThemeMode;
  index: number;
  onSelect: (id: string) => void;
}) {
  const { item, heightRatio, sharedTags } = match;
  const isRich = isRichInteractiveKind(item.kind);
  const aspectCss = `${1} / ${heightRatio.toFixed(3)}`;

  return (
    <motion.button
      type="button"
      className="ql-similar-card"
      data-testid={`inspector-similar-card-${item.id}`}
      style={{ aspectRatio: aspectCss }}
      initial={{ opacity: 0, y: 8, scale: 0.965 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.24,
        delay: Math.min(index * 0.026, 0.22),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.975 }}
      onClick={() => onSelect(item.id)}
      aria-label={item.title}
      title={item.title}
    >
      <div className="ql-similar-card-media">
        {isRich ? (
          <RichMediaCardContent
            item={item}
            theme={theme}
            interactiveAudio={false}
          />
        ) : (
          <img
            src={item.src}
            alt={item.title}
            className="ql-similar-card-img"
            loading="lazy"
            draggable={false}
          />
        )}
      </div>

      {item.kind === "video" && item.duration && (
        <span className="ql-similar-badge">{item.duration}</span>
      )}
      {item.kind === "gif" && <span className="ql-similar-badge">GIF</span>}
      {item.kind === "model3d" && <span className="ql-similar-badge">3D</span>}

      <div className="ql-similar-card-caption">
        <span className="ql-similar-card-title">{item.title}</span>
        {sharedTags.length > 0 && (
          <span className="ql-similar-card-tag">#{sharedTags[0]}</span>
        )}
      </div>
    </motion.button>
  );
}

export function QuickLookInspectorPanel({
  item,
  allItems,
  collections,
  theme,
  locale,
  onUpdateTitle,
  onUpdateCollection,
  onAddTagToItem,
  onRemoveTagFromItem,
  onUpdateNote,
  onSelectSimilar,
  onCloseMobile,
  onNotify,
}: QuickLookInspectorPanelProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  const [activeTab, setActiveTab] = useState<InspectorTabId>("info");
  const [tabDir, setTabDir] = useState<-1 | 1>(1);
  const [newTagInput, setNewTagInput] = useState("");
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [wandCycle, setWandCycle] = useState(0);
  const [wandSpin, setWandSpin] = useState(0);

  useEffect(() => {
    setTitleDraft(item.title);
    setNewTagInput("");
    setWandCycle(0);
  }, [item.id, item.title]);

  const handleSwitchTab = (next: InspectorTabId) => {
    if (next === activeTab) return;
    setTabDir(next === "similar" ? 1 : -1);
    setActiveTab(next);
  };

  const handleTitleCommit = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(item.title);
      return;
    }
    if (trimmed !== item.title) {
      onUpdateTitle(item.id, trimmed);
    }
  };

  const handleMagicTitle = () => {
    const suggested = generateSmartTitleSuggestion(item, locale, wandCycle);
    setWandCycle((c) => c + 1);
    setWandSpin((s) => s + 1);
    setTitleDraft(suggested);
    onUpdateTitle(item.id, suggested);
    onNotify(m.qlInspectorSmartTitleToast(suggested));
  };

  const handleTagFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagInput.trim().replace(/^#+/, "");
    if (!cleaned) return;
    onAddTagToItem(item.id, cleaned);
    setNewTagInput("");
  };

  const similarMatches = useMemo(
    () => rankSimilarItems(item, allItems, 12),
    [item, allItems],
  );
  const [leftCol, rightCol] = useMemo(
    () => distributeSimilarMasonry(similarMatches),
    [similarMatches],
  );

  const isRich = isRichInteractiveKind(item.kind);
  const previewAspect = useMemo(() => {
    if (item.kind === "audio") return 1.15;
    if (item.kind === "font") return 1.05;
    if (item.kind === "model3d") return 1.1;
    const w = item.width > 0 ? item.width : 1200;
    const h = item.height > 0 ? item.height : 1200;
    return Math.max(0.64, Math.min(1.65, w / h));
  }, [item.kind, item.width, item.height]);

  const kindLabel =
    item.kind === "video"
      ? m.qlVideo
      : item.kind === "audio"
        ? m.qlAudio
        : item.kind === "model3d"
          ? m.qlModel3d
          : item.kind === "font"
            ? m.qlFont
            : item.kind === "gif"
              ? m.qlGif
              : item.kind === "link"
                ? m.qlLink
                : m.qlImage;

  return (
    <motion.aside
      className="lightbox-inspector lightbox-inspector--floating"
      data-testid="lightbox-inspector"
      data-active-tab={activeTab}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Mobile drag grabber & close button */}
      <div className="ql-inspector-mobile-chrome">
        <span className="ql-inspector-grabber" aria-hidden="true" />
        {onCloseMobile && (
          <button
            type="button"
            className="ql-inspector-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close Inspector"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </div>

      {/* Centered Segmented Capsule: 信息 | 类似 */}
      <div className="ql-inspector-header">
        <div
          className="ql-inspector-seg"
          role="tablist"
          aria-label="Inspector views"
          data-testid="inspector-tab-capsule"
        >
          {(
            [
              ["info", m.qlInspectorTabInfo],
              ["similar", m.qlInspectorTabSimilar],
            ] as const
          ).map(([tabId, label]) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`inspector-tab-${tabId}`}
                className={`ql-inspector-seg-btn ${
                  active ? "ql-inspector-seg-btn--active" : ""
                }`}
                onClick={() => handleSwitchTab(tabId)}
              >
                {active && (
                  <motion.span
                    layoutId="ql-inspector-tab-pill"
                    className="ql-inspector-seg-pill"
                    transition={{ type: "spring", stiffness: 520, damping: 36 }}
                  />
                )}
                <span className="ql-inspector-seg-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Tab Content Area */}
      <div className="ql-inspector-scroll">
        <AnimatePresence mode="wait" initial={false} custom={tabDir}>
          {activeTab === "info" ? (
            <motion.div
              key={`info-${item.id}`}
              custom={tabDir}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="ql-inspector-pane"
              data-testid="inspector-info-pane"
            >
              {/* Framed Crisp Thumbnail Preview Card */}
              <div
                className="ql-inspector-thumb-card"
                data-testid="inspector-thumbnail-card"
              >
                <div
                  className={`ql-inspector-thumb-frame ${
                    isRich ? "ql-inspector-thumb-frame--rich" : ""
                  }`}
                  style={
                    isRich
                      ? { aspectRatio: `${previewAspect.toFixed(3)} / 1` }
                      : undefined
                  }
                >
                  {isRich ? (
                    <RichMediaCardContent
                      item={item}
                      theme={theme}
                      interactiveAudio={false}
                    />
                  ) : (
                    <img
                      src={item.src}
                      alt={item.title}
                      className="ql-inspector-thumb-img"
                      draggable={false}
                    />
                  )}
                  {item.kind === "video" && item.duration && (
                    <span className="ql-inspector-thumb-pill">
                      ▶ {item.duration}
                    </span>
                  )}
                </div>
              </div>

              {/* Rounded Title Input Bar with Magic Wand Action */}
              <div className="ql-inspector-title-bar">
                <input
                  type="text"
                  className="ql-inspector-title-input"
                  data-testid="inspector-title-input"
                  aria-label={m.qlInspectorTitle}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      setTitleDraft(item.title);
                      e.currentTarget.blur();
                    }
                  }}
                />
                <motion.button
                  type="button"
                  className="ql-inspector-wand-btn"
                  data-testid="inspector-magic-title-btn"
                  title={m.qlInspectorSmartTitleTooltip}
                  aria-label={m.qlInspectorSmartTitleTooltip}
                  onClick={handleMagicTitle}
                  whileTap={{ scale: 0.88 }}
                >
                  <motion.span
                    key={wandSpin}
                    initial={wandSpin > 0 ? { rotate: -26, scale: 0.82 } : false}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 460, damping: 22 }}
                    style={{ display: "inline-flex" }}
                  >
                    <MagicWandIcon size={16} />
                  </motion.span>
                </motion.button>
              </div>

              {/* Compact Spec Strip */}
              <div className="ql-inspector-meta-strip">
                <span className="ql-inspector-spec-chip">{kindLabel}</span>
                <span className="ql-inspector-spec-text">
                  {item.width} × {item.height}
                </span>
                <button
                  type="button"
                  className="ql-inspector-copy-mini"
                  onClick={() => {
                    navigator.clipboard?.writeText(item.filename).catch(() => {});
                    onNotify(item.filename);
                  }}
                  title={m.qlCopyFilename}
                  aria-label={m.qlCopyFilename}
                >
                  <CopyIcon size={12} />
                </button>
              </div>

              {/* Color Palette Swatches */}
              {item.palette.length > 0 && (
                <div className="ql-inspector-section">
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
              )}

              {/* Collection Selector */}
              <div className="ql-inspector-section">
                <div className="inspector-label">{m.qlInspectorCollection}</div>
                <select
                  className="inspector-tag-input"
                  style={{ marginTop: 0 }}
                  aria-label={m.qlInspectorCollection}
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

              {/* Tags */}
              <div className="ql-inspector-section">
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

              {/* Notes */}
              <div className="ql-inspector-section">
                <div className="inspector-label">{m.qlInspectorNotes}</div>
                <textarea
                  className="inspector-tag-input ql-inspector-notes-input"
                  value={item.note}
                  placeholder={m.qlInspectorNotesPlaceholder}
                  onChange={(e) => onUpdateNote(item.id, e.target.value)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`similar-${item.id}`}
              custom={tabDir}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="ql-inspector-pane ql-inspector-pane--similar"
              data-testid="inspector-similar-pane"
            >
              <p
                className="ql-similar-heading"
                data-testid="inspector-similar-heading"
              >
                {m.qlInspectorSimilarHeading(item.title)}
              </p>

              {similarMatches.length === 0 ? (
                <div className="ql-similar-empty">
                  {m.qlInspectorSimilarEmpty}
                </div>
              ) : (
                <div
                  className="ql-similar-masonry"
                  data-testid="inspector-similar-masonry"
                >
                  <div className="ql-similar-col">
                    {leftCol.map((match, idx) => (
                      <SimilarMasonryCard
                        key={match.item.id}
                        match={match}
                        theme={theme}
                        index={idx * 2}
                        onSelect={onSelectSimilar}
                      />
                    ))}
                  </div>
                  <div className="ql-similar-col">
                    {rightCol.map((match, idx) => (
                      <SimilarMasonryCard
                        key={match.item.id}
                        match={match}
                        theme={theme}
                        index={idx * 2 + 1}
                        onSelect={onSelectSimilar}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
