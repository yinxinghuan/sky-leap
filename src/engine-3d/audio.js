// ============================================================================
//  engine-3d/audio.js — WebAudio infrastructure shared across all 3D timing
//  games. tone() + noiseBurst() are byte-identical between Sky Leap and
//  Corporate Climb. audioUnlock() is the same except master gain.
//  Game-specific SFX (sfxStomp, sfxPerfect, etc.) stay in each game.
// ============================================================================

let AC = null, master = null;

/** One-time audio context init. Call on first user gesture. */
export function audioUnlock({ masterGain = 0.95, onUnlock } = {}) {
  if (AC) {
    if (AC.state !== 'running' && AC.resume) AC.resume();
    return;
  }
  const ACtor = window.AudioContext || window.webkitAudioContext;
  if (!ACtor) return;
  AC = new ACtor();
  master = AC.createGain();
  master.gain.value = masterGain;
  const comp = AC.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(AC.destination);
  if (AC.state !== 'running' && AC.resume) AC.resume();
  if (onUnlock) onUnlock(AC, master);
}

/** Get the shared AudioContext (null until unlocked). */
export function getAudioCtx() { return AC; }

/** Get the master GainNode. */
export function getMaster() { return master; }

/** Play a pure tone. freq=Hz, dur=seconds. */
export function tone(freq, dur, o = {}) {
  if (!AC) return;
  const t0 = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.lp || 3400;
  osc.connect(g);
  g.connect(lp);
  lp.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** Burst of white/pink noise. dur=seconds. */
export function noiseBurst(dur, o = {}) {
  if (!AC) return;
  const t0 = AC.currentTime + (o.delay || 0);
  const n = Math.max(1, Math.floor(AC.sampleRate * dur));
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource();
  src.buffer = buf;
  const g = AC.createGain();
  g.gain.value = o.gain || 0.15;
  const f = AC.createBiquadFilter();
  f.type = o.type || 'highpass';
  f.frequency.value = o.hp || 500;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}
