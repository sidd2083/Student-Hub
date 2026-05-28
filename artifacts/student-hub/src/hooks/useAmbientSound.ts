import { useEffect, useRef, useCallback, useState } from "react";

// ── Singleton AudioContext ────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _ctx;
}
async function resumeCtx(): Promise<AudioContext> {
  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

// ── Noise buffers ─────────────────────────────────────────────────────────────
function makeBrownNoise(ctx: AudioContext, sec = 5): AudioBuffer {
  const len = ctx.sampleRate * sec;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = (Math.random() * 2 - 1) * 0.02;
      last = (last + w) * 0.998;
      d[i] = last * 3.5;
    }
  }
  return buf;
}
function makeWhiteNoise(ctx: AudioContext, sec = 4): AudioBuffer {
  const len = ctx.sampleRate * sec;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

interface SoundGraph {
  stop: () => void;
  schedulers?: ReturnType<typeof setInterval>[];
}

// ── RAIN — filtered brown noise, soft and calming ─────────────────────────────
function buildRain(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf = makeWhiteNoise(ctx, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 380; lpf.Q.value = 0.6;

  const shelf = ctx.createBiquadFilter();
  shelf.type = "peaking"; shelf.frequency.value = 1800; shelf.gain.value = -8;

  const g = ctx.createGain(); g.gain.value = 0.32;
  src.connect(lpf); lpf.connect(shelf); shelf.connect(g); g.connect(master);
  src.start();
  return { stop: () => { try { src.stop(); } catch {} } };
}

// ── LOFI — warm ambient pad (Am chord, slow LFO, NO harsh beats) ──────────────
function buildLofi(ctx: AudioContext, master: GainNode): SoundGraph {
  // Brown noise base (vinyl warmth)
  const buf = makeBrownNoise(ctx, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const noiseG = ctx.createGain(); noiseG.gain.value = 0.035;
  const noiseLpf = ctx.createBiquadFilter();
  noiseLpf.type = "lowpass"; noiseLpf.frequency.value = 600;
  src.connect(noiseLpf); noiseLpf.connect(noiseG); noiseG.connect(master);
  src.start();

  // Soft A-minor chord pad: A2, A3, C4, E4, G4
  const NOTES = [
    { f: 110.0, v: 0.040 },
    { f: 220.0, v: 0.055 },
    { f: 261.6, v: 0.045 },
    { f: 329.6, v: 0.038 },
    { f: 392.0, v: 0.028 },
  ];
  const oscs: OscillatorNode[] = [];

  NOTES.forEach(({ f, v }, idx) => {
    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = f + (idx % 2 === 0 ? 0.4 : -0.4);

    // Very slow tremolo per note
    lfo.type = "sine"; lfo.frequency.value = 0.04 + idx * 0.007;
    lfoG.gain.value = v * 0.3;
    lfo.connect(lfoG); lfoG.connect(env.gain);

    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(v, ctx.currentTime + 3 + idx);

    osc.connect(env); env.connect(master);
    osc.start(); lfo.start();
    oscs.push(osc, lfo);
  });

  // Slow chord shifts Am → C → G → Am every 9s
  const CHORDS = [
    [110.0, 220.0, 261.6, 329.6, 392.0],
    [130.8, 261.6, 329.6, 392.0, 493.9],
    [ 98.0, 196.0, 246.9, 293.7, 392.0],
  ];
  let ci = 0;
  const chordTimer = setInterval(() => {
    if (ctx.state !== "running") return;
    ci = (ci + 1) % CHORDS.length;
    oscs.filter((_, i) => i % 2 === 0).forEach((osc, i) => {
      osc.frequency.linearRampToValueAtTime(
        CHORDS[ci][i] + (i % 2 === 0 ? 0.4 : -0.4),
        ctx.currentTime + 3,
      );
    });
  }, 9000);

  return {
    stop: () => {
      clearInterval(chordTimer);
      oscs.forEach(o => { try { o.stop(); } catch {} });
      try { src.stop(); } catch {}
    },
    schedulers: [chordTimer],
  };
}

// ── NATURE / FOREST — soft wind + occasional gentle bird chirps ───────────────
function buildForest(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf = makeWhiteNoise(ctx, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 280; lpf.Q.value = 0.5;

  const windG = ctx.createGain(); windG.gain.value = 0.13;
  src.connect(lpf); lpf.connect(windG); windG.connect(master);
  src.start();

  // Slow wind swell
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.type = "sine"; lfo.frequency.value = 0.07;
  lfoG.gain.value = 0.05;
  lfo.connect(lfoG); lfoG.connect(windG.gain);
  lfo.start();

  const BIRDS = [1760, 2093, 2349, 1975, 2637];
  const schedulers: ReturnType<typeof setInterval>[] = [];

  const birdTimer = setInterval(() => {
    if (ctx.state !== "running" || Math.random() > 0.38) return;
    const freq  = BIRDS[Math.floor(Math.random() * BIRDS.length)];
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const d = i * 0.2;
      const o = ctx.createOscillator();
      const e = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, ctx.currentTime + d);
      o.frequency.linearRampToValueAtTime(freq * 1.08, ctx.currentTime + d + 0.09);
      e.gain.setValueAtTime(0, ctx.currentTime + d);
      e.gain.linearRampToValueAtTime(0.025, ctx.currentTime + d + 0.045);
      e.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.26);
      o.connect(e); e.connect(master);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.3);
    }
  }, 2800);

  schedulers.push(birdTimer);
  return {
    stop: () => {
      schedulers.forEach(clearInterval);
      try { src.stop(); lfo.stop(); } catch {}
    },
    schedulers,
  };
}

