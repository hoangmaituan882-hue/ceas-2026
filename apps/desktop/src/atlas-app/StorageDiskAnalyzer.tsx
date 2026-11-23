import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioWaveIcon,
  CheckIcon,
  Cube3DIcon,
  FontTypeIcon,
  GifMotionIcon,
  LayersIcon,
  RefreshIcon,
  SettingsGearIcon,
  TrashIcon,
} from "./AppIcons";
import { getMessages, type AppLocale } from "./i18n";
import type { LibraryItem, ThemeMode } from "./library-engine";
import {
  buildDiskStorageModel,
  computeMatrixColumnLayout,
  computePixelCellState,
  formatBrowserQuota,
  formatGb,
  hitTestMatrixColumn,
  SCAN_DIRECTORY_STEPS,
  stepSegmentFocusMap,
  STORAGE_CATEGORY_SPECS,
  type ColumnRange,
  type StorageCategoryId,
} from "./storage-analyzer";

export interface StorageDiskAnalyzerProps {
  items: readonly LibraryItem[];
  theme: ThemeMode;
  locale: AppLocale;
  cachesCleared: boolean;
  trashEmptied: boolean;
  onClearCaches: (freedGb: number) => void;
  onEmptyTrash: (freedGb: number) => void;
  onRescanReset?: () => void;
}

type AnalyzerPhase = "scanning" | "idle" | "clearing-caches" | "emptying-trash";

interface SquareParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rgb: readonly [number, number, number];
}

const MATRIX_COLS = 96;
const MATRIX_ROWS = 14;
const CANVAS_HEIGHT = 98;
const SCAN_DURATION_MS = 1800;
const CLEAR_DURATION_MS = 1080;
const WAVE_DURATION_MS = 320;

function createZeroFocusMap(): Record<StorageCategoryId, number> {
  return Object.fromEntries(
    STORAGE_CATEGORY_SPECS.map((s) => [s.id, 0]),
  ) as Record<StorageCategoryId, number>;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Crisp category-specific outline icons matching macOS Light/Dark storage reference */
function CategoryGlyph({
  id,
  size = 15,
}: {
  id: StorageCategoryId;
  size?: number;
}) {
  switch (id) {
    case "apps":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.2" y="3" width="11.6" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.35" />
          <path d="M2.4 6.2H13.6" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      );
    case "developer":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M5.6 4.8L2.4 8L5.6 11.2M10.4 4.8L13.6 8L10.4 11.2"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "photos":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="2.4" stroke="currentColor" strokeWidth="1.35" />
          <circle cx="5.8" cy="6.1" r="1.1" fill="currentColor" />
          <path
            d="M2.8 11.4L6.3 8.1L8.9 10.5L10.7 8.9L13.4 11.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "movies":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.1" y="3" width="11.8" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.35" />
          <path
            d="M5.2 3.2V12.8M10.8 3.2V12.8M2.2 6.3H5.2M2.2 9.7H5.2M10.8 6.3H13.8M10.8 9.7H13.8"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case "models3d":
      return <Cube3DIcon size={size} />;
    case "audio":
      return <AudioWaveIcon size={size} />;
    case "fonts":
      return <FontTypeIcon size={size} />;
    case "gifs":
      return <GifMotionIcon size={size} />;
    case "documents":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4.2 2.4H9.4L12.4 5.4V12.4C12.4 13 11.9 13.5 11.3 13.5H4.2C3.6 13.5 3.1 13 3.1 12.4V3.5C3.1 2.9 3.6 2.4 4.2 2.4Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M5.4 8.2H10.1M5.4 10.6H8.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case "system":
      return <SettingsGearIcon size={size} />;
    case "caches":
      return <LayersIcon size={size} />;
    case "trash":
      return <TrashIcon size={size} />;
  }
}

