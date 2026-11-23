import { useMemo, useState } from "react";
import {
  SIDEBAR_COLLECTIONS,
  clampZoom,
  filterGalleryItems,
  type AtlasViewMode,
} from "./atlas-data";
import { SHOWCASE_GALLERY } from "./atlas-media";
import { AppleLogo } from "./AtlasIcons";

interface HeroMacShowcaseProps {
  activeMode: AtlasViewMode;
  onModeChange: (mode: AtlasViewMode) => void;
}

export function HeroMacShowcase({
  activeMode,
  onModeChange,
}: HeroMacShowcaseProps) {
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [zoom, setZoom] = useState<number>(1.2);

  const visibleItems = useMemo(
    () => filterGalleryItems(SHOWCASE_GALLERY, activeCollection),
    [activeCollection],
  );

  const gridColumns = zoom >= 1.5 ? 3 : zoom <= 0.9 ? 5 : 4;
  const infinityTiles = useMemo(
    () => [...SHOWCASE_GALLERY, ...SHOWCASE_GALLERY, ...SHOWCASE_GALLERY],
    [],
  );

  return (
    <section
      className="atlas-stage"
      aria-label="Atlas for Mac displaying an organized visual library of reference images"
    >
      <div className="mac-rig">
        <div className="studio-display">
          <div className="studio-camera" aria-hidden="true" />
          <div className="macos-screen">
            <div className="macos-menubar" aria-hidden="true">
              <div className="macos-menubar-left">
                <AppleLogo size={9} />
                <strong>Finder</strong>
                <span className="macos-menubar-extra">File</span>
                <span className="macos-menubar-extra">Edit</span>
                <span className="macos-menubar-extra">View</span>
                <span className="macos-menubar-extra">Go</span>
                <span className="macos-menubar-extra">Window</span>
                <span className="macos-menubar-extra">Help</span>
              </div>
              <div className="macos-menubar-right">
                <span>Mon Jun 10 9:41 AM</span>
              </div>
            </div>

            <div className="macos-desktop-bg">
              <div
                className="atlas-app-window"
                data-testid="hero-mac-app"
                data-mode={activeMode}
              >
                <aside className="atlas-app-sidebar" aria-label="Library sidebar">
                  <div className="traffic-lights" aria-hidden="true">
                    <span className="traffic-dot traffic-dot--red" />
                    <span className="traffic-dot traffic-dot--yellow" />
                    <span className="traffic-dot traffic-dot--green" />
                  </div>

                  <div className="sidebar-list">
                    <button
                      type="button"
                      className={
                        activeCollection === "all"
                          ? "sidebar-row sidebar-row--active"
                          : "sidebar-row"
                      }
                      onClick={() => setActiveCollection("all")}
                    >
                      <span className="sidebar-row-name">All Items</span>
                      <span className="sidebar-row-count">110</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-row"
                      onClick={() => setActiveCollection("onboarding")}
                    >
                      <span className="sidebar-row-name">Inbox</span>
                      <span className="sidebar-row-count">23</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-row"
                      onClick={() => setActiveCollection("memes")}
                    >
                      <span className="sidebar-row-name">Trash</span>
                      <span className="sidebar-row-count">13</span>
                    </button>

                    <div className="sidebar-group-label">COLLECTIONS</div>
                    {SIDEBAR_COLLECTIONS.slice(1).map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        className={
                          activeCollection === col.id
                            ? "sidebar-row sidebar-row--active"
                            : "sidebar-row"
                        }
                        onClick={() => setActiveCollection(col.id)}
                      >
                        <span className="sidebar-row-name">{col.name}</span>
                        <span className="sidebar-row-count">{col.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="sidebar-footer">
                    <span>My library</span>
                    <span aria-hidden="true">⌄</span>
                  </div>
                </aside>

                <div className="atlas-app-main">
                  {activeMode === "grid" && (
                    <div
                      className="app-grid-view"
                      style={{
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                      }}
                    >
                      {visibleItems.map((item) => (
                        <div
                          key={item.id}
                          className="app-grid-card"
                          style={{
                            aspectRatio:
                              item.aspect === "portrait"
                                ? "3 / 4"
                                : item.aspect === "square"
                                  ? "1 / 1"
                                  : "4 / 3",
                          }}
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {activeMode === "canvas" && (
                    <div className="app-canvas-view">
                      {visibleItems.slice(0, 8).map((item) => (
                        <div
                          key={item.id}
                          className="app-canvas-node"
                          style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            width: `${Math.round(item.width * (zoom / 1.2))}px`,
                            aspectRatio:
                              item.aspect === "portrait"
                                ? "3 / 4"
                                : item.aspect === "square"
                                  ? "1 / 1"
                                  : "4 / 3",
                          }}
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {activeMode === "infinity" && (
                    <div className="app-infinity-view">
                      <div className="app-infinity-track">
                        {infinityTiles.map((item, idx) => (
                          <div key={`${item.id}-${idx}`} className="app-infinity-tile">
                            <img
                              src={item.image}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="app-bottom-dock">
                    <div
                      className="app-mode-pill"
                      role="tablist"
                      aria-label="Preview view mode"
                    >
                      {(["grid", "canvas", "infinity"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          role="tab"
                          aria-selected={activeMode === mode}
                          className={
                            activeMode === mode
                              ? "app-mode-btn app-mode-btn--active"
                              : "app-mode-btn"
                          }
                          onClick={() => onModeChange(mode)}
                        >
                          {mode === "grid"
                            ? "Grid"
                            : mode === "canvas"
                              ? "Canvas"
                              : "Infinity"}
                        </button>
                      ))}
                    </div>

                    <label className="app-zoom-pill" aria-label="Zoom level">
                      <input
                        className="app-zoom-slider"
                        type="range"
                        min={0.7}
                        max={1.8}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
                      />
                      <span>×{zoom.toFixed(1)}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="studio-stand-area" aria-hidden="true">
          <div className="mac-studio-box">
            <div className="mac-studio-ports">
              <span className="mac-usbc" />
              <span className="mac-usbc" />
              <span className="mac-sd-slot" />
            </div>
            <span className="mac-led" />
            <div className="mac-studio-base" />
          </div>
          <div className="studio-stand-neck" />
          <div className="studio-stand-foot" />
        </div>
      </div>
    </section>
  );
}
