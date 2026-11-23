import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ElasticMotionBar } from "./ElasticMotionBar";
import { HERO_MOTION_EASE } from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import type { LibraryItem } from "./library-engine";

export interface FontQuickLookViewerProps {
  item: LibraryItem;
  locale: AppLocale;
  onNotify: (message: string) => void;
}

type FontPreviewTab = "specimen" | "waterfall" | "glyphs";
type FontSheetTone = "paper" | "ink" | "cobalt";

const GLYPH_SET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "&", "@", "§",
  "→", "↗", "∞", "✳", "⌘", "⌥", "—", "«", "»", "永", "字", "体",
];

const WATERFALL_SIZES = [14, 18, 24, 34, 48, 64] as const;

export function FontQuickLookViewer({
  item,
  locale,
  onNotify,
}: FontQuickLookViewerProps) {
  const m = getMessages(locale);
  const meta = item.fontMeta!;

  const [tab, setTab] = useState<FontPreviewTab>("specimen");
  const [sampleText, setSampleText] = useState(() =>
    locale === "zh-CN"
      ? `${meta.sampleHeadline}\n设计不仅是外观，更是它如何运作。`
      : `${meta.sampleHeadline}\nThe quick brown fox jumps over 128 luminous prisms.`,
  );
  const [fontSize, setFontSize] = useState(44);
  const [weight, setWeight] = useState(meta.weights[1] ?? meta.weights[0] ?? 500);
  const [tracking, setTracking] = useState(-0.02);
  const [lineHeight, setLineHeight] = useState(1.25);
  // Start with the card's exact native tone (paper / ink / cobalt) so expanding has zero color flash
  const [sheetTone, setSheetTone] = useState<FontSheetTone>(meta.specimenTone);
  const [selectedGlyph, setSelectedGlyph] = useState("Aa");

  const isDarkSheet = sheetTone === "ink" || sheetTone === "cobalt";

  const handleGlyphClick = (glyph: string) => {
    setSelectedGlyph(glyph);
    navigator.clipboard?.writeText(glyph).catch(() => {});
    onNotify(`${m.fontCopiedGlyph}: ${glyph}`);
  };

  const sheetClass =
    sheetTone === "cobalt"
      ? "ql-font-stage--cobalt-sheet"
      : sheetTone === "ink"
        ? "ql-font-stage--dark-sheet"
        : "ql-font-stage--light-sheet";

  return (
    <div
      className={`ql-font-stage ${sheetClass}`}
      data-testid="ql-font-viewer"
      data-sheet-tone={sheetTone}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Specimen Toolbar — silky editorial reveal */}
      <motion.div
        className="ql-font-toolbar"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.04, ease: HERO_MOTION_EASE }}
      >
        <div className="ql-font-meta">
          <strong>{meta.family}</strong>
          <span>
            {meta.foundry} · {meta.format} · {meta.styleCount} {m.fontStylesUnit}
          </span>
        </div>

        <div className="ql-font-tabs" role="tablist">
          {(["specimen", "waterfall", "glyphs"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              data-testid={`ql-font-tab-${t}`}
              className={`ql-font-tab ${tab === t ? "ql-font-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "specimen"
                ? m.fontTabSpecimen
                : t === "waterfall"
                  ? m.fontTabWaterfall
                  : m.fontTabGlyphs}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ql-media-chip"
          onClick={() =>
            setSheetTone((prev) =>
              prev === "paper"
                ? meta.specimenTone === "cobalt"
                  ? "cobalt"
                  : "ink"
                : "paper",
            )
          }
        >
          {isDarkSheet ? m.fontPaperLight : m.fontPaperDark}
        </button>
      </motion.div>

      {/* Main Preview Canvas — smooth editorial unfolding + cross-fading tabs */}
      <motion.div
        className="ql-font-body"
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, delay: 0.07, ease: HERO_MOTION_EASE }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {tab === "specimen" && (
            <motion.div
              key="specimen"
              className="ql-font-specimen-wrap"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: HERO_MOTION_EASE }}
            >
              <textarea
                className="ql-font-editable"
                data-testid="ql-font-textarea"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                spellCheck={false}
                style={{
                  fontFamily: meta.cssFontFamily,
                  fontSize: `${fontSize}px`,
                  fontWeight: weight,
                  letterSpacing: `${tracking}em`,
                  lineHeight,
                }}
              />
              <p
                className="ql-font-paragraph-sample"
                style={{ fontFamily: meta.cssFontFamily }}
              >
                {meta.sampleBody}
              </p>
            </motion.div>
          )}

          {tab === "waterfall" && (
            <motion.div
              key="waterfall"
              className="ql-font-waterfall"
              data-testid="ql-font-waterfall"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: HERO_MOTION_EASE }}
            >
              {WATERFALL_SIZES.map((sz) => (
                <div key={sz} className="ql-font-wf-row">
                  <span className="ql-font-wf-size">{sz}px</span>
                  <span
                    className="ql-font-wf-text"
                    style={{
                      fontFamily: meta.cssFontFamily,
                      fontSize: `${sz}px`,
                      fontWeight: weight,
                      letterSpacing: `${tracking}em`,
                    }}
                  >
                    {sampleText.split("\n")[0] || meta.sampleHeadline}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {tab === "glyphs" && (
            <motion.div
              key="glyphs"
              className="ql-font-glyphs-layout"
              data-testid="ql-font-glyphs"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: HERO_MOTION_EASE }}
            >
              <div className="ql-font-glyph-hero">
                <span
                  className="ql-font-glyph-big"
                  style={{
                    fontFamily: meta.cssFontFamily,
                    fontWeight: weight,
                  }}
                >
                  {selectedGlyph}
                </span>
                <span className="ql-font-glyph-code">
                  U+
                  {(selectedGlyph.codePointAt(0) ?? 65)
                    .toString(16)
                    .toUpperCase()
                    .padStart(4, "0")}
                </span>
              </div>

              <div className="ql-font-glyph-grid">
                {GLYPH_SET.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`ql-font-glyph-cell ${selectedGlyph === g ? "ql-font-glyph-cell--active" : ""}`}
                    style={{ fontFamily: meta.cssFontFamily, fontWeight: weight }}
                    onClick={() => handleGlyphClick(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom Typography Controls Bar */}
      <motion.div
        className="ql-font-controls"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.11, ease: HERO_MOTION_EASE }}
      >
        <div className="ql-font-weights">
          {meta.weights.map((w) => (
            <button
              key={w}
              type="button"
              data-testid={`ql-font-weight-${w}`}
              className={`ql-media-chip ${weight === w ? "ql-media-chip--active" : ""}`}
              onClick={() => setWeight(w)}
            >
              {w}
            </button>
          ))}
        </div>

        <div className="ql-font-slider-group">
          <span>{m.fontSizeLabel}</span>
          <ElasticMotionBar
            min={18}
            max={88}
            step={1}
            value={fontSize}
            size="xs"
            width={106}
            ariaLabel={m.fontSizeLabel}
            testId="ql-font-size-slider"
            onChange={(nextSize) => setFontSize(nextSize)}
          />
          <strong>{fontSize}px</strong>
        </div>

        <div className="ql-font-slider-group">
          <span>{m.fontTrackingLabel}</span>
          <ElasticMotionBar
            min={-5}
            max={14}
            step={1}
            value={Math.round(tracking * 100)}
            size="xs"
            width={92}
            ariaLabel={m.fontTrackingLabel}
            testId="ql-font-tracking-slider"
            onChange={(nextTrack) => setTracking(nextTrack / 100)}
          />
          <strong>{tracking >= 0 ? `+${tracking.toFixed(2)}` : tracking.toFixed(2)}em</strong>
        </div>

        <div className="ql-font-slider-group">
          <span>{m.fontLeadingLabel}</span>
          <ElasticMotionBar
            min={100}
            max={190}
            step={1}
            value={Math.round(lineHeight * 100)}
            size="xs"
            width={92}
            ariaLabel={m.fontLeadingLabel}
            testId="ql-font-leading-slider"
            onChange={(nextLead) => setLineHeight(nextLead / 100)}
          />
          <strong>{lineHeight.toFixed(2)}</strong>
        </div>
      </motion.div>
    </div>
  );
}
