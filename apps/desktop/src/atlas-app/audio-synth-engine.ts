import { clampPlaybackRate, type AudioMeta, type AudioSynthPreset } from "./media-helpers";

export interface AudioPlaybackSnapshot {
  activeItemId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
  levels: number[];
}

type Listener = (snap: AudioPlaybackSnapshot) => void;

const CHORD_TABLES: Record<AudioSynthPreset, number[][]> = {
  "ambient-pad": [
    [220.0, 261.63, 329.63, 392.0], // Am7
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [196.0, 246.94, 293.66, 392.0], // G6
    [164.81, 196.0, 246.94, 329.63], // Em7
  ],
  "vinyl-chords": [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [293.66, 349.23, 440.0, 523.25], // Dm7
    [246.94, 293.66, 392.0, 493.88], // G/B
    [220.0, 261.63, 329.63, 440.0], // Am
  ],
  "modular-arp": [
    [293.66, 349.23, 440.0, 587.33], // Dm
    [261.63, 329.63, 392.0, 523.25], // C
    [233.08, 293.66, 349.23, 466.16], // Bb
    [220.0, 277.18, 329.63, 440.0], // A
  ],
};

/**
 * Dual-mode Web Audio controller:
 * 1) Plays real uploaded local audio files via HTMLAudioElement (`audioMeta.audioUrl`)
 * 2) Plays warm studio-filtered procedural Web Audio synth tracks for built-in library samples
 */
class AtlasAudioController {
  private listeners = new Set<Listener>();
  private state: AudioPlaybackSnapshot = {
    activeItemId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 42,
    volume: 0.78,
    muted: false,
    loop: true,
    playbackRate: 1,
    levels: Array.from({ length: 24 }, () => 0.14),
  };

  private activeMeta: AudioMeta | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rafId: number | null = null;
  private lastTickMs = 0;
  private synthStepIdx = 0;
  private lastSynthNoteMs = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AudioPlaybackSnapshot {
    return this.state;
  }

