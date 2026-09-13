// Procedural SFX via WebAudio — no asset files, so it costs the 20MB build
// budget nothing and every variant gets game feel for free. The theme pack's
// `audio` block can still point at real music; this covers the hit/pickup/
// level feedback that makes moment-to-moment play land.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  // Headless (the sim test) has no window; every sfx call becomes a no-op.
  if (typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
  return ctx;
}

// Browsers start the context suspended until a gesture; call on first input.
export function unlock() {
  if (typeof window === 'undefined') return;
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(v) {
  muted = v;
  if (master) master.gain.value = v ? 0 : 0.25;
}

export function isMuted() { return muted; }

function blip({ freq = 440, to = null, dur = 0.08, type = 'square', gain = 0.3, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.12, gain = 0.25, hp = 900 }) {
  const c = ensure();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filt).connect(g).connect(master);
  src.start();
}

// Slight pitch jitter keeps repeated hits from turning into a machine-gun tone.
const jit = (f) => f * (0.94 + Math.random() * 0.12);

export const sfx = {
  mine: () => blip({ freq: jit(320), to: 180, dur: 0.06, type: 'triangle', gain: 0.16 }),
  hitEnemy: () => { blip({ freq: jit(200), to: 90, dur: 0.07, type: 'sawtooth', gain: 0.14 }); noise({ dur: 0.05, gain: 0.1 }); },
  kill: () => { blip({ freq: jit(160), to: 60, dur: 0.16, type: 'sawtooth', gain: 0.2 }); noise({ dur: 0.1, gain: 0.14, hp: 500 }); },
  pickup: () => blip({ freq: jit(760), to: 1180, dur: 0.06, type: 'sine', gain: 0.12 }),
  hurt: () => { blip({ freq: 180, to: 60, dur: 0.24, type: 'square', gain: 0.3 }); noise({ dur: 0.16, gain: 0.2, hp: 300 }); },
  buy: () => { blip({ freq: 520, dur: 0.05, type: 'square', gain: 0.16 }); blip({ freq: 780, dur: 0.07, type: 'square', gain: 0.14, delay: 0.05 }); },
  levelUp: () => [0, 0.07, 0.14].forEach((d, i) => blip({ freq: 520 * Math.pow(1.26, i), dur: 0.12, type: 'triangle', gain: 0.2, delay: d })),
  descend: () => blip({ freq: 420, to: 120, dur: 0.5, type: 'sine', gain: 0.26 }),
  prestige: () => [0, 0.09, 0.18, 0.27].forEach((d, i) => blip({ freq: 400 * Math.pow(1.33, i), dur: 0.3, type: 'triangle', gain: 0.22, delay: d })),
  death: () => [0, 0.12, 0.26].forEach((d, i) => blip({ freq: 300 / (i + 1), dur: 0.4, type: 'sawtooth', gain: 0.24, delay: d })),
};
