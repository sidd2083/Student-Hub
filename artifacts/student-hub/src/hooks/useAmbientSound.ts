import { useEffect, useRef, useCallback, useState } from "react";

// ── Singleton AudioContext ────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _ctx;
}

async function resumeCtx(): Promise<AudioContext> {
  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

// ── Noise buffer factory ──────────────────────────────────────────────────────
function createWhiteNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const len  = ctx.sampleRate * seconds;
  const buf  = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// ── Sound builders ────────────────────────────────────────────────────────────

interface SoundGraph {
  nodes: AudioNode[];
  schedulers?: ReturnType<typeof setInterval>[];
  stop: () => void;
}

function buildRainGraph(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf   = createWhiteNoiseBuffer(ctx, 4);
  const src   = ctx.createBufferSource();
  src.buffer  = buf;
  src.loop    = true;

  const lpf   = ctx.createBiquadFilter();
  lpf.type    = "lowpass";
  lpf.frequency.value = 580;
  lpf.Q.value = 0.9;

  const lpf2  = ctx.createBiquadFilter();
  lpf2.type   = "lowpass";
  lpf2.frequency.value = 1200;
  lpf2.Q.value = 0.4;

  const gain  = ctx.createGain();
  gain.gain.value = 0.5;

  src.connect(lpf);
  lpf.connect(lpf2);
  lpf2.connect(gain);
  gain.connect(master);
  src.start();

  return {
    nodes: [src, lpf, lpf2, gain],
    stop: () => { try { src.stop(); } catch {} },
  };
}

function buildCafeGraph(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf  = createWhiteNoiseBuffer(ctx, 4);
  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const bpf  = ctx.createBiquadFilter();
  bpf.type   = "bandpass";
  bpf.frequency.value = 900;
  bpf.Q.value = 0.5;

  const hpf  = ctx.createBiquadFilter();
  hpf.type   = "highpass";
  hpf.frequency.value = 120;

  const gain = ctx.createGain();
  gain.gain.value = 0.28;

  src.connect(hpf);
  hpf.connect(bpf);
  bpf.connect(gain);
  gain.connect(master);
  src.start();

  return {
    nodes: [src, bpf, hpf, gain],
    stop: () => { try { src.stop(); } catch {} },
  };
}

function buildForestGraph(ctx: AudioContext, master: GainNode): SoundGraph {
  // Layered: low rumble + mid rustling
  const buf  = createWhiteNoiseBuffer(ctx, 5);

  const src1  = ctx.createBufferSource();
  src1.buffer = buf;
  src1.loop   = true;
  src1.loopStart = 0;
  src1.loopEnd   = 2.3;

  const src2  = ctx.createBufferSource();
  src2.buffer = buf;
  src2.loop   = true;
  src2.loopStart = 1.0;
  src2.loopEnd   = 3.5;
  src2.playbackRate.value = 0.85;

  const lpf1  = ctx.createBiquadFilter();
  lpf1.type   = "lowpass";
  lpf1.frequency.value = 400;

  const lpf2  = ctx.createBiquadFilter();
  lpf2.type   = "bandpass";
  lpf2.frequency.value = 2200;
  lpf2.Q.value = 0.4;

  const g1    = ctx.createGain();
  g1.gain.value = 0.16;
  const g2    = ctx.createGain();
  g2.gain.value = 0.12;

  src1.connect(lpf1); lpf1.connect(g1); g1.connect(master);
  src2.connect(lpf2); lpf2.connect(g2); g2.connect(master);
  src1.start();
  src2.start(ctx.currentTime + 0.5);

  return {
    nodes: [src1, src2, lpf1, lpf2, g1, g2],
    stop: () => {
      try { src1.stop(); } catch {}
      try { src2.stop(); } catch {}
    },
  };
}

function buildWhiteNoiseGraph(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf  = createWhiteNoiseBuffer(ctx, 3);
  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const gain = ctx.createGain();
  gain.gain.value = 0.22;

  src.connect(gain);
  gain.connect(master);
  src.start();

  return {
    nodes: [src, gain],
    stop: () => { try { src.stop(); } catch {} },
  };
}

function buildLofiGraph(ctx: AudioContext, master: GainNode): SoundGraph {
  // Lo-fi vibe: warm pink noise + subtle rhythmic pulse at 80bpm
  const buf  = createWhiteNoiseBuffer(ctx, 4);
  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const lpf  = ctx.createBiquadFilter();
  lpf.type   = "lowpass";
  lpf.frequency.value = 1500;
  lpf.Q.value = 0.6;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.14;

  src.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(master);
  src.start();

  // Rhythmic "kick" at 80 bpm
  const bpm = 80;
  const beatInterval = (60 / bpm) * 1000;
  let beatPhase = 0;

  const schedulers: ReturnType<typeof setInterval>[] = [];
  const beatTimer = setInterval(() => {
    if (ctx.state === "running") {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = beatPhase % 4 === 0 ? 80 : beatPhase % 2 === 0 ? 60 : 55;
      env.gain.setValueAtTime(0.18, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(env);
      env.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
    beatPhase++;
  }, beatInterval);

  schedulers.push(beatTimer);

  return {
    nodes: [src, lpf, noiseGain],
    schedulers,
    stop: () => {
      try { src.stop(); } catch {}
      schedulers.forEach(clearInterval);
    },
  };
}

function buildSoundGraph(id: string, ctx: AudioContext, master: GainNode): SoundGraph | null {
  switch (id) {
    case "rain":       return buildRainGraph(ctx, master);
    case "cafe":       return buildCafeGraph(ctx, master);
    case "forest":     return buildForestGraph(ctx, master);
    case "whitenoise": return buildWhiteNoiseGraph(ctx, master);
    case "lofi":       return buildLofiGraph(ctx, master);
    default:           return null;
  }
}

// ── Bell / Chime ──────────────────────────────────────────────────────────────

export function playBell(type: "study" | "break" | "vote"): void {
  try {
    const ctx  = getCtx();
    if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }

    const configs: Record<string, { freq: number; freq2: number; duration: number }> = {
      study: { freq: 880, freq2: 1100, duration: 1.5 },
      break: { freq: 660, freq2: 880,  duration: 1.2 },
      vote:  { freq: 1200, freq2: 1500, duration: 0.6 },
    };
    const cfg = configs[type];

    // Two-tone bell
    [cfg.freq, cfg.freq2].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type  = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      env.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + cfg.duration);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + cfg.duration + 0.05);
    });
  } catch {
    // Audio not available — silent fail
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

interface UseAmbientSoundReturn {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
  preview: (soundId: string) => void;
  stopPreview: () => void;
}

export function useAmbientSound(soundId: string, autoPlay = false): UseAmbientSoundReturn {
  const [isMuted,   setMutedState] = useState(false);
  const [volume,    setVolumeState] = useState(0.6);
  const [isPlaying, setIsPlaying]  = useState(false);

  const masterGainRef = useRef<GainNode | null>(null);
  const graphRef      = useRef<SoundGraph | null>(null);
  const previewRef    = useRef<SoundGraph | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);
  const soundIdRef    = useRef(soundId);
  const mutedRef      = useRef(isMuted);
  const volumeRef     = useRef(volume);

  soundIdRef.current = soundId;
  mutedRef.current   = isMuted;
  volumeRef.current  = volume;

  // ── Start / stop main sound ────────────────────────────────────────────────
  const startSound = useCallback(async (id: string) => {
    if (id === "none" || !id) { setIsPlaying(false); return; }
    try {
      const ctx    = await resumeCtx();
      const master = ctx.createGain();
      master.gain.value = mutedRef.current ? 0 : volumeRef.current * 0.7;
      master.connect(ctx.destination);

      const graph = buildSoundGraph(id, ctx, master);
      if (!graph) { setIsPlaying(false); return; }

      // Fade in
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(
        mutedRef.current ? 0 : volumeRef.current * 0.7,
        ctx.currentTime + 1.5
      );

      masterGainRef.current = master;
      graphRef.current      = graph;
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const stopSound = useCallback(() => {
    if (!graphRef.current) return;
    const ctx = _ctx;
    if (ctx && masterGainRef.current) {
      try {
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        setTimeout(() => {
          try { graphRef.current?.stop(); } catch {}
          graphRef.current  = null;
          masterGainRef.current = null;
        }, 900);
      } catch {
        try { graphRef.current.stop(); } catch {}
        graphRef.current  = null;
        masterGainRef.current = null;
      }
    } else {
      try { graphRef.current?.stop(); } catch {}
      graphRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // ── React to soundId changes ───────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlay) return undefined;
    stopSound();
    if (soundId && soundId !== "none") {
      const t = setTimeout(() => startSound(soundId), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundId, autoPlay]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { graphRef.current?.stop(); } catch {}
      try { previewRef.current?.stop(); } catch {}
      graphRef.current     = null;
      previewRef.current   = null;
      masterGainRef.current = null;
      previewGainRef.current = null;
    };
  }, []);

  // ── Volume / mute updates ─────────────────────────────────────────────────
  const setMuted = useCallback((v: boolean) => {
    setMutedState(v);
    if (masterGainRef.current && _ctx) {
      masterGainRef.current.gain.linearRampToValueAtTime(
        v ? 0 : volumeRef.current * 0.7,
        _ctx.currentTime + 0.3
      );
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (masterGainRef.current && _ctx && !mutedRef.current) {
      masterGainRef.current.gain.linearRampToValueAtTime(v * 0.7, _ctx.currentTime + 0.1);
    }
  }, []);

  // ── Preview (for room creation page) ────────────────────────────────────────
  const preview = useCallback(async (id: string) => {
    try { previewRef.current?.stop(); previewRef.current = null; } catch {}
    if (!id || id === "none") return;
    try {
      const ctx  = await resumeCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);
      gain.connect(ctx.destination);
      const graph = buildSoundGraph(id, ctx, gain);
      if (!graph) return;
      previewRef.current   = graph;
      previewGainRef.current = gain;
      // Auto-stop preview after 5 seconds
      setTimeout(() => {
        if (previewRef.current === graph) {
          try {
            gain.gain.linearRampToValueAtTime(0, (_ctx?.currentTime ?? 0) + 0.5);
            setTimeout(() => { try { graph.stop(); } catch {} }, 600);
            previewRef.current = null;
          } catch {}
        }
      }, 5000);
    } catch {}
  }, []);

  const stopPreview = useCallback(() => {
    try {
      if (previewGainRef.current && _ctx) {
        previewGainRef.current.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.3);
        const g = previewRef.current;
        setTimeout(() => { try { g?.stop(); } catch {}; }, 400);
      } else {
        previewRef.current?.stop();
      }
    } catch {}
    previewRef.current = null;
    previewGainRef.current = null;
  }, []);

  return { isPlaying, isMuted, volume, setMuted, setVolume, preview, stopPreview };
}

// ── Standalone sound controller (used by StudyRoomLive) ───────────────────────

export function useRoomSound(soundId: string) {
  const { isPlaying, isMuted, volume, setMuted, setVolume } = useAmbientSound(soundId, true);
  return { isPlaying, isMuted, volume, setMuted, setVolume };
}
