import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  computeStackCardPose,
  type SidebarDropTarget,
} from "./drag-selection-engine";
import type { ScreenRect } from "./hero-transition";
import type { LibraryItem, ThemeMode } from "./library-engine";
import { RichMediaCardContent } from "./RichMediaCardContent";

export type DragFlightPhase = "dragging" | "settling" | "snap-back" | "fly-in";

export interface DragOverlaySession {
  id: number;
  phase: DragFlightPhase;
  items: readonly LibraryItem[];
  pointerX: number;
  pointerY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  /** Original screen rect of the primary grabbed card (used for true-size single-card lift). */
  primaryOriginRect: ScreenRect;
  /** Destination screen rect per item id for `settling` or `snap-back` flights. */
  targetRectsById: Record<string, ScreenRect>;
  /** Target point inside the hovered sidebar row for `fly-in` suction animation. */
  flyInTargetPoint: { x: number; y: number } | null;
  /** Active sidebar drop target metadata (if hovering one). */
  sidebarTarget: SidebarDropTarget | null;
  /** Human-readable target label shown in the frosted badge under the stack. */
  sidebarTargetLabel: string | null;
  /** True when pointer is outside the valid reorder bounds and not over a sidebar target. */
  outOfBounds: boolean;
  /** Velocity-driven tilt angle in degrees. */
  tiltDeg: number;
  /** Card corner radius matching current view settings. */
  radius: number;
  /** Localized hint shown when out-of-bounds (e.g. "Release to return"). */
  returnHintLabel: string;
}

export interface DragStackOverlayProps {
  session: DragOverlaySession | null;
  theme: ThemeMode;
  imgFit?: "cover" | "contain";
  onFlightComplete: (sessionId: number) => void;
}

const MAX_VISIBLE_STACK_CARDS = 4;

