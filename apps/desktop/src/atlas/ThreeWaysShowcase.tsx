import type { AtlasViewMode } from "./atlas-data";
import { ATLAS_MEDIA, SHOWCASE_GALLERY } from "./atlas-media";

interface ThreeWaysShowcaseProps {
  onSelectMode: (mode: AtlasViewMode) => void;
}

const CANVAS_CLUSTER = [
  { img: ATLAS_MEDIA.retroWatch, left: "16%", top: "24%", w: "14%", ratio: "1 / 1" },
  { img: ATLAS_MEDIA.matteCamera, left: "32%", top: "24%", w: "14%", ratio: "4 / 3" },
  { img: ATLAS_MEDIA.pocketSynth, left: "48%", top: "24%", w: "15%", ratio: "4 / 3" },
  { img: ATLAS_MEDIA.modularAudio, left: "12%", top: "40%", w: "22%", ratio: "4 / 3" },
  { img: ATLAS_MEDIA.tactileDial, left: "36%", top: "40%", w: "16%", ratio: "1 / 1" },
  { img: ATLAS_MEDIA.ereaderHand, left: "54%", top: "40%", w: "11%", ratio: "3 / 4" },
  { img: ATLAS_MEDIA.pocketSynth, left: "12%", top: "59%", w: "20%", ratio: "4 / 3" },
  { img: ATLAS_MEDIA.matteCamera, left: "34%", top: "59%", w: "18%", ratio: "4 / 3" },
  { img: ATLAS_MEDIA.retroWatch, left: "54%", top: "59%", w: "12%", ratio: "1 / 1" },
  { img: ATLAS_MEDIA.tactileDial, left: "26%", top: "77%", w: "17%", ratio: "1 / 1" },
];

export function ThreeWaysShowcase({ onSelectMode }: ThreeWaysShowcaseProps) {
  const gridTiles = SHOWCASE_GALLERY.slice(0, 9);
  const infinityTiles = [
    ...SHOWCASE_GALLERY,
    ...SHOWCASE_GALLERY,
    SHOWCASE_GALLERY[0]!,
  ];

  return (
    <section className="atlas-section" id="views">
      <div className="atlas-container">
        <h2 className="atlas-h2">
          <span className="atlas-h2-strong">Three ways to look at your work.</span>{" "}
          Grid for scanning. Canvas for arranging. Infinity for losing yourself in
          it.
        </h2>

        <div className="three-ways-grid">
          {/* Card 1: Grid */}
          <article className="three-way-card">
            <button
              type="button"
              className="three-way-stage"
              onClick={() => onSelectMode("grid")}
              aria-label="Preview Grid view in Studio Display"
              style={{ border: 0, padding: 0, textAlign: "left" }}
            >
              <div className="preview-grid-inner">
                {gridTiles.map((item) => (
                  <div key={item.id} className="preview-grid-tile">
                    <img
                      src={item.image}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </button>
            <p className="three-way-caption">
              <strong>Grid.</strong> Everything, neatly. Zoom out and see a
              thousand things at once, zoom in and look at one properly.
            </p>
          </article>

          {/* Card 2: Canvas */}
          <article className="three-way-card">
            <button
              type="button"
              className="three-way-stage"
              onClick={() => onSelectMode("canvas")}
              aria-label="Preview Canvas view in Studio Display"
              style={{ border: 0, padding: 0, textAlign: "left" }}
            >
              <div className="preview-canvas-inner">
                {CANVAS_CLUSTER.map((node, index) => (
                  <div
                    key={index}
                    className="preview-canvas-tile"
                    style={{
                      left: node.left,
                      top: node.top,
                      width: node.w,
                      aspectRatio: node.ratio,
                    }}
                  >
                    <img
                      src={node.img}
                      alt="Arranged moodboard item"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
                <svg
                  className="preview-canvas-cursor"
                  viewBox="0 0 16 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 1.5L13.5 11.2L8.2 12L10.8 17.5L8.4 18.6L5.8 13.1L2 16.5V1.5Z"
                    fill="#111111"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>
            <p className="three-way-caption">
              <strong>Canvas.</strong> Push things around. Pile the ones that go
              together, leave gaps where you haven&apos;t figured it out yet.
            </p>
          </article>

          {/* Card 3: Infinity */}
          <article className="three-way-card">
            <button
              type="button"
              className="three-way-stage"
              onClick={() => onSelectMode("infinity")}
              aria-label="Preview Infinity view in Studio Display"
              style={{ border: 0, padding: 0, textAlign: "left" }}
            >
              <div className="preview-infinity-track">
                {infinityTiles.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="preview-infinity-tile"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </button>
            <p className="three-way-caption">
              <strong>Infinity.</strong> No edges, no end. Just drift until
              something catches your eye.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
