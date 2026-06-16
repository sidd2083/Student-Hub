/**
 * Pre-warmed AudioContext singleton for SOS popup sounds.
 * iOS/Android require a prior user gesture to unlock Web Audio.
 * Call prewarmAudio() on any click/touchstart to unlock it once.
 */

let _ctx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as Record<string, unknown>)["webkitAudioContext"] as typeof AudioContext | undefined;
  if (!Ctx) return null;
  if (!_ctx) {
    try { _ctx = new Ctx(); } catch { return null; }
  }
  return _ctx;
}

export function prewarmAudio(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {}
}

export function playBeep(urgent: boolean): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const play = () => {
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = urgent ? 1040 : 880;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (urgent ? 0.12 : 0.18));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  };
  if (ctx.state === "running") {
    play();
  } else {
    ctx.resume().then(play).catch(() => {});
  }
}
