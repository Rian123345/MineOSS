import { settingsStore } from '../lib/store';

/**
 * Systemklänge von MineOS – komplett im Browser erzeugt (Web Audio), keine Sounddateien nötig.
 * Im XP-Theme klingen sie weich und warm wie in den 2000ern; eigene Dateien in
 * client/assets/sounds/xp/<name>.(mp3|wav|ogg) haben Vorrang (siehe LIESMICH.txt dort).
 */
export type SoundKind =
  | 'startup' | 'logon' | 'logoff' | 'shutdown'
  | 'notify' | 'order' | 'ding' | 'error' | 'exclamation' | 'click';

let ctx: AudioContext | null = null;
let reverb: ConvolverNode | null = null;
let customFiles: Set<string> | null = null;

// Liste eigener Sounddateien einmalig laden
void fetch('/sounds/index.json').then((r) => (r.ok ? r.json() : [])).then((list: string[]) => { customFiles = new Set(list); }).catch(() => { customFiles = new Set(); });

function audio(): AudioContext {
  ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Künstlicher Hall (Impulsantwort aus abklingendem Rauschen) */
function getReverb(c: AudioContext): ConvolverNode {
  if (reverb) return reverb;
  const len = Math.floor(c.sampleRate * 2.6);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  reverb = c.createConvolver();
  reverb.buffer = buf;
  reverb.connect(c.destination);
  return reverb;
}

const NOTE: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
  for (let o = 1; o <= 7; o++) NOTE[n + o] = 440 * Math.pow(2, (i - 9) / 12 + (o - 4));
});
const flat: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const f = (n: string) => NOTE[n] ?? NOTE[(flat[n.slice(0, 2)] ?? n.slice(0, 2)) + n.slice(2)];

interface Out { dry: GainNode; wet: GainNode }
function bus(c: AudioContext, vol: number, wet = 0.35): Out {
  const dry = c.createGain(); dry.gain.value = vol;
  const w = c.createGain(); w.gain.value = vol * wet;
  dry.connect(c.destination);
  w.connect(getReverb(c));
  return { dry, wet: w };
}
const send = (n: AudioNode, o: Out) => { n.connect(o.dry); n.connect(o.wet); };

/** Glockenton: Sinus mit leicht unharmonischen Obertönen */
function bell(c: AudioContext, o: Out, freq: number, t: number, dur = 1.6, level = 0.5) {
  [[1, 1], [2.01, 0.32], [3.98, 0.12], [5.43, 0.05]].forEach(([mul, amp]) => {
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = freq * mul;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level * amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (mul > 1 ? mul * 0.7 : 1));
    osc.connect(g); send(g, o);
    osc.start(t); osc.stop(t + dur + 0.1);
  });
}