export function StorageDiskAnalyzer({
  items,
  theme,
  locale,
  cachesCleared,
  trashEmptied,
  onClearCaches,
  onEmptyTrash,
  onRescanReset,
}: StorageDiskAnalyzerProps) {
  const m = useMemo(() => getMessages(locale), [locale]);
  const snapshot = useMemo(
    () =>
      buildDiskStorageModel(items, {
        locale,
        cachesCleared,
        trashEmptied,
      }),
    [items, locale, cachesCleared, trashEmptied],
  );

  const [phase, setPhase] = useState<AnalyzerPhase>("scanning");
  const [hoveredId, setHoveredId] = useState<StorageCategoryId | null>(null);
  const [scanTick, setScanTick] = useState({ progress: 0, pathIndex: 0 });
  const [clearingProgress, setClearingProgress] = useState(0);
  const [freedBanner, setFreedBanner] = useState<{
    freedGb: number;
    availableGb: number;
  } | null>(null);
  const [browserQuotaText, setBrowserQuotaText] = useState<string | null>(null);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({
    width: 580,
    height: CANVAS_HEIGHT,
  });

  // Live animation refs for zero-jank 60fps pixel transitions
  const focusMapRef = useRef<Record<StorageCategoryId, number>>(createZeroFocusMap());
  const waveStateRef = useRef<{
    id: StorageCategoryId | null;
    originCol: number;
    startedAt: number;
  }>({ id: null, originCol: 0, startedAt: 0 });
  const cursorColRef = useRef<number | null>(null);
  const hoveredIdRef = useRef<StorageCategoryId | null>(null);
  const particlesRef = useRef<SquareParticle[]>([]);
  const activeRangesRef = useRef<ColumnRange[]>([]);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<AnalyzerPhase>("scanning");
  const animStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const clearingInitialGbRef = useRef<number>(0);
  const clearingCategoryRef = useRef<"caches" | "trash" | null>(null);

  hoveredIdRef.current = hoveredId;
  phaseRef.current = phase;

  // Query real browser Storage API quota (gracefully optional)
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (cancelled) return;
          if (
            typeof est.usage === "number" &&
            typeof est.quota === "number" &&
            est.quota > 0
          ) {
            setBrowserQuotaText(formatBrowserQuota(est.usage, est.quota));
          }
        })
        .catch(() => {
          // Ignore environments where StorageManager is unavailable
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const computeLiveSegments = useCallback(
    (clearCat: "caches" | "trash" | null, clearFrac: number) => {
      if (!clearCat) return snapshot.segments;
      const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, clearFrac)), 2.2);
      return snapshot.segments.map((seg) => {
        if (seg.id !== clearCat) return seg;
        const remaining = Math.max(0, clearingInitialGbRef.current * (1 - eased));
        return { ...seg, gb: remaining };
      });
    },
    [snapshot.segments],
  );

  // Trigger subtle pixel spark burst along a segment when switching hover
  const spawnHoverSparks = useCallback((range: ColumnRange, originCol: number) => {
    const { width, height } = sizeRef.current;
    const padX = 4;
    const padTop = 10;
    const padBottom = 8;
    const barW = width - padX * 2;
    const barH = height - padTop - padBottom;
    const cellW = barW / MATRIX_COLS;
    const clampedCol = Math.min(
      range.endCol - 1,
      Math.max(range.startCol, originCol),
    );
    const sx = padX + (clampedCol + 0.5) * cellW;

    for (let i = 0; i < 4; i += 1) {
      particlesRef.current.push({
        x: sx + (Math.random() - 0.5) * cellW * 2.5,
        y: padTop + 3 + Math.random() * (barH - 6),
        vx: (Math.random() - 0.5) * 28,
        vy: -(16 + Math.random() * 28),
        life: 0,
        maxLife: 0.28 + Math.random() * 0.22,
        size: 3,
        rgb: range.rgb,
      });
    }
  }, []);

  // Core crisp square-pixel matrix renderer
  const paintCanvas = useCallback(
    (
      now: number,
      scanProgress: number,
      isScanning: boolean,
      clearCat: "caches" | "trash" | null,
      clearFrac: number,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const isDark = theme === "dark";
      const padX = 4;
      const padTop = 10;
      const padBottom = 8;
      const barX = padX;
      const barY = padTop;
      const barW = width - padX * 2;
      const barH = height - padTop - padBottom;
      const barRadius = 11;

      const cellW = barW / MATRIX_COLS;
      const cellH = barH / MATRIX_ROWS;
      // Razor-sharp square pixel size (fills ~64% of pitch for distinct pixel-grid look)
      const sq = Math.max(2.5, Math.min(cellW * 0.68, cellH * 0.66, 3.8));
      const sqSnapped = Math.round(sq * 2) / 2;

      const liveSegments = computeLiveSegments(clearCat, clearFrac);
      const ranges = computeMatrixColumnLayout(
        liveSegments,
        snapshot.totalCapacityGb,
        MATRIX_COLS,
      );
      activeRangesRef.current = ranges;

      const focusMap = focusMapRef.current;
      const maxFocus = Object.values(focusMap).reduce(
        (acc, v) => (v > acc ? v : acc),
        0,
      );
      const shimmerTick = Math.floor(now / 170); // crisp ~6fps digital twinkle while hovered

      const scanHeadCol = isScanning
        ? scanProgress * (MATRIX_COLS + 2)
        : MATRIX_COLS + 10;

      // 0. Draw subtle outer colored halo behind actively hovered segment (matches green glow in reference!)
      if (!isScanning) {
        for (const range of ranges) {
          const focus = focusMap[range.id] ?? 0;
          if (focus <= 0.04) continue;
          const [r, g, b] = range.rgb;
          const segX = barX + range.startCol * cellW;
          const segW = (range.endCol - range.startCol) * cellW;
          ctx.save();
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${
            (isDark ? 0.52 : 0.44) * focus
          })`;
          ctx.shadowBlur = 14;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${
            (isDark ? 0.2 : 0.16) * focus
          })`;
          drawRoundedRectPath(ctx, segX, barY + 1, segW, barH - 2, 4);
          ctx.fill();
          ctx.restore();
        }
      }

      // 1. Unified outer container background + rounded clip
      ctx.save();
      drawRoundedRectPath(ctx, barX, barY, barW, barH, barRadius);
      ctx.fillStyle = isDark ? "#0d0e11" : "#fafbfc";
      ctx.fill();
      ctx.clip();

      // Lookup occupied columns
      const colOwner = new Array<ColumnRange | null>(MATRIX_COLS).fill(null);
      for (const r of ranges) {
        for (let c = r.startCol; c < r.endCol; c += 1) {
          colOwner[c] = r;
        }
      }

      // 2. Crisp square pixel grid for free / unrevealed space
      ctx.fillStyle = isDark
        ? "rgba(255, 255, 255, 0.095)"
        : "rgba(148, 163, 184, 0.28)";
      for (let col = 0; col < MATRIX_COLS; col += 1) {
        const owner = colOwner[col];
        const revealed = !isScanning || col < scanHeadCol;
        if (owner && revealed) continue;
        const px = Math.round(barX + col * cellW + (cellW - sqSnapped) / 2);
        for (let row = 0; row < MATRIX_ROWS; row += 1) {
          const py = Math.round(barY + row * cellH + (cellH - sqSnapped) / 2);
          ctx.fillRect(px, py, sqSnapped, sqSnapped);
        }
      }

      // 3. Draw each occupied category segment with crisp square pixels & wave transitions
      for (let idx = 0; idx < ranges.length; idx += 1) {
        const range = ranges[idx]!;
        const visibleEnd = isScanning
          ? Math.min(range.endCol, Math.ceil(scanHeadCol))
          : range.endCol;
        if (visibleEnd <= range.startCol) continue;

        const focus = isScanning ? 0 : (focusMap[range.id] ?? 0);
        const isClearingThis = clearCat === range.id;
        // In Light mode, keep non-hovered segments vivid & readable (matching reference ~0.68 presence!)
        const otherDim =
          maxFocus > 0.02
            ? 1 - maxFocus * (1 - focus) * (isDark ? 0.62 : 0.28)
            : 1;

        const [r, g, b] = range.rgb;
        // Deepen slightly on hover in Light mode for punchy jewel-like pixel saturation
        const activeR = !isDark && focus > 0.2 ? Math.max(0, Math.round(r * (1 - focus * 0.14))) : r;
        const activeG = !isDark && focus > 0.2 ? Math.max(0, Math.round(g * (1 - focus * 0.12))) : g;
        const activeB = !isDark && focus > 0.2 ? Math.max(0, Math.round(b * (1 - focus * 0.12))) : b;

        const segX = barX + range.startCol * cellW;
        const segW = (visibleEnd - range.startCol) * cellW;

        // Soft tinted background wash inside the segment block
        const washAlpha =
          (isDark
            ? 0.08 + focus * 0.15
            : 0.075 + focus * 0.14) * otherDim;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${washAlpha})`;
        ctx.fillRect(segX, barY, segW, barH);

        // Compute directional wave progress for this segment
        const waveMatch = waveStateRef.current.id === range.id;
        const waveProgress = waveMatch
          ? Math.min(1, (now - waveStateRef.current.startedAt) / WAVE_DURATION_MS)
          : focus > 0.02
            ? 1
            : 0;
        const waveOriginCol = waveMatch
          ? waveStateRef.current.originCol
          : (range.startCol + range.endCol) / 2;

        // Paint crisp square pixels inside segment
        for (let col = range.startCol; col < visibleEnd; col += 1) {
          const px = Math.round(barX + col * cellW + (cellW - sqSnapped) / 2);
          const distFromScan = scanHeadCol - col;
          const scanFlash =
            isScanning && distFromScan > 0 && distFromScan < 4.5
              ? 1 - distFromScan / 4.5
              : 0;

          for (let row = 0; row < MATRIX_ROWS; row += 1) {
            const py = Math.round(barY + row * cellH + (cellH - sqSnapped) / 2);
            const cell = computePixelCellState({
              col,
              row,
              totalRows: MATRIX_ROWS,
              startCol: range.startCol,
              endCol: range.endCol,
              focus: isClearingThis ? 0.92 : focus,
              waveProgress,
              waveOriginCol,
              cursorCol:
                hoveredIdRef.current === range.id ? cursorColRef.current : null,
              shimmerTick: focus > 0.05 ? shimmerTick : 0,
            });

            let alpha = cell.intensity * otherDim;
            if (!isDark) {
              // Rich Light Mode pixel contrast (never pale or washed out)
              alpha = cell.isActivePixel
                ? Math.min(1, (0.64 + cell.intensity * 0.36) * otherDim)
                : Math.min(0.65, (0.2 + cell.intensity * 0.42) * otherDim);
            } else {
              alpha = cell.isActivePixel
                ? Math.min(1, (0.68 + cell.intensity * 0.32) * otherDim)
                : Math.min(0.55, (0.16 + cell.intensity * 0.36) * otherDim);
            }

            if (scanFlash > 0.15) {
              alpha = Math.min(1, alpha + scanFlash * 0.45);
            }

            // Crisp wavefront spark tint during hover sweep
            if (cell.spark > 0.25) {
              const boost = Math.round(cell.spark * (isDark ? 95 : 55));
              ctx.fillStyle = `rgba(${Math.min(255, activeR + boost)}, ${Math.min(
                255,
                activeG + boost,
              )}, ${Math.min(255, activeB + boost)}, ${Math.min(1, alpha + 0.22)})`;
            } else {
              ctx.fillStyle = `rgba(${activeR}, ${activeG}, ${activeB}, ${alpha})`;
            }

            ctx.fillRect(px, py, sqSnapped, sqSnapped);
          }
        }

        // Crisp colored top/bottom accent border + vertical divider seam
        const seamAlpha = (isDark ? 0.65 : 0.62) * otherDim + focus * 0.38;
        ctx.strokeStyle = `rgba(${activeR}, ${activeG}, ${activeB}, ${Math.min(1, seamAlpha)})`;
        ctx.lineWidth = focus > 0.35 ? 2 : 1.15;

        // Top & bottom colored accent rail per segment
        ctx.beginPath();
        ctx.moveTo(segX, barY + (focus > 0.35 ? 1 : 0.6));
        ctx.lineTo(segX + segW, barY + (focus > 0.35 ? 1 : 0.6));
        ctx.moveTo(segX, barY + barH - (focus > 0.35 ? 1 : 0.6));
        ctx.lineTo(segX + segW, barY + barH - (focus > 0.35 ? 1 : 0.6));
        ctx.stroke();

        // Crisp 1px vertical divider seams separating adjacent segments
        ctx.lineWidth = focus > 0.35 ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(segX + segW) - 0.5, barY);
        ctx.lineTo(Math.round(segX + segW) - 0.5, barY + barH);
        if (focus > 0.15 && range.startCol > 0) {
          ctx.moveTo(Math.round(segX) + 0.5, barY);
          ctx.lineTo(Math.round(segX) + 0.5, barY + barH);
        }
        ctx.stroke();
      }

      // 4. Sweeping luminous scanner beam during scanning phase
      if (isScanning && scanHeadCol > 0 && scanHeadCol < MATRIX_COLS + 1.5) {
        const beamX = barX + Math.min(MATRIX_COLS, scanHeadCol) * cellW;
        const trailW = 42;
        const grad = ctx.createLinearGradient(beamX - trailW, 0, beamX, 0);
        if (isDark) {
          grad.addColorStop(0, "rgba(255, 255, 255, 0)");
          grad.addColorStop(0.65, "rgba(180, 232, 255, 0.14)");
          grad.addColorStop(1, "rgba(255, 255, 255, 0.42)");
        } else {
          grad.addColorStop(0, "rgba(22, 163, 74, 0)");
          grad.addColorStop(0.65, "rgba(37, 99, 235, 0.12)");
          grad.addColorStop(1, "rgba(37, 99, 235, 0.34)");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(Math.max(barX, beamX - trailW), barY, trailW, barH);

        ctx.fillStyle = isDark
          ? "rgba(255, 255, 255, 0.9)"
          : "rgba(37, 99, 235, 0.85)";
        ctx.fillRect(Math.round(beamX) - 1, barY, 2, barH);
      }

      ctx.restore(); // end rounded bar clip

      // 5. Crisp unified outer border frame around the entire bar
      ctx.save();
      drawRoundedRectPath(ctx, barX + 0.5, barY + 0.5, barW - 1, barH - 1, barRadius);
      ctx.strokeStyle = isDark
        ? "rgba(255, 255, 255, 0.13)"
        : "rgba(15, 23, 42, 0.13)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 6. Crisp square evaporating / hover-spark particles floating above the bar
      const particles = particlesRef.current;
      if (particles.length > 0) {
        for (const p of particles) {
          const lifeRatio = Math.max(0, 1 - p.life / p.maxLife);
          const [r, g, b] = p.rgb;
          const ps = Math.max(2, Math.round(p.size * (0.7 + lifeRatio * 0.4)));
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${lifeRatio * 0.92})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), ps, ps);
        }
      }

      ctx.restore();
    },
    [computeLiveSegments, snapshot.totalCapacityGb, theme],
  );

  // Unified smart animation loop — wakes up on scan/clear/hover/decay, sleeps at 0% CPU when settled!
  const ensureAnimLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      const activePhase = phaseRef.current;

      // Advance floating square particles
      if (particlesRef.current.length > 0) {
        const alive: SquareParticle[] = [];
        for (const p of particlesRef.current) {
          p.life += dt;
          if (p.life < p.maxLife) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy *= 0.96;
            alive.push(p);
          }
        }
        particlesRef.current = alive;
      }

      if (activePhase === "scanning") {
        const elapsed = now - animStartRef.current;
        const linear = Math.min(1, elapsed / SCAN_DURATION_MS);
        const eased = 1 - Math.pow(1 - linear, 2.5);
        const pathIdx = Math.min(
          SCAN_DIRECTORY_STEPS.length - 1,
          Math.floor(linear * SCAN_DIRECTORY_STEPS.length),
        );
        setScanTick({ progress: eased, pathIndex: pathIdx });
        paintCanvas(now, eased, true, null, 0);

        if (linear >= 1) {
          phaseRef.current = "idle";
          setPhase("idle");
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (activePhase === "clearing-caches" || activePhase === "emptying-trash") {
        const elapsed = now - animStartRef.current;
        const clearCat = clearingCategoryRef.current;
        const clearFrac = Math.min(1, elapsed / CLEAR_DURATION_MS);
        setClearingProgress(clearFrac);

        // Emit crisp square pixel particles from the eroding right edge
        const liveSegs = computeLiveSegments(clearCat, clearFrac);
        const liveRanges = computeMatrixColumnLayout(
          liveSegs,
          snapshot.totalCapacityGb,
          MATRIX_COLS,
        );
        const erodingRange = clearCat
          ? liveRanges.find((r) => r.id === clearCat)
          : null;

        if (erodingRange && clearFrac < 0.94) {
          const { width, height } = sizeRef.current;
          const padX = 4;
          const padTop = 10;
          const padBottom = 8;
          const cellW = (width - padX * 2) / MATRIX_COLS;
          const barH = height - padTop - padBottom;
          const edgeX = padX + erodingRange.endCol * cellW;

          for (let i = 0; i < 4; i += 1) {
            particlesRef.current.push({
              x: edgeX - Math.random() * Math.max(8, cellW * 3),
              y: padTop + Math.random() * barH,
              vx: (Math.random() - 0.36) * 32,
              vy: -(28 + Math.random() * 58),
              life: 0,
              maxLife: 0.45 + Math.random() * 0.45,
              size: 3.5,
              rgb: erodingRange.rgb,
            });
          }
        }

        paintCanvas(now, 1, false, clearCat, clearFrac);

        if (clearFrac >= 1 && particlesRef.current.length === 0) {
          const freed = clearingInitialGbRef.current;
          const nextAvail = Math.round((snapshot.availableGb + freed) * 10) / 10;
          setFreedBanner({ freedGb: freed, availableGb: nextAvail });
          setClearingProgress(0);
          clearingCategoryRef.current = null;
          phaseRef.current = "idle";
          setPhase("idle");
          if (clearCat === "caches") {
            onClearCaches(freed);
          } else if (clearCat === "trash") {
            onEmptyTrash(freed);
          }
          rafRef.current = null;
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Idle phase: advance smooth per-segment hover focus & living shimmer
      const stepped = stepSegmentFocusMap(
        focusMapRef.current,
        hoveredIdRef.current,
        dt,
      );
      focusMapRef.current = stepped.next;

      const waveActive =
        waveStateRef.current.id !== null &&
        now - waveStateRef.current.startedAt < WAVE_DURATION_MS + 60;

      paintCanvas(now, 1, false, null, 0);

      // Keep running while hovered (living pixel twinkle!), while focus is decaying, or while particles/wave exist
      const keepAlive =
        hoveredIdRef.current !== null ||
        !stepped.settled ||
        waveActive ||
        particlesRef.current.length > 0;

      if (keepAlive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [
    computeLiveSegments,
    onClearCaches,
    onEmptyTrash,
    paintCanvas,
    snapshot.availableGb,
    snapshot.totalCapacityGb,
  ]);

  // Kick off initial scan on mount & clean up rAF on unmount
  useEffect(() => {
    animStartRef.current = performance.now();
    phaseRef.current = "scanning";
    ensureAnimLoop();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [ensureAnimLoop]);

  // ResizeObserver for crisp high-DPI canvas sizing
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const syncSize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width > 40) {
        sizeRef.current = { width: rect.width, height: CANVAS_HEIGHT };
        paintCanvas(performance.now(), 1, phaseRef.current === "scanning", null, 0);
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paintCanvas]);

  // Repaint on theme or snapshot changes when idle
  useEffect(() => {
    if (phase === "idle" && rafRef.current === null) {
      paintCanvas(performance.now(), 1, false, null, 0);
    }
  }, [phase, snapshot, theme, paintCanvas]);

  // Helper to change hover category with directional pixel sweep + spark burst
  const activateHover = useCallback(
    (nextId: StorageCategoryId | null, originCol?: number) => {
      if (nextId !== hoveredIdRef.current) {
        if (nextId !== null) {
          const range = activeRangesRef.current.find((r) => r.id === nextId);
          const col =
            originCol ??
            (range ? Math.round((range.startCol + range.endCol) / 2) : 0);
          waveStateRef.current = {
            id: nextId,
            originCol: col,
            startedAt: performance.now(),
          };
          if (range) {
            spawnHoverSparks(range, col);
          }
        }
        hoveredIdRef.current = nextId;
        setHoveredId(nextId);
        ensureAnimLoop();
      }
    },
    [ensureAnimLoop, spawnHoverSparks],
  );

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "idle") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const padX = 4;
    const innerW = Math.max(1, rect.width - padX * 2);
    const relX = e.clientX - rect.left - padX;
    const col = Math.floor((relX / innerW) * MATRIX_COLS);
    cursorColRef.current = col;
    const hit = hitTestMatrixColumn(col, activeRangesRef.current);
    activateHover(hit, col);
    if (hit) ensureAnimLoop();
  };

  const handleCanvasPointerLeave = () => {
    cursorColRef.current = null;
    activateHover(null);
  };

  const handleTriggerRescan = () => {
    particlesRef.current = [];
    clearingCategoryRef.current = null;
    focusMapRef.current = createZeroFocusMap();
    cursorColRef.current = null;
    hoveredIdRef.current = null;
    setHoveredId(null);
    setFreedBanner(null);
    setScanTick({ progress: 0, pathIndex: 0 });
    onRescanReset?.();
    animStartRef.current = performance.now();
    phaseRef.current = "scanning";
    setPhase("scanning");
    ensureAnimLoop();
  };

  const handleStartClear = (kind: "caches" | "trash") => {
    if (phaseRef.current !== "idle") return;
    const targetSeg = snapshot.segments.find((s) => s.id === kind);
    if (!targetSeg || targetSeg.gb <= 0.05) return;
    clearingInitialGbRef.current = targetSeg.gb;
    clearingCategoryRef.current = kind;
    particlesRef.current = [];
    cursorColRef.current = null;
    hoveredIdRef.current = null;
    setHoveredId(null);
    setFreedBanner(null);
    setClearingProgress(0);
    animStartRef.current = performance.now();
    const nextPhase = kind === "caches" ? "clearing-caches" : "emptying-trash";
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    ensureAnimLoop();
  };

  // Live headline GB figure
  const displayedUsedGb = useMemo(() => {
    if (phase === "scanning") {
      return Math.round(snapshot.usedGb * scanTick.progress * 10) / 10;
    }
    if (phase === "clearing-caches" || phase === "emptying-trash") {
      const eased = 1 - Math.pow(1 - Math.min(1, clearingProgress), 2.2);
      return Math.max(
        0,
        Math.round((snapshot.usedGb - clearingInitialGbRef.current * eased) * 10) /
          10,
      );
    }
    return snapshot.usedGb;
  }, [phase, snapshot.usedGb, scanTick.progress, clearingProgress]);

  const hoveredSegment = useMemo(
    () =>
      hoveredId
        ? snapshot.segments.find((s) => s.id === hoveredId) ?? null
        : null,
    [hoveredId, snapshot.segments],
  );

  const cachesSeg = snapshot.segments.find((s) => s.id === "caches");
  const trashSeg = snapshot.segments.find((s) => s.id === "trash");
  const activeScanPath =
    SCAN_DIRECTORY_STEPS[scanTick.pathIndex] ?? SCAN_DIRECTORY_STEPS[0]!;

  const statusKey =
    phase !== "idle"
      ? `phase-${phase}`
      : hoveredSegment
        ? `hover-${hoveredSegment.id}`
        : freedBanner
          ? `freed-${freedBanner.availableGb}`
          : "idle";

  return (
    <section
      className="storage-analyzer-card"
      data-testid="storage-disk-analyzer"
      data-analyzer-phase={phase}
      aria-label={m.setStorageBreakdownTitle}
    >
      {/* Top Headline + Smoothly Crossfading Dynamic Status Line + Rescan Button */}
      <div className="storage-analyzer-head">
        <div className="storage-analyzer-head-left">
          <div className="storage-analyzer-headline">
            <span
              className="storage-analyzer-used"
              data-testid="storage-used-gb"
            >
              {formatGb(displayedUsedGb)}
            </span>
            <span className="storage-analyzer-cap">
              {m.storageOfTotalUsed(snapshot.totalCapacityGb)}
            </span>
          </div>

          <div
            className="storage-analyzer-status"
            data-testid="storage-status-line"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={statusKey}
                className="storage-status-motion"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              >
                {phase === "scanning" ? (
                  <span className="storage-status-scan">
                    <span className="storage-status-muted">
                      {m.storageCalculating}
                    </span>
                    <span className="storage-status-path">{activeScanPath}</span>
                  </span>
                ) : phase === "clearing-caches" ? (
                  <span className="storage-status-action">
                    <span className="storage-cat-icon" style={{ color: "#ea580c" }}>
                      <CategoryGlyph id="caches" size={14} />
                    </span>
                    <span className="storage-status-muted">
                      {m.storageClearingCaches}
                    </span>
                    <span className="storage-status-path">
                      ~/Library/Caches/com.atlas.studio
                    </span>
                  </span>
                ) : phase === "emptying-trash" ? (
                  <span className="storage-status-action">
                    <span className="storage-cat-icon" style={{ color: "#dc2626" }}>
                      <CategoryGlyph id="trash" size={14} />
                    </span>
                    <span className="storage-status-muted">
                      {m.storageEmptyingTrash}
                    </span>
                    <span className="storage-status-path">~/.Trash</span>
                  </span>
                ) : hoveredSegment ? (
                  <span
                    className="storage-status-hover"
                    data-testid="storage-hover-detail"
                  >
                    <span
                      className="storage-cat-icon"
                      style={{ color: hoveredSegment.color }}
                    >
                      <CategoryGlyph id={hoveredSegment.id} size={14} />
                    </span>
                    <strong className="storage-status-cat">
                      {hoveredSegment.label}
                    </strong>
                    <span className="storage-status-gb">
                      {formatGb(hoveredSegment.gb)}
                    </span>
                    <span className="storage-status-desc">
                      {hoveredSegment.detail}
                    </span>
                  </span>
                ) : freedBanner ? (
                  <span
                    className="storage-status-freed"
                    data-testid="storage-freed-banner"
                  >
                    <span className="storage-freed-check">
                      <CheckIcon size={12} />
                    </span>
                    <span>
                      {m.storageFreedSummary(
                        formatGb(freedBanner.freedGb),
                        formatGb(freedBanner.availableGb),
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="storage-status-idle">
                    <span>{m.storageHoverPrompt}</span>
                    {browserQuotaText && (
                      <span className="storage-quota-chip">
                        {m.storageLiveQuotaLabel}: {browserQuotaText}
                      </span>
                    )}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <button
          type="button"
          className={`storage-rescan-btn ${
            phase === "scanning" ? "storage-rescan-btn--spinning" : ""
          }`}
          data-testid="storage-rescan-btn"
          onClick={handleTriggerRescan}
          disabled={phase === "clearing-caches" || phase === "emptying-trash"}
        >
          <span className="storage-rescan-icon" aria-hidden="true">
            <RefreshIcon size={12} />
          </span>
          <span>{m.storageRescan}</span>
        </button>
      </div>

      {/* Live Crisp Square-Pixel Disk Progress Bar */}
      <div className="storage-matrix-well" ref={canvasWrapRef}>
        <canvas
          ref={canvasRef}
          className="storage-matrix-canvas"
          data-testid="storage-matrix-canvas"
          aria-label={m.storageHoverPrompt}
          onPointerMove={handleCanvasPointerMove}
          onPointerLeave={handleCanvasPointerLeave}
        />
      </div>

      {/* 12-Category 3×4 Symmetric Legend Grid with Spring-Gliding Hover Pill */}
      <div className="storage-legend-grid" role="list">
        {snapshot.segments.map((seg) => {
          const isHovered = hoveredId === seg.id;
          const isDimmed = hoveredId !== null && !isHovered;
          const isZero = seg.gb <= 0.05;
          const liveGb =
            phase === "scanning"
              ? Math.round(seg.gb * scanTick.progress * 10) / 10
              : (phase === "clearing-caches" && seg.id === "caches") ||
                  (phase === "emptying-trash" && seg.id === "trash")
                ? Math.max(
                    0,
                    Math.round(
                      clearingInitialGbRef.current *
                        (1 - Math.pow(1 - Math.min(1, clearingProgress), 2.2)) *
                        10,
                    ) / 10,
                  )
                : seg.gb;

          return (
            <button
              key={seg.id}
              type="button"
              role="listitem"
              data-testid={`storage-legend-${seg.id}`}
              className={`storage-legend-item ${
                isHovered ? "storage-legend-item--active" : ""
              } ${isDimmed ? "storage-legend-item--dimmed" : ""} ${
                isZero ? "storage-legend-item--zero" : ""
              }`}
              onMouseEnter={() => {
                if (phase === "idle" && !isZero) activateHover(seg.id);
              }}
              onMouseLeave={() => {
                if (hoveredId === seg.id) activateHover(null);
              }}
              onFocus={() => {
                if (phase === "idle" && !isZero) activateHover(seg.id);
              }}
              onBlur={() => {
                if (hoveredId === seg.id) activateHover(null);
              }}
            >
              {isHovered && (
                <motion.span
                  layoutId="storage-legend-hover-pill"
                  className="storage-legend-pill-bg"
                  transition={{
                    type: "spring",
                    stiffness: 520,
                    damping: 36,
                    mass: 0.72,
                  }}
                  aria-hidden="true"
                />
              )}
              <span
                className="storage-cat-icon storage-legend-icon"
                style={{ color: seg.color }}
              >
                <CategoryGlyph id={seg.id} size={14} />
              </span>
              <span className="storage-legend-name">{seg.label}</span>
              <span className="storage-legend-gb">{formatGb(liveGb)}</span>
            </button>
          );
        })}
      </div>

      {/* Contextual Action Footer Bar */}
      <div
        className="storage-analyzer-footer"
        data-testid="storage-analyzer-footer"
      >
        {phase === "scanning" ? (
          <div className="storage-footer-info">
            <span className="storage-spinner" aria-hidden="true" />
            <span>{m.storageFooterScanning}</span>
          </div>
        ) : phase === "clearing-caches" || phase === "emptying-trash" ? (
          <div className="storage-footer-info">
            <span className="storage-spinner" aria-hidden="true" />
            <span>{m.storageFooterReclaiming}</span>
          </div>
        ) : cachesSeg && cachesSeg.gb > 0.05 ? (
          <>
            <div className="storage-footer-info">
              <span className="storage-cat-icon" style={{ color: cachesSeg.color }}>
                <CategoryGlyph id="caches" size={14} />
              </span>
              <span>{m.storageFooterCachesHint(formatGb(cachesSeg.gb))}</span>
            </div>
            <button
              type="button"
              className="storage-action-btn"
              data-testid="storage-clear-caches-btn"
              onMouseEnter={() => activateHover("caches")}
              onMouseLeave={() => activateHover(null)}
              onClick={() => handleStartClear("caches")}
            >
              {m.storageBtnClearCaches}
            </button>
          </>
        ) : trashSeg && trashSeg.gb > 0.05 ? (
          <>
            <div className="storage-footer-info">
              <span className="storage-cat-icon" style={{ color: trashSeg.color }}>
                <CategoryGlyph id="trash" size={14} />
              </span>
              <span>{m.storageFooterTrashHint(formatGb(trashSeg.gb))}</span>
            </div>
            <button
              type="button"
              className="storage-action-btn storage-action-btn--danger"
              data-testid="storage-empty-trash-btn"
              onMouseEnter={() => activateHover("trash")}
              onMouseLeave={() => activateHover(null)}
              onClick={() => handleStartClear("trash")}
            >
              {m.storageBtnEmptyTrash}
            </button>
          </>
        ) : (
          <div className="storage-footer-info storage-footer-info--clean">
            <span className="storage-freed-check" aria-hidden="true">
              <CheckIcon size={12} />
            </span>
            <span>{m.storageFooterAllClean}</span>
          </div>
        )}
      </div>
    </section>
  );
}
