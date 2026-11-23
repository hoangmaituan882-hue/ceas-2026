export type AtomicSlotKind = "quicklook" | "pip" | "card" | "parking";

export type AtomicMoveStrategy = "moveBefore" | "insertBefore" | "noop";

export interface AtomicMoveNode {
  parentNode: unknown;
  nextSibling: unknown;
}

export interface AtomicMoveParent {
  moveBefore?: (node: Node, child: Node | null) => void;
  insertBefore: (node: Node, child: Node | null) => Node;
}

/**
 * Atomically moves a live DOM node (such as a playing <iframe> or <video> wrapper)
 * into `slot` using ParentNode.prototype.moveBefore() when supported, preserving
 * iframe document state, JS execution context, and media playback without reload.
 * Falls back cleanly to insertBefore() on engines without moveBefore().
 */
export function moveNodePreservingState(
  slot: AtomicMoveParent,
  player: Node,
  referenceNode: Node | null = null,
): AtomicMoveStrategy {
  const nodeLike = player as unknown as AtomicMoveNode;
  if (nodeLike.parentNode === slot && nodeLike.nextSibling === referenceNode) {
    return "noop";
  }

  if ("moveBefore" in slot && typeof slot.moveBefore === "function") {
    slot.moveBefore(player, referenceNode);
    return "moveBefore";
  }

  slot.insertBefore(player, referenceNode);
  return "insertBefore";
}

export interface SlotPresence {
  hasQuickLook: boolean;
  hasPip: boolean;
  hasCard: boolean;
}

/**
 * Deterministic host slot priority for an active embedded player:
 * QuickLook Lightbox > Floating Mini-Player (PiP) > Inline Card (Grid/Canvas) > Hidden Atomic Parking.
 */
export function resolveActiveHostSlot(presence: SlotPresence): AtomicSlotKind {
  if (presence.hasQuickLook) return "quicklook";
  if (presence.hasPip) return "pip";
  if (presence.hasCard) return "card";
  return "parking";
}

/**
 * Parses a duration string like "0:14" or "1:25" into positive seconds.
 */
export function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 12;
  const parts = duration
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 12;
  if (parts.length === 2) {
    return Math.max(2, parts[0]! * 60 + parts[1]!);
  }
  if (parts.length === 3) {
    return Math.max(2, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  }
  return Math.max(2, parts[0] ?? 12);
}

export type EmbeddedReelTheme = "glass" | "orb" | "rotary";

export function inferEmbeddedReelTheme(itemId: string, title: string): EmbeddedReelTheme {
  const hay = `${itemId} ${title}`.toLowerCase();
  if (hay.includes("orb") || hay.includes("botanical") || hay.includes("item-02")) {
    return "orb";
  }
  if (hay.includes("rotary") || hay.includes("dial") || hay.includes("item-09")) {
    return "rotary";
  }
  return "glass";
}

