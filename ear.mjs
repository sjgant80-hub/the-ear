// ear.mjs — SONIFIED SYSTEM HEALTH. A stethoscope for a running system: each live metric drives a VOICE in a
// consonant chord, and the combined spectrum's SENSORY DISSONANCE (Plomp–Levelt / Sethares roughness) is the
// health signal. A healthy system RESOLVES (a consonant chord, ~zero roughness); degradation is literally
// AUDIBLE as roughness/beating — a memory leak is a rising dissonance, a clean state resolves to the tonic.
//
// THE REAL, DEFENSIBLE CLAIM: dissonance is computed from the INTERACTION of the voices, so a problem that lives
// in the CORRELATION of several metrics — each still under its own red-line — is audible before any single-metric
// threshold fires. The ear catches what per-metric dashboards miss. (It does NOT find bugs for you; it makes the
// shape of the running system's health pre-attentively hearable. Honest scope: sonification, not a profiler.)
//
// Pure kernel — no audio device, no I/O, no network. Node + browser. Built on the-throat's "coherence is a chord".

// ══ 1 · Plomp–Levelt / Sethares sensory dissonance between two sinusoid partials ══
// Roughness peaks when two partials sit ~a quarter of a critical band apart (beating), →0 when coincident or far.
const B1 = 3.5, B2 = 5.75, DSTAR = 0.24, S1 = 0.0207, S2 = 18.96;
export function pairRoughness(f1, a1, f2, a2) {
  f1 = +f1; f2 = +f2; a1 = +a1; a2 = +a2;
  if (!(f1 > 0) || !(f2 > 0) || !(a1 > 0) || !(a2 > 0)) return 0;      // ignore non-physical partials (fuzz-safe)
  if (f1 > f2) { const tf = f1; f1 = f2; f2 = tf; const ta = a1; a1 = a2; a2 = ta; }
  const df = f2 - f1;
  const s = DSTAR / (S1 * f1 + S2);                                     // critical-band scaling (register-dependent)
  const r = a1 * a2 * (Math.exp(-B1 * s * df) - Math.exp(-B2 * s * df));
  return r > 0 ? r : 0;
}

// Total roughness of a spectrum = sum of pairwise roughness over all partials.
export function spectrumRoughness(partials) {
  let d = 0;
  for (let i = 0; i < partials.length; i++)
    for (let j = i + 1; j < partials.length; j++)
      d += pairRoughness(partials[i].f, partials[i].a, partials[j].f, partials[j].a);
  return d;
}

// ══ 2 · the CHORD: metrics → voices → partials ══
// A healthy metric parks its voice on a harmonic-series ratio (maximally consonant with the others: 4:5:6:8:12).
// Degradation DETUNES the voice off that ratio (sharp or flat per metric), pushing its upper partials into the
// critical band of its neighbours → roughness. Each voice is a tone with HARM harmonics rolling off in amplitude.
export const F0 = 220;                    // tonic (Hz)
export const HARM = 6;                    // harmonics per voice
const DETUNE = 0.028;                     // detune at dev=1 (~half a semitone) — enough to reach the roughness band

// The default instrument: five voices for the classic golden-signals + heap. ratio = consonant seat in the chord,
// dir = which way degradation bends the pitch (opposite directions make joint stress COLLIDE — the ear-beats-eye
// effect), weight = how loud this voice sits in the mix.
export const VOICES = [
  { id: 'heap',       label: 'memory / heap',    ratio: 1,    dir: +1, weight: 1.00 },  // tonic
  { id: 'latency',    label: 'request latency',  ratio: 3 / 2, dir: -1, weight: 0.85 }, // fifth
  { id: 'lag',        label: 'event-loop lag',   ratio: 5 / 4, dir: +1, weight: 0.80 }, // major third
  { id: 'errors',     label: 'error rate',       ratio: 2,    dir: -1, weight: 0.75 },  // octave
  { id: 'throughput', label: 'throughput drop',  ratio: 3,    dir: +1, weight: 0.60 },  // twelfth
];

// A metric spec: healthy baseline and the red-line where a per-metric alarm ("the eye") fires. dev(value)=0 at
// baseline, 1 at the red-line (and can exceed 1 past it). All in the metric's own natural units.
export const METRICS = {
  heap:       { healthy: 0.30, redline: 0.85, unit: 'frac' },   // heap used fraction
  latency:    { healthy: 40,   redline: 200,  unit: 'ms' },     // p95 ms
  lag:        { healthy: 2,    redline: 50,   unit: 'ms' },     // event-loop lag ms
  errors:     { healthy: 0.001, redline: 0.05, unit: 'rate' },  // error fraction
  throughput: { healthy: 1.0,  redline: 0.4,  unit: 'x' },      // throughput vs baseline (LOWER is worse)
};

// deviation of a metric value from healthy toward the red-line, clamped at 0 below (only degradation detunes).
export function dev(id, value) {
  const m = METRICS[id]; if (!m) return 0;
  value = +value; if (!Number.isFinite(value)) return 0;
  const span = m.redline - m.healthy;
  if (span === 0) return 0;
  const d = (value - m.healthy) / span;                       // >0 as it worsens (works for both up- and down-bad)
  return d > 0 ? d : 0;
}