// ── DEEP FOCUS — warm brown noise, deeply calming ─────────────────────────────
function buildDeepFocus(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf = makeBrownNoise(ctx, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 700; lpf.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.42;
  src.connect(lpf); lpf.connect(g); g.connect(master);
  src.start();
  return { stop: () => { try { src.stop(); } catch {} } };
}

// ── CAFÉ — distant library/café ambience ─────────────────────────────────────
function buildCafe(ctx: AudioContext, master: GainNode): SoundGraph {
  const buf = makeWhiteNoise(ctx, 5);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;

  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass"; bpf.frequency.value = 650; bpf.Q.value = 0.35;
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 1200;
  const g = ctx.createGain(); g.gain.value = 0.16;

  src.connect(bpf); bpf.connect(lpf); lpf.connect(g); g.connect(master);
  src.start();

  const schedulers: ReturnType<typeof setInterval>[] = [];
  const murmurTimer = setInterval(() => {
    if (ctx.state !== "running" || Math.random() > 0.45) return;
    const now = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.21, now + 0.35);
    g.gain.linearRampToValueAtTime(0.16, now + 1.1);
  }, 1800);
  schedulers.push(murmurTimer);

  return {
    stop: () => { schedulers.forEach(clearInterval); try { src.stop(); } catch {} },
    schedulers,
  };
}

function buildGraph(id: string, ctx: AudioContext, master: GainNode): SoundGraph | null {
  switch (id) {
    case "rain":       return buildRain(ctx, master);
    case "lofi":       return buildLofi(ctx, master);
    case "forest":
    case "nature":     return buildForest(ctx, master);
    case "whitenoise":
    case "deepfocus":  return buildDeepFocus(ctx, master);
    case "cafe":       return buildCafe(ctx, master);
    default:           return null;
  }
}