  private emit() {
    const snap: AudioPlaybackSnapshot = {
      ...this.state,
      levels: [...this.state.levels],
    };
    for (const l of this.listeners) l(snap);
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.state.muted ? 0 : this.state.volume * 0.22;
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private triggerSynthNote(preset: AudioSynthPreset) {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain || this.state.muted) return;

    const now = ctx.currentTime;
    const chords = CHORD_TABLES[preset];
    const chord = chords[Math.floor(this.synthStepIdx / 4) % chords.length]!;
    const noteFreq = chord[this.synthStepIdx % chord.length]!;
    this.synthStepIdx += 1;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type =
      preset === "modular-arp"
        ? "triangle"
        : preset === "vinyl-chords"
          ? "sine"
          : "sine";
    osc.frequency.setValueAtTime(
      noteFreq * (preset === "ambient-pad" ? 0.5 : 1),
      now,
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      preset === "modular-arp" ? 1600 : 980,
      now,
    );

    const dur = preset === "modular-arp" ? 0.42 : 1.15;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.45, now + 0.045);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + dur + 0.04);
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop() {
    this.stopLoop();
    this.lastTickMs = performance.now();
    this.lastSynthNoteMs = 0;

    const tick = (now: number) => {
      if (!this.state.isPlaying) {
        this.rafId = null;
        return;
      }

      const dtSec = Math.min(0.1, Math.max(0, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;

      if (this.audioEl && this.activeMeta?.audioUrl) {
        this.state.currentTime = this.audioEl.currentTime || 0;
        if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
          this.state.duration = this.audioEl.duration;
        }
      } else {
        let nextTime =
          this.state.currentTime + dtSec * this.state.playbackRate;
        if (nextTime >= this.state.duration) {
          if (this.state.loop) {
            nextTime = nextTime % Math.max(1, this.state.duration);
          } else {
            this.state.currentTime = this.state.duration;
            this.state.isPlaying = false;
            this.state.levels = this.state.levels.map(() => 0.14);
            this.emit();
            this.rafId = null;
            return;
          }
        }
        this.state.currentTime = nextTime;

        const preset = this.activeMeta?.synthPreset ?? "ambient-pad";
        const stepIntervalMs =
          (preset === "modular-arp" ? 290 : 620) / this.state.playbackRate;
        if (now - this.lastSynthNoteMs >= stepIntervalMs) {
          this.lastSynthNoteMs = now;
          this.triggerSynthNote(preset);
        }
      }

      // Compute responsive musical spectrum bars from current playback phase
      const phase = this.state.currentTime * (this.activeMeta?.bpm ?? 96) * 0.09;
      this.state.levels = this.state.levels.map((_, idx) => {
        const wave =
          0.35 +
          0.34 * Math.sin(phase * 1.4 + idx * 0.55) +
          0.22 * Math.cos(phase * 2.3 - idx * 0.35);
        const envelope = 1 - Math.abs(idx - 11.5) / 15;
        return Math.max(0.14, Math.min(1, wave * (0.55 + envelope * 0.55)));
      });

      this.emit();
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  loadTrack(itemId: string, meta: AudioMeta, autoPlay = false) {
    if (this.state.activeItemId === itemId) {
      if (autoPlay && !this.state.isPlaying) {
        this.play(itemId, meta);
      }
      return;
    }

    this.pause();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = "";
      this.audioEl = null;
    }

    this.activeMeta = meta;
    this.synthStepIdx = 0;
    this.state = {
      ...this.state,
      activeItemId: itemId,
      isPlaying: false,
      currentTime: 0,
      duration: Math.max(1, meta.durationSec || 30),
      levels: Array.from({ length: 24 }, () => 0.14),
    };

    if (meta.audioUrl && typeof Audio !== "undefined") {
      const el = new Audio(meta.audioUrl);
      el.loop = this.state.loop;
      el.volume = this.state.muted ? 0 : this.state.volume;
      el.playbackRate = this.state.playbackRate;
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          this.state.duration = el.duration;
          this.emit();
        }
      };
      el.onended = () => {
        if (!this.state.loop) {
          this.state.isPlaying = false;
          this.emit();
        }
      };
      this.audioEl = el;
    }

    this.emit();
    if (autoPlay) this.play(itemId, meta);
  }

  play(itemId: string, meta: AudioMeta) {
    if (this.state.activeItemId !== itemId) {
      this.loadTrack(itemId, meta, false);
    }
    this.state.isPlaying = true;
    if (this.audioEl) {
      this.audioEl.play().catch(() => {});
    } else {
      this.ensureAudioContext();
    }
    this.emit();
    this.startLoop();
  }

  pause() {
    this.state.isPlaying = false;
    this.stopLoop();
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.state.levels = this.state.levels.map(() => 0.14);
    this.emit();
  }

  toggle(itemId: string, meta: AudioMeta) {
    if (this.state.activeItemId === itemId && this.state.isPlaying) {
      this.pause();
    } else {
      this.play(itemId, meta);
    }
  }

  seek(nextSeconds: number) {
    const clamped = Math.max(0, Math.min(this.state.duration, nextSeconds));
    this.state.currentTime = clamped;
    if (this.audioEl) {
      this.audioEl.currentTime = clamped;
    }
    this.emit();
  }

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.volume = clamped;
    this.state.muted = clamped === 0;
    if (this.audioEl) this.audioEl.volume = clamped;
    if (this.masterGain) this.masterGain.gain.value = clamped * 0.22;
    this.emit();
  }

  toggleMute() {
    this.state.muted = !this.state.muted;
    const eff = this.state.muted ? 0 : this.state.volume;
    if (this.audioEl) this.audioEl.volume = eff;
    if (this.masterGain) this.masterGain.gain.value = eff * 0.22;
    this.emit();
  }

  toggleLoop() {
    this.state.loop = !this.state.loop;
    if (this.audioEl) this.audioEl.loop = this.state.loop;
    this.emit();
  }

  setPlaybackRate(rate: number) {
    const clamped = clampPlaybackRate(rate);
    this.state.playbackRate = clamped;
    if (this.audioEl) this.audioEl.playbackRate = clamped;
    this.emit();
  }
}

export const atlasAudioEngine = new AtlasAudioController();
