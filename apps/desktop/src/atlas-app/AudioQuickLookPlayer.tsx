import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { atlasAudioEngine, type AudioPlaybackSnapshot } from "./audio-synth-engine";
import { MOTION_BAR_ORANGE } from "./elastic-motion-bar";
import { ElasticMotionBar, MorphingAudioDialBar } from "./ElasticMotionBar";
import { HERO_MOTION_EASE } from "./hero-transition";
import { getMessages, type AppLocale } from "./i18n";
import { formatAudioTime } from "./media-helpers";
import type { LibraryItem } from "./library-engine";

export interface AudioQuickLookPlayerProps {
  item: LibraryItem;
  locale: AppLocale;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

export function AudioQuickLookPlayer({
  item,
  locale,
}: AudioQuickLookPlayerProps) {
  const m = getMessages(locale);
  const meta = item.audioMeta!;
  const [snap, setSnap] = useState<AudioPlaybackSnapshot>(() =>
    atlasAudioEngine.getSnapshot(),
  );

  useEffect(() => {
    atlasAudioEngine.loadTrack(item.id, meta, false);
    const unsub = atlasAudioEngine.subscribe(setSnap);
    return () => {
      unsub();
    };
  }, [item.id, meta]);

  // Space toggles play/pause inside Audio QuickLook
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        atlasAudioEngine.toggle(item.id, meta);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [item.id, meta]);

  const isThisTrack = snap.activeItemId === item.id;
  const isPlaying = isThisTrack && snap.isPlaying;
  const currentTime = isThisTrack ? snap.currentTime : 0;
  const duration = isThisTrack ? snap.duration : meta.durationSec;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const handleSeekRatio = (ratio: number) => {
    if (!isThisTrack) atlasAudioEngine.loadTrack(item.id, meta, false);
    atlasAudioEngine.seek(Math.max(0, Math.min(1, ratio)) * duration);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    handleSeekRatio((e.clientX - rect.left) / rect.width);
  };

  const handleCycleRate = () => {
    const idx = PLAYBACK_RATES.indexOf(
      snap.playbackRate as (typeof PLAYBACK_RATES)[number],
    );
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length] ?? 1;
    atlasAudioEngine.setPlaybackRate(next);
  };

  const handleReset = () => {
    if (!isThisTrack) atlasAudioEngine.loadTrack(item.id, meta, false);
    atlasAudioEngine.seek(0);
    if (isPlaying) {
      atlasAudioEngine.toggle(item.id, meta);
    }
  };

  return (
    <div
      className="ql-audio-stage"
      data-testid="ql-audio-player"
      style={{ ["--audio-accent" as string]: MOTION_BAR_ORANGE }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Track Identity + Compact Live Spectrum */}
      <motion.div
        className="ql-audio-header"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.03, ease: HERO_MOTION_EASE }}
      >
        <div className="ql-audio-artwork" aria-hidden="true">
          <div className="ql-audio-eq">
            {snap.levels.slice(0, 12).map((lvl, idx) => (
              <span
                key={idx}
                className="ql-audio-eq-bar"
                style={{
                  height: `${Math.round(Math.max(12, (isPlaying ? lvl : 0.16) * 100))}%`,
                }}
              />
            ))}
          </div>
          <span className="ql-audio-artwork-fmt">{meta.format}</span>
        </div>

        <div className="ql-audio-identity">
          <h2 className="ql-audio-title">{item.title}</h2>
          <p className="ql-audio-artist">
            {meta.artist}
            <span aria-hidden="true"> · </span>
            {meta.sampleRate}
            <span aria-hidden="true"> · </span>
            {meta.bpm} BPM
          </p>
        </div>
      </motion.div>

      {/* Hero Linear-Bar <-> 360° Circular Ring Morphing Scrubber */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, delay: 0.07, ease: HERO_MOTION_EASE }}
      >
        <MorphingAudioDialBar
          progress={progress}
          isPlaying={isPlaying}
          formattedTime={formatAudioTime(currentTime)}
          kicker={`${meta.format} · ${meta.bpm} BPM`}
          playLabel={m.mediaPlay}
          pauseLabel={m.mediaPause}
          resetLabel={m.dockReset}
          scrubLabel={m.audioScrubLabel}
          onTogglePlay={() => atlasAudioEngine.toggle(item.id, meta)}
          onReset={handleReset}
          onSeek={handleSeekRatio}
        />
      </motion.div>

      {/* Compact Interactive 64-Bar Waveform Strip Harmonized with #F2901B */}
      <motion.div
        className="ql-audio-wave-block ql-audio-wave-block--compact"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.1, ease: HERO_MOTION_EASE }}
      >
        <div
          className="ql-audio-waveform ql-audio-waveform--compact"
          role="slider"
          tabIndex={0}
          aria-label={m.audioScrubLabel}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          data-testid="ql-audio-waveform"
          onClick={handleSeekClick}
        >
          {meta.peaks.map((peak, idx) => {
            const frac = idx / Math.max(1, meta.peaks.length - 1);
            const passed = frac <= progress;
            return (
              <span
                key={idx}
                className={`ql-audio-wave-bar ${passed ? "ql-audio-wave-bar--passed" : ""}`}
                style={{ height: `${Math.round(Math.max(14, peak * 100))}%` }}
              />
            );
          })}
          <span
            className="ql-audio-playhead"
            style={{ left: `${progress * 100}%` }}
            aria-hidden="true"
          />
        </div>
      </motion.div>

      {/* Secondary Studio Controls: Loop, Rate, ±10s, Volume Elastic Motion Bar */}
      <motion.div
        className="ql-audio-controls"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.13, ease: HERO_MOTION_EASE }}
      >
        <div className="ql-audio-controls-left">
          <button
            type="button"
            className={`ql-media-chip ${snap.loop ? "ql-media-chip--active" : ""}`}
            onClick={() => atlasAudioEngine.toggleLoop()}
            data-testid="ql-audio-loop-btn"
          >
            {m.mediaLoop}
          </button>
          <button
            type="button"
            className="ql-media-chip"
            onClick={handleCycleRate}
            data-testid="ql-audio-rate-btn"
          >
            {snap.playbackRate}×
          </button>
          <button
            type="button"
            className="ql-media-chip"
            onClick={() => atlasAudioEngine.seek(currentTime - 10)}
            aria-label="-10s"
          >
            -10s
          </button>
          <button
            type="button"
            className="ql-media-chip"
            onClick={() => atlasAudioEngine.seek(currentTime + 10)}
            aria-label="+10s"
          >
            +10s
          </button>
        </div>

        <div className="ql-audio-volume">
          <button
            type="button"
            className="ql-media-chip"
            onClick={() => atlasAudioEngine.toggleMute()}
            aria-label={snap.muted ? m.audioUnmute : m.audioMute}
          >
            {snap.muted ? m.audioMuted : `${Math.round(snap.volume * 100)}%`}
          </button>
          <ElasticMotionBar
            min={0}
            max={100}
            step={1}
            value={snap.muted ? 0 : Math.round(snap.volume * 100)}
            size="xs"
            width={102}
            ariaLabel={m.audioVolume}
            testId="ql-audio-volume-slider"
            onChange={(nextVol) => atlasAudioEngine.setVolume(nextVol / 100)}
          />
        </div>
      </motion.div>
    </div>
  );
}
