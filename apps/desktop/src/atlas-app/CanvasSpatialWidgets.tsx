import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { LinkIcon } from "./AppIcons";
import { NoteFormatToolbar } from "./CanvasFloatingToolbars";
import {
  CheckResolveIcon,
  CloseCrossIcon,
  ReplyArrowIcon,
  SmilePlusIcon,
} from "./CanvasToolIcons";
import type {
  CanvasCommentPin,
  CanvasNoteCard,
} from "./canvas-tools-engine";
import { getMessages, type AppLocale } from "./i18n";

const PIN_EMOJIS = ["👍", "✨", "🔥", "💡"] as const;

export interface CanvasNoteCardWidgetProps {
  note: CanvasNoteCard;
  active: boolean;
  highlighted: boolean;
  locale: AppLocale;
  zoom: number;
  onSelect: () => void;
  onPointerDownMove: (e: React.PointerEvent<HTMLDivElement>, note: CanvasNoteCard) => void;
  onUpdate: (patch: Partial<CanvasNoteCard>) => void;
  onToggleReaction: (emoji: string) => void;
  onCreateLinkedComment: () => void;
  onDelete: () => void;
}

export function CanvasNoteCardWidget({
  note,
  active,
  highlighted,
  locale,
  zoom,
  onSelect,
  onPointerDownMove,
  onUpdate,
  onToggleReaction,
  onCreateLinkedComment,
  onDelete,
}: CanvasNoteCardWidgetProps) {
  const m = getMessages(locale);
  const [linkOpen, setLinkOpen] = useState(false);

  const counterScale = zoom > 0 ? Math.min(1.2, Math.max(0.75, 1 / zoom)) : 1;

  return (
    <div
      data-testid={`canvas-note-${note.id}`}
      data-canvas-widget="note"
      className={`canvas-note-card canvas-note-card--${note.tone} ${
        active ? "canvas-note-card--active" : ""
      } ${highlighted ? "canvas-match-highlight" : ""}`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        width: `${note.width}px`,
        zIndex: active ? 9200 : note.z,
      }}
      onPointerDown={(e) => {
        onSelect();
        const target = e.target as HTMLElement | null;
        if (
          target?.closest("input") ||
          target?.closest("textarea") ||
          target?.closest("button") ||
          target?.closest("a")
        ) {
          e.stopPropagation();
          return;
        }
        onPointerDownMove(e, note);
      }}
    >
      {/* Floating Rich-Text Format Bar docked cleanly above active note (Video 00:00 - 00:10) */}
      <AnimatePresence>
        {active && (
          <div
            className="canvas-note-toolbar-anchor"
            style={{ transform: `translateX(-50%) scale(${counterScale})` }}
          >
            <NoteFormatToolbar
              note={note}
              locale={locale}
              onUpdateNote={onUpdate}
              onToggleReaction={onToggleReaction}
              onCreateLinkedComment={onCreateLinkedComment}
              onToggleLinkEditor={() => setLinkOpen((v) => !v)}
              onDeleteNote={onDelete}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Subtle Drag Grip Strip */}
      <div className="canvas-note-grip" aria-hidden="true">
        <span className="canvas-note-grip-dots" />
      </div>

      {/* Editable Heading */}
      <input
        type="text"
        className={`canvas-note-title canvas-note-size--${note.size} ${
          note.code ? "canvas-note-text--code" : ""
        }`}
        data-testid={`canvas-note-title-${note.id}`}
        value={note.title}
        placeholder={m.canvasNoteTitlePlaceholder}
        onChange={(e) => onUpdate({ title: e.target.value })}
        onFocus={onSelect}
      />

      {/* Editable Body with live formatting */}
      {note.bulletList ? (
        <div className="canvas-note-bullet-wrap">
          <textarea
            className={`canvas-note-body canvas-note-size--${note.size} ${
              note.bold ? "canvas-note-text--bold" : ""
            } ${note.italic ? "canvas-note-text--italic" : ""} ${
              note.underline ? "canvas-note-text--underline" : ""
            } ${note.code ? "canvas-note-text--code" : ""}`}
            data-testid={`canvas-note-body-${note.id}`}
            rows={3}
            value={note.body}
            placeholder={m.canvasNoteBodyPlaceholder}
            onChange={(e) => onUpdate({ body: e.target.value })}
            onFocus={onSelect}
          />
          {note.body.trim().length > 0 && (
            <ul
              className={`canvas-note-bullets canvas-note-size--${note.size} ${
                note.bold ? "canvas-note-text--bold" : ""
              } ${note.italic ? "canvas-note-text--italic" : ""} ${
                note.underline ? "canvas-note-text--underline" : ""
              } ${note.code ? "canvas-note-text--code" : ""}`}
            >
              {note.body
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
            </ul>
          )}
        </div>
      ) : (
        <textarea
          className={`canvas-note-body canvas-note-size--${note.size} ${
            note.bold ? "canvas-note-text--bold" : ""
          } ${note.italic ? "canvas-note-text--italic" : ""} ${
            note.underline ? "canvas-note-text--underline" : ""
          } ${note.code ? "canvas-note-text--code" : ""}`}
          data-testid={`canvas-note-body-${note.id}`}
          rows={3}
          value={note.body}
          placeholder={m.canvasNoteBodyPlaceholder}
          onChange={(e) => onUpdate({ body: e.target.value })}
          onFocus={onSelect}
        />
      )}

      {/* Optional Link Editor / Attached Link */}
      {(linkOpen || note.linkUrl) && (
        <div className="canvas-note-link-row">
          <LinkIcon size={12} />
          {linkOpen ? (
            <input
              type="url"
              className="canvas-note-link-input"
              value={note.linkUrl}
              placeholder={m.canvasNoteLinkPlaceholder}
              autoFocus
              onChange={(e) => onUpdate({ linkUrl: e.target.value })}
              onBlur={() => setLinkOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  setLinkOpen(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="canvas-note-link-display"
              onClick={() => setLinkOpen(true)}
            >
              {note.linkUrl.replace(/^https?:\/\//, "")}
            </button>
          )}
        </div>
      )}

      {/* Emoji Reactions */}
      {note.reactions.length > 0 && (
        <div className="canvas-widget-reactions">
          {note.reactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="canvas-reaction-chip"
              onClick={() => onToggleReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface CanvasCommentPinWidgetProps {
  pin: CanvasCommentPin;
  open: boolean;
  highlighted: boolean;
  locale: AppLocale;
  zoom: number;
  alignLeft?: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onPointerDownMove: (e: React.PointerEvent<HTMLDivElement>, pin: CanvasCommentPin) => void;
  onAddReply: (text: string) => void;
  onToggleReaction: (emoji: string) => void;
  onResolve: () => void;
}

export function CanvasCommentPinWidget({
  pin,
  open,
  highlighted,
  locale,
  zoom,
  alignLeft = false,
  onToggleOpen,
  onClose,
  onPointerDownMove,
  onAddReply,
  onToggleReaction,
  onResolve,
}: CanvasCommentPinWidgetProps) {
  const m = getMessages(locale);
  const [replyDraft, setReplyDraft] = useState("");
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);

  if (pin.resolved) return null;

  const counterScale = zoom > 0 ? Math.min(1.22, Math.max(0.72, 1 / zoom)) : 1;

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    onAddReply(trimmed);
    setReplyDraft("");
  };

  return (
    <div
      data-testid={`canvas-comment-pin-${pin.id}`}
      data-canvas-widget="comment"
      className={`canvas-comment-pin-wrap ${open ? "canvas-comment-pin-wrap--open" : ""}`}
      style={{
        left: `${pin.x}px`,
        top: `${pin.y}px`,
        zIndex: open ? 9400 : 8400,
      }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest(".canvas-comment-popover")) {
          e.stopPropagation();
          return;
        }
        onPointerDownMove(e, pin);
      }}
    >
      <button
        type="button"
        className={`canvas-comment-marker ${open ? "canvas-comment-marker--open" : ""} ${
          highlighted ? "canvas-match-highlight" : ""
        }`}
        aria-label={`Comment #${pin.number}: ${pin.text}`}
        aria-expanded={open}
        style={{ transform: `scale(${counterScale})` }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleOpen();
        }}
      >
        <span className="canvas-comment-marker-num">{pin.number}</span>
      </button>

      {/* Interactive Comment Thread Popover with Exact Dark "Reply ↩" Button (Video 00:01 - 00:04) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className={`canvas-comment-popover ${
              alignLeft ? "canvas-comment-popover--left" : ""
            }`}
            data-testid={`canvas-comment-popover-${pin.id}`}
            style={{
              transformOrigin: alignLeft ? "top right" : "top left",
              scale: counterScale,
            }}
            initial={{ opacity: 0, y: 6, scale: counterScale * 0.94 }}
            animate={{ opacity: 1, y: 0, scale: counterScale }}
            exit={{ opacity: 0, y: 4, scale: counterScale * 0.94 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="canvas-comment-header">
              <div className="canvas-comment-author-meta">
                <span className="canvas-comment-author">{pin.author}</span>
                <span className="canvas-comment-dot" aria-hidden="true">·</span>
                <span className="canvas-comment-time">{pin.createdAt}</span>
              </div>
              <div className="canvas-comment-header-actions">
                <div className="ctb-menu-anchor">
                  <button
                    type="button"
                    className="ctb-icon-btn ctb-icon-btn--sm"
                    aria-label={m.canvasFmtEmoji}
                    title={m.canvasFmtEmoji}
                    onClick={() => setEmojiMenuOpen((v) => !v)}
                  >
                    <SmilePlusIcon size={14} />
                  </button>
                  {emojiMenuOpen && (
                    <div className="ctb-pill ctb-mini-popover ctb-mini-popover--below">
                      {PIN_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`ctb-emoji-btn ${
                            pin.reactions.includes(emoji) ? "ctb-emoji-btn--active" : ""
                          }`}
                          onClick={() => {
                            onToggleReaction(emoji);
                            setEmojiMenuOpen(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="ctb-icon-btn ctb-icon-btn--sm"
                  data-testid={`canvas-comment-resolve-${pin.id}`}
                  aria-label={m.canvasResolveComment}
                  title={m.canvasResolveComment}
                  onClick={onResolve}
                >
                  <CheckResolveIcon size={14} />
                </button>
                <button
                  type="button"
                  className="ctb-icon-btn ctb-icon-btn--sm"
                  aria-label={m.canvasFindClose}
                  onClick={onClose}
                >
                  <CloseCrossIcon size={13} />
                </button>
              </div>
            </div>

            <p className="canvas-comment-body">{pin.text}</p>

            {pin.reactions.length > 0 && (
              <div className="canvas-widget-reactions">
                {pin.reactions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="canvas-reaction-chip"
                    onClick={() => onToggleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {pin.replies.length > 0 && (
              <div className="canvas-comment-replies">
                {pin.replies.map((reply) => (
                  <div key={reply.id} className="canvas-comment-reply-row">
                    <div className="canvas-comment-author-meta">
                      <span className="canvas-comment-author">{reply.author}</span>
                      <span className="canvas-comment-dot" aria-hidden="true">·</span>
                      <span className="canvas-comment-time">{reply.createdAt}</span>
                    </div>
                    <p className="canvas-comment-body">{reply.text}</p>
                  </div>
                ))}
              </div>
            )}

            <form className="canvas-comment-reply-form" onSubmit={handleSubmitReply}>
              <input
                type="text"
                className="canvas-comment-reply-input"
                data-testid={`canvas-comment-reply-input-${pin.id}`}
                value={replyDraft}
                placeholder={m.canvasReplyPlaceholder}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onClose();
                  }
                }}
              />
              <button
                type="submit"
                className="ctb-reply-pill-btn"
                data-testid={`canvas-comment-reply-submit-${pin.id}`}
                disabled={replyDraft.trim().length === 0}
              >
                <span>{m.canvasReplyBtn}</span>
                <ReplyArrowIcon size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
