// Original gallery tones for the Crazy Games guest. Sine bells only — no noise
// bursts, pitch slides, or sawtooth — so seals and acquisitions do not sound
// like a hop. Routed around the ducked host effects bus.

let ctx = null;
let bus = null;
let routing = false;
let muted = false;
const origConnect = AudioNode.prototype.connect;

function ensure() {
  if (ctx) {
    if (!muted && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const ACtor = window.AudioContext || window.webkitAudioContext;
  if (!ACtor) return null;
  ctx = new ACtor();
  bus = ctx.createGain();
  bus.gain.value = muted ? 0 : 0.9;
  routing = true;
  origConnect.call(bus, ctx.destination);
  routing = false;
  return ctx;
}

export function galleryRouting() {
  return routing;
}

export function setGalleryMuted(next) {
  muted = !!next;
  if (bus) bus.gain.value = muted ? 0 : 0.9;
  if (!muted && ctx && ctx.state === 'suspended') ctx.resume();
}

function playNotes(notes) {
  if (muted) return;
  const audio = ensure();
  if (!audio || !bus) return;
  const t0 = audio.currentTime + 0.02;
  for (const note of notes) {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    const start = t0 + (note.at || 0);
    osc.frequency.setValueAtTime(note.freq, start);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    const lowpass = audio.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1600, start);
    osc.connect(gain);
    gain.connect(lowpass);
    lowpass.connect(bus);
    osc.start(start);
    osc.stop(start + note.dur + 0.05);
  }
}

export function sfxPedestal() {
  playNotes([
    { freq: 784, dur: 0.32, gain: 0.05 },
    { freq: 1175, dur: 0.4, gain: 0.028, at: 0.05 },
  ]);
}

export function sfxSeal() {
  playNotes([
    { freq: 523, dur: 0.75, gain: 0.05 },
    { freq: 659, dur: 0.85, gain: 0.04, at: 0.14 },
    { freq: 784, dur: 1.0, gain: 0.032, at: 0.28 },
  ]);
}

export function sfxAcquired() {
  playNotes([
    { freq: 392, dur: 0.9, gain: 0.048 },
    { freq: 494, dur: 0.95, gain: 0.038 },
    { freq: 587, dur: 1.05, gain: 0.032 },
  ]);
}

export function sfxPurchase() {
  playNotes([
    { freq: 988, dur: 0.14, gain: 0.04 },
    { freq: 1319, dur: 0.18, gain: 0.028, at: 0.08 },
  ]);
}
