import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LinkIcon, SearchIcon } from "./AppIcons";
import {
  ArrowUpSendIcon,
  BulletListIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseCrossIcon,
  CodeBracesIcon,
  CommentBubbleIcon,
  CommentPlusIcon,
  EditPencilIcon,
  FitExpandIcon,
  HandPanIcon,
  ImageAddIcon,
  MosaicGridIcon,
  PaletteIcon,
  PointerCursorIcon,
  SmilePlusIcon,
  TextSizeIcon,
  ZoomInGlassIcon,
  ZoomOutGlassIcon,
} from "./CanvasToolIcons";
import type {
  CanvasNoteCard,
  CanvasToolMode,
  NotePaperTone,
  NoteTextSize,
} from "./canvas-tools-engine";
import { getMessages, type AppLocale } from "./i18n";

const QUICK_EMOJIS = ["✨", "🔥", "💡", "👍", "🎯"] as const;
const NOTE_TONES: { id: NotePaperTone; swatch: string }[] = [
  { id: "paper", swatch: "#ffffff" },
  { id: "warm", swatch: "#fdf6e7" },
  { id: "sage", swatch: "#edf7ef" },
  { id: "sky", swatch: "#eef6ff" },
  { id: "ink", swatch: "#1d1e22" },
];

export interface CanvasFloatingToolbarsProps {
  locale: AppLocale;
  toolMode: CanvasToolMode;
  zoom: number;
  findOpen: boolean;
  findQuery: string;
  findMatchIndex: number;
  findMatchTotal: number;
  commentComposerOpen: boolean;
  onChangeToolMode: (mode: CanvasToolMode) => void;
  onImportClick: () => void;
  onPackBoard: () => void;
  onAddNote: () => void;
  onToggleCommentComposer: () => void;
  onSubmitQuickComment: (text: string) => void;
  onToggleFind: () => void;
  onFindQueryChange: (q: string) => void;
  onStepFind: (delta: number) => void;
  onCloseFind: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export function CanvasFloatingToolbars({
  locale,
  toolMode,
  zoom,
  findOpen,
  findQuery,
  findMatchIndex,
  findMatchTotal,
  commentComposerOpen,
  onChangeToolMode,
  onImportClick,
  onPackBoard,
  onAddNote,
  onToggleCommentComposer,
  onSubmitQuickComment,
  onToggleFind,
  onFindQueryChange,
  onStepFind,
  onCloseFind,
  onZoomIn,
  onZoomOut,
  onFitView,
}: CanvasFloatingToolbarsProps) {
  const m = getMessages(locale);
  const [hoveredMainKey, setHoveredMainKey] = useState<string | null>(null);
  const [hoveredRailKey, setHoveredRailKey] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (findOpen) {
      window.setTimeout(() => findInputRef.current?.focus(), 40);
    }
  }, [findOpen]);

  useEffect(() => {
    if (commentComposerOpen) {
      window.setTimeout(() => commentInputRef.current?.focus(), 40);
    }
  }, [commentComposerOpen]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    onSubmitQuickComment(trimmed);
    setCommentDraft("");
  };

  const matchCounterText =
    findQuery.trim().length > 0
      ? findMatchTotal > 0
        ? `${findMatchIndex + 1}/${findMatchTotal}`
        : "0/0"
      : "";

  return (
    <>
      {/* 1. Top-Center Floating Find-on-Canvas Pill (Exact video 00:00 - 00:01 replica) */}
      <div className="ctb-find-anchor" onPointerDown={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {findOpen && (
            <motion.div
              key="canvas-find-bar"
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
            >
              <div className="ctb-pill ctb-find-pill" data-testid="canvas-find-bar">
              <input
                ref={findInputRef}
                type="text"
                className="ctb-find-input"
                data-testid="canvas-find-input"
                value={findQuery}
                placeholder={m.canvasFindPlaceholder}
                onChange={(e) => onFindQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onStepFind(e.shiftKey ? -1 : 1);
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    onCloseFind();
                  }
                }}
              />
              {matchCounterText && (
                <span className="ctb-find-counter" data-testid="canvas-find-counter">
                  {matchCounterText}
                </span>
              )}
              <div className="ctb-find-actions">
                <button
                  type="button"
                  className="ctb-icon-btn ctb-icon-btn--sm"
                  aria-label={m.canvasFindPrev}
                  title={m.canvasFindPrev}
                  disabled={findMatchTotal === 0}
                  onClick={() => onStepFind(-1)}
                >
                  <ChevronUpIcon size={14} />
                </button>
                <button
                  type="button"
                  className="ctb-icon-btn ctb-icon-btn--sm"
                  aria-label={m.canvasFindNext}
                  title={m.canvasFindNext}
                  disabled={findMatchTotal === 0}
                  onClick={() => onStepFind(1)}
                >
                  <ChevronDownIcon size={14} />
                </button>
                <button
                  type="button"
                  className="ctb-icon-btn ctb-icon-btn--sm"
                  aria-label={m.canvasFindClose}
                  title={m.canvasFindClose}
                  onClick={onCloseFind}
                >
                  <CloseCrossIcon size={13} />
                </button>
              </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Right-Edge Vertical Navigation & Zoom Rail (Exact video 00:01 - 00:04 replica) */}
      <div
        className="ctb-right-rail"
        data-testid="canvas-zoom-rail"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseLeave={() => setHoveredRailKey(null)}
      >
        {/* Top Vertical Capsule: Pointer Select (V) vs Hand Pan Canvas (H) */}
        <div className="ctb-pill ctb-pill--vertical" role="group" aria-label="Canvas pointer mode">
          <button
            type="button"
            data-testid="canvas-mode-select-btn"
            className={`ctb-tool-btn ctb-tool-btn--square ${
              toolMode === "select" ? "ctb-tool-btn--inverted" : ""
            }`}
            aria-label={m.canvasToolSelect}
            aria-pressed={toolMode === "select"}
            title={m.canvasToolSelect}
            onMouseEnter={() => setHoveredRailKey("select")}
            onClick={() => onChangeToolMode("select")}
          >
            {hoveredRailKey === "select" && toolMode !== "select" && (
              <motion.span
                layoutId="ctb-rail-hover"
                className="ctb-hover-pill"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <span className="ctb-btn-inner">
              <PointerCursorIcon size={16} />
            </span>
          </button>

          <button
            type="button"
            data-testid="canvas-mode-pan-btn"
            className={`ctb-tool-btn ctb-tool-btn--square ${
              toolMode === "pan" ? "ctb-tool-btn--inverted" : ""
            }`}
            aria-label={m.canvasToolHand}
            aria-pressed={toolMode === "pan"}
            title={m.canvasToolHand}
            onMouseEnter={() => setHoveredRailKey("pan")}
            onClick={() => onChangeToolMode(toolMode === "pan" ? "select" : "pan")}
          >
            {hoveredRailKey === "pan" && toolMode !== "pan" && (
              <motion.span
                layoutId="ctb-rail-hover"
                className="ctb-hover-pill"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <span className="ctb-btn-inner">
              <HandPanIcon size={16} />
            </span>
          </button>
        </div>

        {/* Bottom Vertical Capsule: Zoom In / Zoom Out / Fit All to View */}
        <div className="ctb-pill ctb-pill--vertical" role="group" aria-label="Canvas zoom controls">
          <button
            type="button"
            data-testid="canvas-zoom-in-btn"
            className="ctb-tool-btn ctb-tool-btn--square"
            aria-label={m.canvasZoomIn}
            title={`${m.canvasZoomIn} (${Math.round(zoom * 100)}%)`}
            onMouseEnter={() => setHoveredRailKey("zoom-in")}
            onClick={onZoomIn}
          >
            {hoveredRailKey === "zoom-in" && (
              <motion.span
                layoutId="ctb-rail-hover"
                className="ctb-hover-pill"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <span className="ctb-btn-inner">
              <ZoomInGlassIcon size={16} />
            </span>
          </button>

          <button
            type="button"
            data-testid="canvas-zoom-out-btn"
            className="ctb-tool-btn ctb-tool-btn--square"
            aria-label={m.canvasZoomOut}
            title={`${m.canvasZoomOut} (${Math.round(zoom * 100)}%)`}
            onMouseEnter={() => setHoveredRailKey("zoom-out")}
            onClick={onZoomOut}
          >
            {hoveredRailKey === "zoom-out" && (
              <motion.span
                layoutId="ctb-rail-hover"
                className="ctb-hover-pill"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <span className="ctb-btn-inner">
              <ZoomOutGlassIcon size={16} />
            </span>
          </button>

          <span className="ctb-h-sep" aria-hidden="true" />

          <button
            type="button"
            data-testid="canvas-fit-view-btn"
            className="ctb-tool-btn ctb-tool-btn--square"
            aria-label={m.canvasFitView}
            title={m.canvasFitView}
            onMouseEnter={() => setHoveredRailKey("fit-view")}
            onClick={onFitView}
          >
            {hoveredRailKey === "fit-view" && (
              <motion.span
                layoutId="ctb-rail-hover"
                className="ctb-hover-pill"
                transition={{ type: "spring", stiffness: 520, damping: 36 }}
              />
            )}
            <span className="ctb-btn-inner">
              <FitExpandIcon size={16} />
            </span>
          </button>
        </div>
      </div>

      {/* 3. Bottom-Left Porcelain Spatial Toolbar Stack (Exact video 00:01, 00:05, 00:09 replica) */}
      <div
        className="ctb-bottom-stack"
        data-testid="canvas-floating-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Subtle Contextual Mode Hint or Dark Comment Composer Pill stacked 8px above */}
        <AnimatePresence>
          {commentComposerOpen && (
            <motion.form
              key="canvas-comment-composer"
              className="ctb-comment-composer"
              data-testid="canvas-comment-composer"
              onSubmit={handleSubmitComment}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
            >
              <span className="ctb-comment-composer-icon">
                <CommentPlusIcon size={16} />
              </span>
              <input
                ref={commentInputRef}
                type="text"
                className="ctb-comment-composer-input"
                data-testid="canvas-comment-input"
                value={commentDraft}
                placeholder={m.canvasCommentPlaceholder}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onToggleCommentComposer();
                  }
                }}
              />
              <button
                type="submit"
                className={`ctb-comment-send-btn ${
                  commentDraft.trim().length > 0 ? "ctb-comment-send-btn--ready" : ""
                }`}
                data-testid="canvas-comment-submit-btn"
                aria-label={m.canvasCommentSubmit}
                disabled={commentDraft.trim().length === 0}
              >
                <ArrowUpSendIcon size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Main Horizontal Porcelain Toolbar Row */}
        <div
          className="ctb-bottom-row"
          onMouseLeave={() => setHoveredMainKey(null)}
        >
          <div className="ctb-pill ctb-pill--horizontal" role="toolbar" aria-label="Canvas tools">
            {/* Image Import */}
            <button
              type="button"
              data-testid="canvas-tool-import-btn"
              className="ctb-tool-btn ctb-tool-btn--square"
              aria-label={m.canvasToolImport}
              title={m.canvasToolImport}
              onMouseEnter={() => setHoveredMainKey("import")}
              onClick={onImportClick}
            >
              {hoveredMainKey === "import" && (
                <motion.span
                  layoutId="ctb-main-hover"
                  className="ctb-hover-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 36 }}
                />
              )}
              <span className="ctb-btn-inner">
                <ImageAddIcon size={16} />
              </span>
            </button>

            {/* Pack Board Mosaic */}
            <button
              type="button"
              data-testid="canvas-tool-pack-btn"
              className="ctb-tool-btn ctb-tool-btn--square"
              aria-label={m.canvasToolPack}
              title={m.canvasToolPack}
              onMouseEnter={() => setHoveredMainKey("pack")}
              onClick={onPackBoard}
            >
              {hoveredMainKey === "pack" && (
                <motion.span
                  layoutId="ctb-main-hover"
                  className="ctb-hover-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 36 }}
                />
              )}
              <span className="ctb-btn-inner">
                <MosaicGridIcon size={16} />
              </span>
            </button>

            {/* Quick Add Note (+) */}
            <button
              type="button"
              data-testid="canvas-tool-note-btn"
              className="ctb-tool-btn ctb-tool-btn--labeled"
              aria-label={m.canvasToolNote}
              title={m.canvasToolNote}
              onMouseEnter={() => setHoveredMainKey("note")}
              onClick={onAddNote}
            >
              {hoveredMainKey === "note" && (
                <motion.span
                  layoutId="ctb-main-hover"
                  className="ctb-hover-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 36 }}
                />
              )}
              <span className="ctb-btn-inner">
                <EditPencilIcon size={15} />
                <span>{m.canvasToolNote}</span>
              </span>
            </button>

            <span className="ctb-v-sep" aria-hidden="true" />

            {/* Comment Pin Mode + Composer */}
            <button
              type="button"
              data-testid="canvas-tool-comment-btn"
              className={`ctb-tool-btn ctb-tool-btn--labeled ${
                toolMode === "comment" || commentComposerOpen
                  ? "ctb-tool-btn--inverted"
                  : ""
              }`}
              aria-label={m.canvasToolComment}
              aria-pressed={toolMode === "comment" || commentComposerOpen}
              title={m.canvasToolComment}
              onMouseEnter={() => setHoveredMainKey("comment")}
              onClick={onToggleCommentComposer}
            >
              {hoveredMainKey === "comment" &&
                toolMode !== "comment" &&
                !commentComposerOpen && (
                  <motion.span
                    layoutId="ctb-main-hover"
                    className="ctb-hover-pill"
                    transition={{ type: "spring", stiffness: 520, damping: 36 }}
                  />
                )}
              <span className="ctb-btn-inner">
                <CommentPlusIcon size={16} />
                <span>{m.canvasToolComment}</span>
              </span>
            </button>

            <span className="ctb-v-sep" aria-hidden="true" />

            {/* Find on Canvas */}
            <button
              type="button"
              data-testid="canvas-tool-find-btn"
              className={`ctb-tool-btn ctb-tool-btn--square ${
                findOpen ? "ctb-tool-btn--inverted" : ""
              }`}
              aria-label={m.canvasToolFind}
              aria-pressed={findOpen}
              title={m.canvasToolFind}
              onMouseEnter={() => setHoveredMainKey("find")}
              onClick={onToggleFind}
            >
              {hoveredMainKey === "find" && !findOpen && (
                <motion.span
                  layoutId="ctb-main-hover"
                  className="ctb-hover-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 36 }}
                />
              )}
              <span className="ctb-btn-inner">
                <SearchIcon size={15} />
              </span>
            </button>
          </div>

          {/* Quick Hand Pan Indicator Pill when Hand Pan is engaged */}
          <AnimatePresence>
            {toolMode === "pan" && (
              <motion.button
                key="pan-status-pill"
                type="button"
                className="ctb-pill ctb-mode-chip"
                data-testid="canvas-pan-active-pill"
                initial={{ opacity: 0, x: -8, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.94 }}
                transition={{ duration: 0.16 }}
                onClick={() => onChangeToolMode("select")}
                title={m.canvasToolSelect}
              >
                <HandPanIcon size={14} />
                <span>{m.canvasPanHint}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export interface NoteFormatToolbarProps {
  note: CanvasNoteCard;
  locale: AppLocale;
  onUpdateNote: (patch: Partial<CanvasNoteCard>) => void;
  onToggleReaction: (emoji: string) => void;
  onCreateLinkedComment: () => void;
  onToggleLinkEditor: () => void;
  onDeleteNote: () => void;
}

/**
 * Floating Rich-Text Note Format Bar (Exact replica of the bottom bar in video 00:00 - 00:10):
 * Comment | Emoji+ | TT ▾ | B | I | U | {} | Palette ▾ | List | Link | ×
 */
export function NoteFormatToolbar({
  note,
  locale,
  onUpdateNote,
  onToggleReaction,
  onCreateLinkedComment,
  onToggleLinkEditor,
  onDeleteNote,
}: NoteFormatToolbarProps) {
  const m = getMessages(locale);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<"emoji" | "palette" | null>(null);

  const cycleSize = () => {
    const order: NoteTextSize[] = ["sm", "md", "lg"];
    const next = order[(order.indexOf(note.size) + 1) % order.length] ?? "md";
    onUpdateNote({ size: next });
  };

  return (
    <motion.div
      className="ctb-note-fmt-wrap"
      data-testid="canvas-note-format-bar"
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 520, damping: 36 }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseLeave={() => setHoveredKey(null)}
    >
      <div className="ctb-pill ctb-pill--horizontal ctb-fmt-pill" role="toolbar" aria-label="Note formatting">
        <button
          type="button"
          className="ctb-tool-btn ctb-tool-btn--square-sm"
          aria-label={m.canvasToolComment}
          title={m.canvasToolComment}
          onMouseEnter={() => setHoveredKey("comment")}
          onClick={onCreateLinkedComment}
        >
          {hoveredKey === "comment" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <CommentBubbleIcon size={15} />
          </span>
        </button>

        <div className="ctb-menu-anchor">
          <button
            type="button"
            className={`ctb-tool-btn ctb-tool-btn--square-sm ${
              openMenu === "emoji" ? "ctb-tool-btn--active-soft" : ""
            }`}
            aria-label={m.canvasFmtEmoji}
            title={m.canvasFmtEmoji}
            onMouseEnter={() => setHoveredKey("emoji")}
            onClick={() => setOpenMenu((cur) => (cur === "emoji" ? null : "emoji"))}
          >
            {hoveredKey === "emoji" && (
              <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
            )}
            <span className="ctb-btn-inner">
              <SmilePlusIcon size={15} />
            </span>
          </button>

          <AnimatePresence>
            {openMenu === "emoji" && (
              <motion.div
                className="ctb-pill ctb-mini-popover"
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.14 }}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`ctb-emoji-btn ${
                      note.reactions.includes(emoji) ? "ctb-emoji-btn--active" : ""
                    }`}
                    onClick={() => {
                      onToggleReaction(emoji);
                      setOpenMenu(null);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="ctb-v-sep" aria-hidden="true" />

        <button
          type="button"
          data-testid="note-fmt-size"
          className="ctb-tool-btn ctb-tool-btn--compact"
          aria-label={m.canvasFmtTextSize}
          title={`${m.canvasFmtTextSize}: ${note.size.toUpperCase()}`}
          onMouseEnter={() => setHoveredKey("size")}
          onClick={cycleSize}
        >
          {hoveredKey === "size" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <TextSizeIcon size={15} />
            <span className="ctb-size-tag">{note.size.toUpperCase()}</span>
          </span>
        </button>

        <button
          type="button"
          data-testid="note-fmt-bold"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.bold ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtBold}
          aria-pressed={note.bold}
          title={m.canvasFmtBold}
          onMouseEnter={() => setHoveredKey("bold")}
          onClick={() => onUpdateNote({ bold: !note.bold })}
        >
          {hoveredKey === "bold" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner ctb-glyph-b">B</span>
        </button>

        <button
          type="button"
          data-testid="note-fmt-italic"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.italic ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtItalic}
          aria-pressed={note.italic}
          title={m.canvasFmtItalic}
          onMouseEnter={() => setHoveredKey("italic")}
          onClick={() => onUpdateNote({ italic: !note.italic })}
        >
          {hoveredKey === "italic" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner ctb-glyph-i">I</span>
        </button>

        <button
          type="button"
          data-testid="note-fmt-underline"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.underline ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtUnderline}
          aria-pressed={note.underline}
          title={m.canvasFmtUnderline}
          onMouseEnter={() => setHoveredKey("underline")}
          onClick={() => onUpdateNote({ underline: !note.underline })}
        >
          {hoveredKey === "underline" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner ctb-glyph-u">U</span>
        </button>

        <button
          type="button"
          data-testid="note-fmt-code"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.code ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtCode}
          aria-pressed={note.code}
          title={m.canvasFmtCode}
          onMouseEnter={() => setHoveredKey("code")}
          onClick={() => onUpdateNote({ code: !note.code })}
        >
          {hoveredKey === "code" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <CodeBracesIcon size={15} />
          </span>
        </button>

        <div className="ctb-menu-anchor">
          <button
            type="button"
            data-testid="note-fmt-color"
            className={`ctb-tool-btn ctb-tool-btn--square-sm ${
              openMenu === "palette" ? "ctb-tool-btn--active-soft" : ""
            }`}
            aria-label={m.canvasFmtColor}
            title={m.canvasFmtColor}
            onMouseEnter={() => setHoveredKey("palette")}
            onClick={() => setOpenMenu((cur) => (cur === "palette" ? null : "palette"))}
          >
            {hoveredKey === "palette" && (
              <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
            )}
            <span className="ctb-btn-inner">
              <PaletteIcon size={15} />
            </span>
          </button>

          <AnimatePresence>
            {openMenu === "palette" && (
              <motion.div
                className="ctb-pill ctb-mini-popover"
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.14 }}
              >
                {NOTE_TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ctb-tone-swatch ${
                      note.tone === t.id ? "ctb-tone-swatch--active" : ""
                    }`}
                    aria-label={t.id}
                    style={{ background: t.swatch }}
                    onClick={() => {
                      onUpdateNote({ tone: t.id });
                      setOpenMenu(null);
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="ctb-v-sep" aria-hidden="true" />

        <button
          type="button"
          data-testid="note-fmt-list"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.bulletList ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtList}
          aria-pressed={note.bulletList}
          title={m.canvasFmtList}
          onMouseEnter={() => setHoveredKey("list")}
          onClick={() => onUpdateNote({ bulletList: !note.bulletList })}
        >
          {hoveredKey === "list" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <BulletListIcon size={15} />
          </span>
        </button>

        <button
          type="button"
          data-testid="note-fmt-link"
          className={`ctb-tool-btn ctb-tool-btn--square-sm ${
            note.linkUrl ? "ctb-tool-btn--active-soft" : ""
          }`}
          aria-label={m.canvasFmtLink}
          title={m.canvasFmtLink}
          onMouseEnter={() => setHoveredKey("link")}
          onClick={onToggleLinkEditor}
        >
          {hoveredKey === "link" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <LinkIcon size={15} />
          </span>
        </button>

        <span className="ctb-v-sep" aria-hidden="true" />

        <button
          type="button"
          data-testid="note-fmt-delete"
          className="ctb-tool-btn ctb-tool-btn--square-sm ctb-tool-btn--danger"
          aria-label={m.canvasFmtDeleteNote}
          title={m.canvasFmtDeleteNote}
          onMouseEnter={() => setHoveredKey("delete")}
          onClick={onDeleteNote}
        >
          {hoveredKey === "delete" && (
            <motion.span layoutId="ctb-fmt-hover" className="ctb-hover-pill" transition={{ type: "spring", stiffness: 540, damping: 38 }} />
          )}
          <span className="ctb-btn-inner">
            <CloseCrossIcon size={13} />
          </span>
        </button>
      </div>
    </motion.div>
  );
}