// a per-metric red-line alarm — "the eye". Fires only when THIS metric is past its own threshold.
export function eyeAlarm(id, value) { return dev(id, value) >= 1; }
export function eyeAlarms(state) { return VOICES.filter(v => eyeAlarm(v.id, state[v.id])).length; }

// the voices (with detuned frequency + partials) for a given metric state.
export function voicesOf(state) {
  return VOICES.map(v => {
    const d = dev(v.id, state[v.id]);
    const f = F0 * v.ratio * (1 + v.dir * DETUNE * d);
    const partials = [];
    for (let n = 1; n <= HARM; n++) partials.push({ f: f * n, a: v.weight * Math.pow(0.8, n - 1) });
    return { id: v.id, f, dev: d, detuneCents: 1200 * Math.log2(1 + v.dir * DETUNE * d), partials };
  });
}

// the full spectrum = every voice's partials.
export function spectrumOf(state) { return voicesOf(state).flatMap(v => v.partials); }

// ══ 3 · the HEALTH SIGNAL ══
// Raw roughness of the current state, and a 0..1 dissonance normalized against the fully-healthy baseline
// (≈0) and a reference "everything at the red-line" spectrum (≈1). Stable, deterministic.
export const HEALTHY_STATE = Object.fromEntries(VOICES.map(v => [v.id, METRICS[v.id].healthy]));
export const REDLINE_STATE = Object.fromEntries(VOICES.map(v => [v.id, METRICS[v.id].redline]));
const BASELINE_R = spectrumRoughness(spectrumOf(HEALTHY_STATE));
const REFERENCE_R = spectrumRoughness(spectrumOf(REDLINE_STATE));

export function roughnessOf(state) { return spectrumRoughness(spectrumOf(state)); }

export function dissonance01(state) {
  const r = roughnessOf(state);
  const span = REFERENCE_R - BASELINE_R;
  const x = span > 0 ? (r - BASELINE_R) / span : 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// thresholds on the normalized dissonance: below RESOLVED it's a clean chord; above TENSE the ear flags it.
export const RESOLVED = 0.08, TENSE = 0.30;
export function label(state) { const d = dissonance01(state); return d < RESOLVED ? 'resolved' : d < TENSE ? 'unsettled' : d < 0.6 ? 'tense' : 'dissonant'; }

// one call the UI/gate use: the whole health read of a state.
export function health(state) {
  return { roughness: roughnessOf(state), dissonance: dissonance01(state), label: label(state), eyeAlarms: eyeAlarms(state) };
}

// ══ 4 · AUDIO — additive synthesis of the current chord (so you actually HEAR it) ══
// Pure PCM generator; the browser feeds it to WebAudio, the gate checks it's finite + bounded. No device here.
export function render(state, seconds = 1, sampleRate = 44100) {
  const vs = voicesOf(state);
  const N = Math.max(1, Math.floor(seconds * sampleRate));
  const out = new Float32Array(N);
  let norm = 0; for (const v of vs) for (const p of v.partials) norm += p.a;
  norm = norm || 1;
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (const v of vs) for (const p of v.partials) s += p.a * Math.sin(2 * Math.PI * p.f * t);
    const env = Math.min(1, t * 20) * Math.min(1, (seconds - t) * 20);   // gentle 50ms fade in/out
    out[i] = (s / norm) * env;
  }
  return out;
}

// ══ 5 · a tiny RUNNING-SYSTEM SIMULATOR so the demo has something to listen to ══
// Advance simulated metrics; `inject` toggles faults (leak grows heap, storm raises errors+lag, spike raises
// latency). `resolve` eases everything back to healthy. Deterministic given its own state (no Math.random).
export function newSystem() { return { ...HEALTHY_STATE, t: 0, leak: 0, faults: { leak: false, storm: false, spike: false } }; }
export function step(sys, faults = sys.faults, dt = 1) {
  sys.t += dt; sys.faults = { ...sys.faults, ...faults };
  const f = sys.faults;
  // heap: leaks upward while `leak` is on (never auto-freed until resolve), else drifts to healthy
  if (f.leak) { sys.leak += 0.010 * dt; } else { sys.leak = Math.max(0, sys.leak - 0.02 * dt); }
  sys.heap = clamp01(METRICS.heap.healthy + sys.leak);
  // error storm: errors + event-loop lag climb together (correlated fault)
  const target = (bad, good, on) => on ? bad : good;
  sys.errors = ease(sys.errors, target(0.08, METRICS.errors.healthy, f.storm), 0.25 * dt);
  sys.lag = ease(sys.lag, target(70, METRICS.lag.healthy, f.storm), 0.25 * dt);
  // latency spike
  sys.latency = ease(sys.latency, target(260, METRICS.latency.healthy, f.spike), 0.30 * dt);
  // throughput sags a little under storm or spike
  sys.throughput = ease(sys.throughput, (f.storm || f.spike) ? 0.55 : METRICS.throughput.healthy, 0.25 * dt);
  return sys;
}
function ease(x, target, k) { return x + (target - x) * Math.min(1, Math.max(0, k)); }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

export default {
  pairRoughness, spectrumRoughness, VOICES, METRICS, F0, HARM, dev, eyeAlarm, eyeAlarms,
  voicesOf, spectrumOf, roughnessOf, dissonance01, RESOLVED, TENSE, label, health, render,
  HEALTHY_STATE, REDLINE_STATE, newSystem, step,
};