// ── Bell — soft, musical ──────────────────────────────────────────────────────
export function playBell(type: "study" | "break" | "vote"): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const cfgs = {
      study: { pairs: [[523.25, 659.25]], dur: 2.4, vol: 0.20 },
      break: { pairs: [[392.00, 523.25]], dur: 2.0, vol: 0.17 },
      vote:  { pairs: [[783.99, 987.77]], dur: 0.9, vol: 0.14 },
    }[type];
    cfgs.pairs[0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(cfgs.vol, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, t + cfgs.dur);
      osc.connect(env); env.connect(ctx.destination);
      osc.start(t); osc.stop(t + cfgs.dur + 0.05);
    });
  } catch { /* silent */ }
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
  const [isMuted,   setMutedState]  = useState(false);
  const [volume,    setVolumeState] = useState(0.55);
  const [isPlaying, setIsPlaying]   = useState(false);

  const masterRef  = useRef<GainNode | null>(null);
  const graphRef   = useRef<SoundGraph | null>(null);
  const prevRef    = useRef<SoundGraph | null>(null);
  const prevGRef   = useRef<GainNode | null>(null);
  const mutedRef   = useRef(isMuted);
  const volRef     = useRef(volume);
  mutedRef.current = isMuted;
  volRef.current   = volume;

  const stopSound = useCallback(() => {
    const g = masterRef.current;
    if (g && _ctx) {
      try { g.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.8); } catch {}
      setTimeout(() => {
        try { graphRef.current?.stop(); } catch {}
        graphRef.current = masterRef.current = null;
      }, 900);
    } else {
      try { graphRef.current?.stop(); } catch {}
      graphRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startSound = useCallback(async (id: string) => {
    if (!id || id === "none") { setIsPlaying(false); return; }
    try {
      const ctx    = await resumeCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(
        mutedRef.current ? 0 : volRef.current * 0.65,
        ctx.currentTime + 2.2,
      );
      master.connect(ctx.destination);
      const graph = buildGraph(id, ctx, master);
      if (!graph) { setIsPlaying(false); return; }
      masterRef.current = master;
      graphRef.current  = graph;
      setIsPlaying(true);
    } catch { setIsPlaying(false); }
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    stopSound();
    if (soundId && soundId !== "none") {
      const t = setTimeout(() => startSound(soundId), 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundId, autoPlay]);

  useEffect(() => () => {
    try { graphRef.current?.stop(); } catch {}
    try { prevRef.current?.stop(); } catch {}
    graphRef.current = masterRef.current = prevRef.current = prevGRef.current = null;
  }, []);

  const setMuted = useCallback((v: boolean) => {
    setMutedState(v);
    if (masterRef.current && _ctx) {
      masterRef.current.gain.linearRampToValueAtTime(
        v ? 0 : volRef.current * 0.65,
        _ctx.currentTime + 0.3,
      );
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (masterRef.current && _ctx && !mutedRef.current) {
      masterRef.current.gain.linearRampToValueAtTime(v * 0.65, _ctx.currentTime + 0.1);
    }
  }, []);

  const preview = useCallback(async (id: string) => {
    try { prevRef.current?.stop(); prevRef.current = null; } catch {}
    if (!id || id === "none") return;
    try {
      const ctx  = await resumeCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 0.6);
      gain.connect(ctx.destination);
      const graph = buildGraph(id, ctx, gain);
      if (!graph) return;
      prevRef.current  = graph;
      prevGRef.current = gain;
      setTimeout(() => {
        if (prevRef.current !== graph) return;
        try {
          gain.gain.linearRampToValueAtTime(0, (_ctx?.currentTime ?? 0) + 0.5);
          setTimeout(() => { try { graph.stop(); } catch {} }, 600);
        } catch {}
        prevRef.current = null;
      }, 5000);
    } catch {}
  }, []);

  const stopPreview = useCallback(() => {
    try {
      if (prevGRef.current && _ctx) {
        prevGRef.current.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.3);
        const g = prevRef.current;
        setTimeout(() => { try { g?.stop(); } catch {} }, 400);
      } else { prevRef.current?.stop(); }
    } catch {}
    prevRef.current = prevGRef.current = null;
  }, []);

  return { isPlaying, isMuted, volume, setMuted, setVolume, preview, stopPreview };
}

export function useRoomSound(soundId: string) {
  const { isPlaying, isMuted, volume, setMuted, setVolume } = useAmbientSound(soundId, true);
  return { isPlaying, isMuted, volume, setMuted, setVolume };
}
