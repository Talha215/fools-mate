// Every sound is synthesised with Web Audio, so there are no audio files to
// license or download. A "knock" is a filtered noise burst (the click of wood
// on wood) over a short low sine (the board's thump).
import { getSettings } from './settings.js';

let ctx = null;
let out = null;
let noise = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only allow audio to start from a user gesture; the first tap or
// click anywhere unlocks it for the bot's (non-gesture) moves later.
export function installAudioUnlock() {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function knock(t, { freq = 1900, q = 1.3, gain = 0.8, decay = 0.05, thump = 170 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + decay + 0.02);

  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(thump, t);
  osc.frequency.exponentialRampToValueAtTime(thump * 0.55, t + 0.07);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain * 0.7, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.1);
}

function tone(t, freq, dur, { type = 'triangle', gain = 0.18, to } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.setValueAtTime(gain, t + Math.max(0.02, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  move: (t) => knock(t),
  capture: (t) => {
    knock(t, { freq: 1300, gain: 1, decay: 0.08, thump: 130 });
    knock(t + 0.02, { freq: 2800, gain: 0.45, decay: 0.03, thump: 260 });
  },
  castle: (t) => {
    knock(t);
    knock(t + 0.085, { freq: 1600, gain: 0.7 });
  },
  check: (t) => {
    knock(t, { gain: 0.9 });
    tone(t + 0.03, 1046, 0.16, { type: 'sine', gain: 0.1 });
  },
  promote: (t) => {
    knock(t);
    tone(t + 0.03, 523, 0.22, { type: 'sine', gain: 0.12, to: 1046 });
  },
  // A rubber stamp hitting paper on a desk: a dull, low thud.
  stamp: (t) => {
    knock(t, { freq: 420, q: 0.7, gain: 1, decay: 0.12, thump: 95 });
    knock(t + 0.012, { freq: 1500, q: 0.8, gain: 0.25, decay: 0.04, thump: 180 });
  },
  // A small desk bell: inharmonic partials with a long ring.
  bell: (t) => {
    [
      [1568, 0.12, 1.4],
      [1568 * 2.76, 0.05, 0.7],
      [1568 * 5.4, 0.025, 0.35],
    ].forEach(([f, g, d]) => ring(t, f, g, d));
  },
};

function ring(t, freq, gain, dur) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playSound(name) {
  if (!getSettings().sound) return;
  const c = audio();
  if (!c || !SOUNDS[name]) return;
  SOUNDS[name](c.currentTime + 0.01);
}

// Picks the right sound for a chess.js Move that has just been played.
export function soundForMove(move, inCheck) {
  if (inCheck) return 'check';
  if (move.promotion) return 'promote';
  if (move.isKingsideCastle?.() || move.isQueensideCastle?.()) return 'castle';
  if (move.captured) return 'capture';
  return 'move';
}
