// Procedural sound effects via Web Audio API — no asset files.

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.12,
  freqEnd?: number
) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sounds = {
  select() {
    tone(880, 0.08, "sine", 0.1, 1100);
  },
  deselect() {
    tone(660, 0.06, "sine", 0.08, 500);
  },
  pour() {
    // bubbly water pour
    tone(900, 0.18, "sine", 0.1, 500);
    setTimeout(() => tone(700, 0.16, "sine", 0.08, 380), 70);
    setTimeout(() => tone(520, 0.2, "sine", 0.07, 280), 140);
  },
  invalid() {
    tone(220, 0.08, "sawtooth", 0.07, 160);
    setTimeout(() => tone(180, 0.1, "sawtooth", 0.06, 130), 60);
  },
  win() {
    // C-E-G-C ascending arpeggio
    tone(523.25, 0.18, "triangle", 0.12);
    setTimeout(() => tone(659.25, 0.18, "triangle", 0.12), 110);
    setTimeout(() => tone(783.99, 0.18, "triangle", 0.12), 220);
    setTimeout(() => tone(1046.5, 0.5, "triangle", 0.14), 330);
  },
  button() {
    tone(620, 0.05, "triangle", 0.08, 800);
  },
  coin() {
    tone(988, 0.07, "sine", 0.1, 1200);
    setTimeout(() => tone(1318, 0.12, "sine", 0.1, 1500), 60);
  },
  hint() {
    tone(1200, 0.1, "sine", 0.08, 1500);
    setTimeout(() => tone(1500, 0.1, "sine", 0.08, 1800), 80);
  },
};