/** Flächenklang (leicht verstimmte Sägezähne durch Tiefpass, langsames Ein-/Ausblenden) */
function pad(c: AudioContext, o: Out, notes: string[], t: number, dur: number, opts: { attack?: number; release?: number; level?: number; from?: number; to?: number } = {}) {
  const { attack = 0.5, release = 1.2, level = 0.16, from = 500, to = 2200 } = opts;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(from, t);
  lp.frequency.exponentialRampToValueAtTime(to, t + attack + dur * 0.4);
  lp.frequency.exponentialRampToValueAtTime(from, t + dur + release);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.setValueAtTime(level, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  lp.connect(g); send(g, o);
  for (const n of notes) {
    for (const det of [-7, 6]) {
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = f(n); osc.detune.value = det;
      const og = c.createGain(); og.gain.value = 1 / (notes.length * 2);
      osc.connect(og).connect(lp);
      osc.start(t); osc.stop(t + dur + release + 0.1);
    }
  }
}

function click(c: AudioContext, o: Out, t: number) {
  const len = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4;
  const g = c.createGain(); g.gain.value = 1.4;
  src.connect(bp).connect(g).connect(o.dry);
  src.start(t);
}

/** XP-artige Klänge (eigene Kompositionen im Stil der Zeit) */
function synthXp(kind: SoundKind, vol: number) {
  const c = audio();
  const t = c.currentTime + 0.03;
  switch (kind) {
    case 'startup': {
      const o = bus(c, vol, 0.5);
      pad(c, o, ['Bb2', 'F3', 'Bb3', 'D4', 'F4'], t, 2.9, { attack: 0.9, release: 1.6, level: 0.2, from: 350, to: 2600 });
      ['F5', 'Bb5', 'D6'].forEach((n, i) => bell(c, o, f(n), t + 0.2 + i * 0.2, 2.2, 0.32));
      ['C6', 'F6'].forEach((n, i) => bell(c, o, f(n), t + 1.35 + i * 0.28, 2.4, 0.24));
      bell(c, o, f('Bb6'), t + 2.25, 2.6, 0.16);
      break;
    }
    case 'logon': {
      const o = bus(c, vol, 0.45);
      pad(c, o, ['Eb3', 'Bb3', 'Eb4', 'G4'], t, 1.2, { attack: 0.35, release: 1.0, level: 0.17 });
      ['G5', 'Bb5', 'Eb6'].forEach((n, i) => bell(c, o, f(n), t + 0.05 + i * 0.14, 1.8, 0.3));
      break;
    }
    case 'logoff': {
      const o = bus(c, vol, 0.45);
      pad(c, o, ['Ab3', 'Eb4', 'C4'], t, 0.9, { attack: 0.25, release: 0.9, level: 0.14, to: 1600 });
      ['Eb6', 'C6', 'Ab5'].forEach((n, i) => bell(c, o, f(n), t + i * 0.16, 1.5, 0.26));
      break;
    }
    case 'shutdown': {
      const o = bus(c, vol, 0.55);
      pad(c, o, ['Ab2', 'Eb3', 'Ab3', 'C4', 'Eb4'], t, 1.6, { attack: 0.4, release: 1.6, level: 0.18, to: 2000 });
      ['Ab5', 'Eb5', 'C5', 'Ab4'].forEach((n, i) => bell(c, o, f(n), t + 0.1 + i * 0.26, 2.2, 0.3));
      break;
    }
    case 'notify':
    case 'order': {
      const o = bus(c, vol, 0.3);
      bell(c, o, f('E6'), t, 1.1, 0.34);
      bell(c, o, f('B6'), t + 0.11, 1.3, 0.28);
      break;
    }
    case 'ding': {
      const o = bus(c, vol, 0.3);
      bell(c, o, f('A5'), t, 1.3, 0.42);
      break;
    }
    case 'exclamation': {
      const o = bus(c, vol, 0.3);
      bell(c, o, f('D5'), t, 1.3, 0.34);
      bell(c, o, f('A5'), t, 1.3, 0.26);
      break;
    }
    case 'error': {
      const o = bus(c, vol, 0.25);
      ['A3', 'E4', 'C4'].forEach((n) => {
        const osc = c.createOscillator(); const g = c.createGain();
        osc.type = 'triangle'; osc.frequency.value = f(n);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        osc.connect(g); send(g, o); osc.start(t); osc.stop(t + 0.8);
      });
      bell(c, o, f('A4'), t, 0.8, 0.2);
      break;
    }
    case 'click': {
      click(c, bus(c, vol, 0), t);
      break;
    }
  }
}

/** Bisherige Klänge im Windows-7-Stil */
function synthWin7(kind: SoundKind, vol: number) {
  const map: Partial<Record<SoundKind, 'order' | 'error' | 'click' | 'logon'>> = {
    startup: 'logon', logon: 'logon', notify: 'order', order: 'order', click: 'click',
  };
  const k = map[kind];
  if (!k) return;
  const c = audio();
  const v = vol * 0.9;
  const notes = k === 'order' ? [880, 1318.5] : k === 'error' ? [330, 262] : k === 'logon' ? [523.25, 659.25, 783.99, 1046.5] : [1200];
  notes.forEach((fr, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.value = fr;
    const t = c.currentTime + i * (k === 'logon' ? 0.18 : 0.14);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (k === 'logon' ? 1.2 : 0.5));
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 1.3);
  });
}

export function playSound(kind: SoundKind) {
  const s = settingsStore.get();
  if (!s.sounds || s.volume <= 0) return;
  const vol = (s.volume / 100) * 0.2;
  try {
    if (s.skin === 'xp') {
      const file = customFiles && [...customFiles].find((x) => x.replace(/\.(mp3|wav|ogg)$/i, '') === `xp/${kind === 'order' ? 'notify' : kind}`);
      if (file) {
        const a = new Audio('/sounds/' + file);
        a.volume = Math.min(1, s.volume / 100);
        void a.play().catch(() => synthXp(kind, vol));
        return;
      }
      synthXp(kind, vol);
    } else {
      synthWin7(kind, vol);
    }
  } catch { /* Audio nicht verfügbar */ }
}
