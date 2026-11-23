import type { CanvasNodeBox } from "./canvas-physics";

export type CanvasToolMode = "select" | "pan" | "comment";

export type NoteTextSize = "sm" | "md" | "lg";
export type NotePaperTone = "paper" | "warm" | "sage" | "sky" | "ink";

export interface CanvasNoteCard {
  id: string;
  x: number;
  y: number;
  width: number;
  title: string;
  body: string;
  size: NoteTextSize;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  code: boolean;
  bulletList: boolean;
  tone: NotePaperTone;
  linkUrl: string;
  reactions: string[];
  z: number;
}

export interface CanvasCommentReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface CanvasCommentPin {
  id: string;
  number: number;
  x: number;
  y: number;
  author: string;
  text: string;
  createdAt: string;
  replies: CanvasCommentReply[];
  reactions: string[];
  resolved: boolean;
}

export interface CanvasSearchMatch {
  id: string;
  kind: "item" | "note" | "comment";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitViewportResult {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * Computes the exact pan + zoom transform needed to frame all given world boxes
 * harmoniously centered within the visible Canvas stage (accounting for sidebar, topbar, and docks).
 */
export function computeCanvasFitViewport(
  boxes: readonly CanvasNodeBox[],
  viewportWidth: number,
  viewportHeight: number,
  sidebarOffset: number,
  padding = 54,
): FitViewportResult {
  const usableLeft = sidebarOffset + padding;
  const usableRight = Math.max(usableLeft + 240, viewportWidth - 88);
  const usableTop = 64 + padding * 0.5;
  const usableBottom = Math.max(usableTop + 200, viewportHeight - 86);
  const availW = usableRight - usableLeft;
  const availH = usableBottom - usableTop;

  if (boxes.length === 0) {
    return {
      panX: Math.round(sidebarOffset + 36),
      panY: 72,
      zoom: 1,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const contentW = Math.max(120, maxX - minX);
  const contentH = Math.max(120, maxY - minY);
  const rawZoom = Math.min(availW / contentW, availH / contentH);
  const zoom = Math.round(Math.min(1.35, Math.max(0.65, rawZoom)) * 20) / 20;

  const contentCenterX = minX + contentW * 0.5;
  const contentCenterY = minY + contentH * 0.5;
  const targetCenterX = usableLeft + availW * 0.5;
  const targetCenterY = usableTop + availH * 0.5;

  return {
    panX: Math.round(targetCenterX - contentCenterX * zoom),
    panY: Math.round(targetCenterY - contentCenterY * zoom),
    zoom,
  };
}

/**
 * Computes pan coordinates to smoothly center a target world point inside the visible Canvas viewport.
 */
export function computePanToCenterWorldPoint(
  worldX: number,
  worldY: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  sidebarOffset: number,
): { x: number; y: number } {
  const targetCenterX = sidebarOffset + (viewportWidth - sidebarOffset) * 0.5;
  const targetCenterY = viewportHeight * 0.5;
  return {
    x: Math.round(targetCenterX - worldX * zoom),
    y: Math.round(targetCenterY - worldY * zoom),
  };
}

/**
 * Searches across Canvas media cards, note cards, and comment pins in deterministic order.
 */
export function findCanvasMatches(
  items: readonly {
    id: string;
    title: string;
    tags: readonly string[];
    note: string;
    canvasX: number;
    canvasY: number;
    canvasW: number;
    width: number;
    height: number;
  }[],
  notes: readonly CanvasNoteCard[],
  comments: readonly CanvasCommentPin[],
  query: string,
): CanvasSearchMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: CanvasSearchMatch[] = [];

  for (const it of items) {
    const haystack = `${it.title} ${it.tags.join(" ")} ${it.note}`.toLowerCase();
    if (haystack.includes(q)) {
      const aspect = it.height > 0 ? it.width / it.height : 1;
      matches.push({
        id: it.id,
        kind: "item",
        label: it.title,
        x: it.canvasX,
        y: it.canvasY,
        width: it.canvasW,
        height: Math.round(it.canvasW / aspect),
      });
    }
  }

  for (const n of notes) {
    const haystack = `${n.title} ${n.body} ${n.linkUrl}`.toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        id: n.id,
        kind: "note",
        label: n.title || n.body.slice(0, 28) || "Note",
        x: n.x,
        y: n.y,
        width: n.width,
        height: 156,
      });
    }
  }

  for (const c of comments) {
    if (c.resolved) continue;
    const replyText = c.replies.map((r) => r.text).join(" ");
    const haystack = `${c.author} ${c.text} ${replyText}`.toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        id: c.id,
        kind: "comment",
        label: c.text.slice(0, 28),
        x: c.x,
        y: c.y,
        width: 36,
        height: 36,
      });
    }
  }

  return matches;
}

/**
 * Cycles match index safely with wrap-around for Next (delta = +1) and Prev (delta = -1).
 */
export function stepMatchIndex(
  currentIndex: number,
  total: number,
  delta: number,
): number {
  if (total <= 0) return -1;
  const base = currentIndex < 0 ? 0 : currentIndex;
  return (((base + delta) % total) + total) % total;
}

export function createCanvasNote(
  id: string,
  x: number,
  y: number,
  z: number,
  defaults?: { title?: string; body?: string },
): CanvasNoteCard {
  return {
    id,
    x: Math.round(x),
    y: Math.round(y),
    width: 248,
    title: defaults?.title ?? "",
    body: defaults?.body ?? "",
    size: "md",
    bold: false,
    italic: false,
    underline: false,
    code: false,
    bulletList: false,
    tone: "paper",
    linkUrl: "",
    reactions: [],
    z,
  };
}

export function createCanvasCommentPin(
  id: string,
  number: number,
  x: number,
  y: number,
  text: string,
  author: string,
  createdAt: string,
): CanvasCommentPin {
  return {
    id,
    number,
    x: Math.round(x),
    y: Math.round(y),
    author,
    text: text.trim(),
    createdAt,
    replies: [],
    reactions: [],
    resolved: false,
  };
}

export function addReplyToCommentPin(
  pin: CanvasCommentPin,
  replyId: string,
  text: string,
  author: string,
  createdAt: string,
): CanvasCommentPin {
  const trimmed = text.trim();
  if (!trimmed) return pin;
  return {
    ...pin,
    replies: [
      ...pin.replies,
      { id: replyId, author, text: trimmed, createdAt },
    ],
  };
}

export function toggleReactionOnList(
  reactions: readonly string[],
  emoji: string,
): string[] {
  return reactions.includes(emoji)
    ? reactions.filter((r) => r !== emoji)
    : [...reactions, emoji];
}