export function DragStackOverlay({
  session,
  theme,
  imgFit = "cover",
  onFlightComplete,
}: DragStackOverlayProps) {
  const completedIdRef = useRef<number | null>(null);

  // Safety fallback timer so a flight can never leave cards hidden if an animation is interrupted
  useEffect(() => {
    if (!session || session.phase === "dragging") return;
    completedIdRef.current = null;
    const timeoutMs =
      session.phase === "fly-in"
        ? 420
        : session.phase === "snap-back"
          ? 460
          : 360;
    const timer = window.setTimeout(() => {
      if (completedIdRef.current !== session.id) {
        completedIdRef.current = session.id;
        onFlightComplete(session.id);
      }
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [session?.id, session?.phase, onFlightComplete]);

  if (!session || session.items.length === 0) return null;

  const isMulti = session.items.length > 1;
  const isOverSidebar = session.sidebarTarget !== null;
  const compactStackMode = isMulti || isOverSidebar;
  const isDangerTarget = session.sidebarTarget?.kind === "trash";

  // During `dragging` or `fly-in`, render top 3-4 cards as a crisp Finder stack;
  // during `settling` or `snap-back`, render up to 6 cards so every dragged card flies visibly back to its own slot!
  const visibleItems =
    session.phase === "settling" || session.phase === "snap-back"
      ? session.items.slice(0, 6)
      : session.items.slice(0, MAX_VISIBLE_STACK_CARDS);

  // Base dimensions of the lifted card(s) under cursor
  const baseWidth = compactStackMode
    ? isOverSidebar
      ? 92
      : 132
    : Math.max(96, Math.min(340, session.primaryOriginRect.width));
  const primaryAspect =
    session.primaryOriginRect.height > 0
      ? session.primaryOriginRect.width / session.primaryOriginRect.height
      : 1.25;
  const baseHeight = compactStackMode
    ? isOverSidebar
      ? 68
      : 98
    : Math.max(82, Math.min(340, Math.round(baseWidth / Math.max(0.55, Math.min(2.1, primaryAspect)))));

  // Proportional cursor anchor so shrinking from full card -> compact sidebar stack stays silky under cursor
  const grabRatioX = Math.max(
    0.18,
    Math.min(0.82, session.grabOffsetX / Math.max(1, session.primaryOriginRect.width)),
  );
  const grabRatioY = Math.max(
    0.18,
    Math.min(0.82, session.grabOffsetY / Math.max(1, session.primaryOriginRect.height)),
  );
  const dragLeft = compactStackMode
    ? session.pointerX - baseWidth * (isMulti ? 0.5 : grabRatioX)
    : session.pointerX - session.grabOffsetX;
  const dragTop = compactStackMode
    ? session.pointerY - baseHeight * (isMulti ? 0.5 : grabRatioY)
    : session.pointerY - session.grabOffsetY;

  const markComplete = () => {
    if (completedIdRef.current !== session.id) {
      completedIdRef.current = session.id;
      onFlightComplete(session.id);
    }
  };

  const overlayNode = (
    <div
      className="atlas-drag-overlay"
      data-atlas-theme={theme}
      data-testid="atlas-drag-overlay"
      data-drag-phase={session.phase}
      data-drag-count={session.items.length}
      data-drag-oob={session.outOfBounds ? "true" : "false"}
      aria-hidden="true"
    >
      {/* Suction impact ripple when a stack flies into a sidebar row */}
      {session.phase === "fly-in" && session.flyInTargetPoint && (
        <motion.div
          key={`ripple-${session.id}`}
          className={`drag-flyin-ripple ${isDangerTarget ? "drag-flyin-ripple--danger" : ""}`}
          style={{
            left: session.flyInTargetPoint.x,
            top: session.flyInTargetPoint.y,
          }}
          initial={{ opacity: 0.85, scale: 0.25 }}
          animate={{ opacity: 0, scale: 2.3 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {/* Render stack back-to-front so index 0 sits crisply on top */}
      {[...visibleItems].reverse().map((item, revIdx) => {
        const stackIdx = visibleItems.length - 1 - revIdx;
        const pose = computeStackCardPose(
          stackIdx,
          visibleItems.length,
          isOverSidebar,
          session.tiltDeg,
        );

        const initialX = dragLeft + pose.offsetX;
        const initialY = dragTop + pose.offsetY;

        let targetX = initialX;
        let targetY = initialY;
        let targetW = baseWidth;
        let targetH = baseHeight;
        let targetRotate = pose.rotate;
        let targetScale =
          session.outOfBounds && !isOverSidebar
            ? pose.scale * 0.94
            : compactStackMode
              ? pose.scale
              : 1.032;
        let targetOpacity =
          session.outOfBounds && !isOverSidebar ? pose.opacity * 0.88 : pose.opacity;
        let targetRadius = compactStackMode ? Math.min(12, Math.max(8, session.radius)) : session.radius;

        if (session.phase === "settling" || session.phase === "snap-back") {
          const dest =
            session.targetRectsById[item.id] ?? session.primaryOriginRect;
          targetX = dest.left;
          targetY = dest.top;
          targetW = dest.width;
          targetH = dest.height;
          targetRotate = 0;
          targetScale = 1;
          targetOpacity = 1;
          targetRadius = session.radius;
        } else if (session.phase === "fly-in" && session.flyInTargetPoint) {
          const flyW = 86;
          const flyH = 64;
          targetX = session.flyInTargetPoint.x - flyW * 0.5;
          targetY = session.flyInTargetPoint.y - flyH * 0.5;
          targetW = flyW;
          targetH = flyH;
          targetRotate = stackIdx % 2 === 0 ? -12 : 10;
          targetScale = 0.14;
          targetOpacity = 0;
          targetRadius = 12;
        }

        const isDraggingPhase = session.phase === "dragging";
        const transition = isDraggingPhase
          ? {
              x: { duration: 0 },
              y: { duration: 0 },
              width: { type: "spring" as const, stiffness: 520, damping: 36 },
              height: { type: "spring" as const, stiffness: 520, damping: 36 },
              scale: { type: "spring" as const, stiffness: 460, damping: 32 },
              rotate: { type: "spring" as const, stiffness: 420, damping: 30 },
              opacity: { duration: 0.14 },
              borderRadius: { duration: 0.16 },
            }
          : session.phase === "fly-in"
            ? {
                duration: 0.28,
                delay: stackIdx * 0.032,
                ease: [0.32, 0.04, 0.18, 1] as const,
              }
            : session.phase === "snap-back"
              ? {
                  type: "spring" as const,
                  stiffness: 410,
                  damping: 30,
                  mass: 0.78,
                  delay: stackIdx * 0.018,
                }
              : {
                  type: "spring" as const,
                  stiffness: 490,
                  damping: 36,
                  mass: 0.72,
                  delay: stackIdx * 0.014,
                };

        return (
          <motion.div
            key={`${session.id}-${item.id}`}
            className={`drag-ghost-card ${
              isDraggingPhase ? "drag-ghost-card--lifted" : ""
            } ${session.outOfBounds && !isOverSidebar && isDraggingPhase ? "drag-ghost-card--oob" : ""} ${
              isOverSidebar && isDraggingPhase ? "drag-ghost-card--over-sidebar" : ""
            }`}
            initial={{
              x: initialX,
              y: initialY,
              width: baseWidth,
              height: baseHeight,
              rotate: pose.rotate,
              scale: compactStackMode ? pose.scale * 0.96 : 1,
              opacity: pose.opacity,
              borderRadius: targetRadius,
            }}
            animate={{
              x: targetX,
              y: targetY,
              width: targetW,
              height: targetH,
              rotate: targetRotate,
              scale: targetScale,
              opacity: targetOpacity,
              borderRadius: targetRadius,
            }}
            transition={transition}
            style={{
              zIndex: pose.zIndex,
            }}
            onAnimationComplete={() => {
              if (!isDraggingPhase && stackIdx === 0) {
                markComplete();
              }
            }}
          >
            <RichMediaCardContent
              item={item}
              theme={theme}
              imgFit={imgFit}
              interactiveAudio={false}
            />
          </motion.div>
        );
      })}

      {/* Count badge + contextual action / return pill pinned to the lead card during active drag */}
      {session.phase === "dragging" && (
        <motion.div
          className="drag-ghost-hud"
          animate={{
            x: dragLeft + baseWidth,
            y: dragTop,
          }}
          transition={{ duration: 0 }}
        >
          {session.items.length > 1 && (
            <motion.span
              className={`drag-stack-count-badge ${
                isDangerTarget ? "drag-stack-count-badge--danger" : ""
              }`}
              data-testid="drag-stack-count-badge"
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 580, damping: 28 }}
            >
              {session.items.length}
            </motion.span>
          )}
        </motion.div>
      )}

      {session.phase === "dragging" &&
        (session.sidebarTargetLabel || (session.outOfBounds && !isOverSidebar)) && (
          <motion.div
            className="drag-ghost-pill-anchor"
            animate={{
              x: dragLeft + baseWidth * 0.5,
              y: dragTop + baseHeight + (compactStackMode ? 18 : 14),
            }}
            transition={{ duration: 0 }}
          >
            <motion.div
              key={session.sidebarTargetLabel ?? "oob-hint"}
              className={`drag-action-pill ${
                isDangerTarget
                  ? "drag-action-pill--danger"
                  : session.sidebarTargetLabel
                    ? "drag-action-pill--target"
                    : "drag-action-pill--return"
              }`}
              data-testid="drag-action-pill"
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            >
              {session.sidebarTargetLabel ?? session.returnHintLabel}
            </motion.div>
          </motion.div>
        )}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlayNode, document.body)
    : overlayNode;
}