function escapeHtmlAttr(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface EmbeddedMotionSpec {
  itemId: string;
  title: string;
  posterUrl: string;
  durationSec: number;
  palette: readonly string[];
  reelTheme: EmbeddedReelTheme;
}

/**
 * Builds a self-contained HTML5 iframe `srcdoc` interactive motion player.
 * The iframe runs its own smooth requestAnimationFrame visual shader + internal clock,
 * exposing `window.__atlasEmbedSessionId` and `window.__atlasEmbedState` so atomic
 * `moveBefore()` transfers across Grid, Canvas, QuickLook, and Floating PiP can be
 * verified to preserve exact runtime state with zero reload or playback reset.
 */
export function buildEmbeddedMotionSrcDoc(spec: EmbeddedMotionSpec): string {
  const safeId = JSON.stringify(spec.itemId);
  const safeTheme = JSON.stringify(spec.reelTheme);
  const safeDuration = Math.max(2, Math.round(spec.durationSec * 100) / 100);
  const c0 = JSON.stringify(spec.palette[0] ?? "#60a5fa");
  const c1 = JSON.stringify(spec.palette[1] ?? "#f2901b");
  const c2 = JSON.stringify(spec.palette[2] ?? "#1c1c1e");
  const safePoster = escapeHtmlAttr(spec.posterUrl);
  const safeTitle = escapeHtmlAttr(spec.title);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #101114;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .poster {
    position: absolute;
    inset: -6%;
    width: 112%;
    height: 112%;
    object-fit: cover;
    transform-origin: center center;
    will-change: transform, filter;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.34) 100%);
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="stage">
    <img class="poster" id="poster" src="${safePoster}" alt="${safeTitle}" draggable="false" />
    <canvas id="fx"></canvas>
    <div class="vignette"></div>
  </div>
  <script>
    (function () {
      const ITEM_ID = ${safeId};
      const THEME = ${safeTheme};
      const DURATION = ${safeDuration};
      const C0 = ${c0};
      const C1 = ${c1};
      const C2 = ${c2};

      // Unique monotonic runtime token created ONCE when this iframe boots.
      // If appendChild/remount ever occurred, this token would regenerate and elapsed would reset to 0!
      const SESSION_ID = "embed-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
      window.__atlasEmbedSessionId = SESSION_ID;
      window.__atlasEmbedBootCount = (window.__atlasEmbedBootCount || 0) + 1;

      const poster = document.getElementById("poster");
      const canvas = document.getElementById("fx");
      const ctx = canvas.getContext("2d");

      let playing = true;
      let elapsed = 0;
      let lastTs = performance.now();
      let lastEmitTs = 0;

      function syncWindowState() {
        window.__atlasEmbedState = {
          itemId: ITEM_ID,
          sessionId: SESSION_ID,
          bootCount: window.__atlasEmbedBootCount,
          playing,
          elapsed,
          duration: DURATION,
        };
      }

      function emitState(force) {
        const now = performance.now();
        if (!force && now - lastEmitTs < 85) return;
        lastEmitTs = now;
        syncWindowState();
        try {
          window.parent.postMessage(
            {
              type: "atlas-embed-state",
              itemId: ITEM_ID,
              sessionId: SESSION_ID,
              playing,
              elapsed,
              duration: DURATION,
            },
            "*",
          );
        } catch (_err) {}
      }

      window.addEventListener("message", function (ev) {
        const msg = ev.data;
        if (!msg || msg.type !== "atlas-embed-cmd" || msg.itemId !== ITEM_ID) return;
        if (msg.action === "play") {
          playing = true;
          lastTs = performance.now();
          emitState(true);
        } else if (msg.action === "pause") {
          playing = false;
          emitState(true);
        } else if (msg.action === "toggle") {
          playing = !playing;
          lastTs = performance.now();
          emitState(true);
        } else if (msg.action === "seek" && typeof msg.time === "number") {
          elapsed = Math.max(0, Math.min(DURATION, msg.time));
          lastTs = performance.now();
          emitState(true);
        }
      });

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }

      function render(now) {
        const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
        lastTs = now;
        if (playing) {
          elapsed = (elapsed + dt) % DURATION;
        }

        resize();
        const w = canvas.width;
        const h = canvas.height;
        const phase = (elapsed / DURATION) * Math.PI * 2;

        // Smooth kinetic camera breathing on the poster artwork
        const panX = Math.sin(phase) * 2.2;
        const panY = Math.cos(phase * 0.8) * 1.6;
        const scale = 1.03 + 0.03 * Math.sin(phase * 1.1);
        poster.style.transform =
          "translate3d(" + panX.toFixed(2) + "%, " + panY.toFixed(2) + "%, 0) scale(" + scale.toFixed(4) + ")";

        if (ctx && w > 0 && h > 0) {
          ctx.clearRect(0, 0, w, h);

          if (THEME === "orb") {
            const cx = w * (0.5 + 0.08 * Math.cos(phase));
            const cy = h * (0.5 + 0.08 * Math.sin(phase * 1.3));
            const r = Math.min(w, h) * (0.36 + 0.04 * Math.sin(phase * 2));
            const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
            grad.addColorStop(0, "rgba(236, 252, 203, 0.34)");
            grad.addColorStop(0.55, "rgba(132, 204, 22, 0.14)");
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.translate(w * 0.5, h * 0.5);
            ctx.rotate(phase * 0.65);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
            ctx.lineWidth = Math.max(1.5, w * 0.003);
            ctx.beginPath();
            ctx.ellipse(0, 0, Math.min(w, h) * 0.34, Math.min(w, h) * 0.14, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else if (THEME === "rotary") {
            const cx = w * 0.5;
            const cy = h * 0.5;
            const rad = Math.min(w, h) * 0.34;
            ctx.save();
            ctx.translate(cx, cy);
            for (let i = 0; i < 36; i++) {
              const a = (i / 36) * Math.PI * 2 + phase * 0.5;
              const isHot = i % 6 === 0;
              ctx.strokeStyle = isHot ? "rgba(242, 144, 27, 0.72)" : "rgba(255, 255, 255, 0.24)";
              ctx.lineWidth = Math.max(1.5, w * 0.003);
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * rad * 0.88, Math.sin(a) * rad * 0.88);
              ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            // Sweeping translucent glass light caustics
            const lx = w * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(phase)));
            const ly = h * (0.35 + 0.3 * Math.cos(phase * 1.2));
            const r = Math.max(w, h) * 0.48;
            const g1 = ctx.createRadialGradient(lx, ly, r * 0.04, lx, ly, r);
            g1.addColorStop(0, "rgba(255, 255, 255, 0.32)");
            g1.addColorStop(0.45, "rgba(242, 144, 27, 0.14)");
            g1.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = g1;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
            ctx.lineWidth = Math.max(1.5, w * 0.0025);
            const sx = ((elapsed / DURATION) * 1.4 - 0.2) * w;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx - h * 0.32, h);
            ctx.stroke();
            ctx.restore();
          }
        }

        emitState(false);
        requestAnimationFrame(render);
      }

      syncWindowState();
      emitState(true);
      requestAnimationFrame(render);
    })();
  </script>
</body>
</html>`;
}
