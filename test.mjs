// test.mjs — PROOF-OF-PLAY for THE EAR. Zero tokens. The claim under test: a running system's health maps to a
// chord whose SENSORY DISSONANCE (Sethares roughness) tracks degradation — healthy resolves, a leak rises, and a
// correlated fault is AUDIBLE before any single metric trips its red-line. We prove the acoustics are the real
// Plomp–Levelt curve (not a linear stand-in), that dissonance tracks a real leak/resolve, and — the flag — the
// ear-beats-eye operating point exists. All pure, deterministic, fuzz-safe.
import {
  pairRoughness, spectrumRoughness, roughnessOf, dissonance01, health, label,
  voicesOf, spectrumOf, render, dev, eyeAlarm, eyeAlarms, VOICES, METRICS,
  HEALTHY_STATE, REDLINE_STATE, RESOLVED, TENSE, newSystem, step, F0,
} from './ear.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const cents = c => F0 * Math.pow(2, c / 1200);   // a freq c cents above the tonic

console.log('\n=== §1 · THE ACOUSTICS ARE REAL — Plomp–Levelt/Sethares roughness, not a linear hack ===');
{
  // two equal-amplitude partials near 440 Hz: coincident ≈ 0, a minor 2nd is rough, an octave is smooth.
  const rUnison = pairRoughness(440, 1, 440, 1);
  const rSemitone = pairRoughness(440, 1, 440 * Math.pow(2, 1 / 12), 1);
  const rOctave = pairRoughness(440, 1, 880, 1);
  ok(rUnison < 1e-9, `coincident partials have ~zero roughness (${rUnison.toExponential(1)})`);
  ok(rSemitone > 5 * rOctave, `a minor 2nd is far rougher than an octave (semitone ${rSemitone.toFixed(3)} ≫ octave ${rOctave.toFixed(3)})`);
  // the curve RISES then FALLS with separation (the critical band) — the signature of the real model
  const sweep = [1, 3, 6, 10, 15, 22, 35, 60, 120].map(df => pairRoughness(440, 1, 440 + df, 1));
  const peakIdx = sweep.indexOf(Math.max(...sweep));
  ok(peakIdx > 0 && peakIdx < sweep.length - 1, `roughness peaks INSIDE the critical band then decays (peak at index ${peakIdx} of ${sweep.length}) — non-monotonic, the real curve`);
  ok(pairRoughness(440, 1, 460, 1) === pairRoughness(460, 1, 440, 1), 'roughness is symmetric in the two partials');
}

console.log('\n=== §2 · A HEALTHY SYSTEM RESOLVES — the consonant chord is quiet ===');
{
  const hd = dissonance01(HEALTHY_STATE);
  ok(hd < RESOLVED, `the all-healthy chord resolves (dissonance ${hd.toFixed(3)} < ${RESOLVED})`);
  ok(label(HEALTHY_STATE) === 'resolved', `a healthy system is labelled "resolved" (got "${label(HEALTHY_STATE)}")`);
  ok(eyeAlarms(HEALTHY_STATE) === 0, 'no per-metric alarms fire when healthy');
  ok(dissonance01(REDLINE_STATE) > 0.6, `everything at the red-line is loudly dissonant (${dissonance01(REDLINE_STATE).toFixed(3)})`);
}

console.log('\n=== §3 · DEGRADATION IS AUDIBLE — dissonance tracks a worsening metric monotonically ===');
{
  const series = [];
  for (let d = 0; d <= 1.0001; d += 0.1) {
    const value = METRICS.heap.healthy + d * (METRICS.heap.redline - METRICS.heap.healthy);
    series.push(dissonance01({ ...HEALTHY_STATE, heap: value }));
  }
  let mono = true; for (let i = 1; i < series.length; i++) if (series[i] < series[i - 1] - 1e-9) mono = false;
  ok(mono, 'as heap climbs healthy→redline, dissonance never decreases (monotone)');
  ok(series[series.length - 1] > series[0] + 0.05, `and it clearly rises (${series[0].toFixed(3)} → ${series[series.length - 1].toFixed(3)})`);
}

console.log('\n=== §4 · THE MEMORY LEAK — a rising dissonance you can hear before it alarms ===');
{
  const sys = newSystem(); const diss = [];
  for (let i = 0; i < 12; i++) { step(sys, { leak: true }); diss.push(dissonance01(sys)); }
  let rising = true; for (let i = 1; i < diss.length; i++) if (diss[i] < diss[i - 1] - 1e-9) rising = false;
  ok(rising, 'a running leak produces a STRICTLY non-decreasing dissonance — the "rising tone" of a leak');
  ok(diss[diss.length - 1] > diss[0] + 0.1, `the leak is unmistakably audible by the end (${diss[0].toFixed(3)} → ${diss[diss.length - 1].toFixed(3)})`);
  // the ear hears it BEFORE the eye: run until heap actually trips its red-line, recording when each first fires.
  const sys2 = newSystem(); let earStep = -1, eyeStep = -1;
  for (let i = 0; i < 120 && eyeStep < 0; i++) { step(sys2, { leak: true }); if (earStep < 0 && dissonance01(sys2) >= TENSE) earStep = i; if (eyeStep < 0 && eyeAlarm('heap', sys2.heap)) eyeStep = i; }
  ok(earStep >= 0 && eyeStep >= 0 && earStep < eyeStep, `the ear flags the leak at step ${earStep}, STRICTLY before the red-line alarm at step ${eyeStep} — you hear it coming`);
}

console.log('\n=== §5 · IT RESOLVES — fixing the fault returns the chord to consonance ===');
{
  const sys = newSystem();
  for (let i = 0; i < 10; i++) step(sys, { leak: true, storm: true });
  const sick = dissonance01(sys); ok(sick > TENSE, `under leak+storm the system is dissonant (${sick.toFixed(3)})`);
  for (let i = 0; i < 60; i++) step(sys, { leak: false, storm: false, spike: false });
  const well = dissonance01(sys);
  ok(well < RESOLVED + 0.02, `after the fix it resolves back toward the tonic (${sick.toFixed(3)} → ${well.toFixed(3)})`);
}

console.log('\n=== §6 · THE FLAG — EAR BEATS EYE: a correlated fault is audible while every metric is still green ===');
{
  // an error storm building: errors + lag + throughput all degrade TOGETHER but each held below its own red-line.
  // no per-metric dashboard alarms — yet the interaction detunes multiple voices at once and the chord goes tense.
  const sub = 0.75;   // every stressed metric at 75% of its red-line: individually "green"
  const v = id => METRICS[id].healthy + sub * (METRICS[id].redline - METRICS[id].healthy);
  const state = { ...HEALTHY_STATE, errors: v('errors'), lag: v('lag'), throughput: v('throughput') };
  ok(eyeAlarms(state) === 0, `no single-metric alarm fires — the eye sees all-green (alarms=${eyeAlarms(state)})`);
  VOICES.forEach(x => { if (['errors', 'lag', 'throughput'].includes(x.id)) ok(dev(x.id, state[x.id]) < 1, `  · ${x.id} is below its red-line (dev ${dev(x.id, state[x.id]).toFixed(2)})`); });
  const d = dissonance01(state);
  ok(d >= TENSE, `— but the EAR hears it: dissonance ${d.toFixed(3)} ≥ tense ${TENSE}. The correlation is audible before any threshold.`);
}

console.log('\n=== §7 · THE SOUND IS REAL — additive synthesis is finite + bounded ===');
{
  const pcm = render(REDLINE_STATE, 0.25, 22050);
  ok(pcm.length === Math.floor(0.25 * 22050), `render produces the right number of samples (${pcm.length})`);
  let okRange = true, finite = true, energy = 0;
  for (const x of pcm) { if (!Number.isFinite(x)) finite = false; if (x < -1.0001 || x > 1.0001) okRange = false; energy += x * x; }
  ok(finite, 'every sample is finite');
  ok(okRange, 'the waveform never clips (|x| ≤ 1)');
  ok(energy > 0, 'the chord actually makes sound (non-zero energy)');
}

console.log('\n=== §8 · DETERMINISM + FUZZ — same state, same reading; garbage never throws ===');
{
  ok(dissonance01(REDLINE_STATE) === dissonance01(REDLINE_STATE), 'the same state yields the exact same dissonance');
  let threw = false, bounded = true;
  const garbage = [
    {}, { heap: NaN, latency: -5, lag: 'x', errors: 1e30, throughput: -Infinity },
    { heap: Infinity }, { heap: null, errors: undefined }, null,
  ];
  for (const g of garbage) {
    try { const d = dissonance01(g || {}); const r = roughnessOf(g || {}); const h = health(g || {});
      if (!Number.isFinite(d) || d < 0 || d > 1 || !Number.isFinite(r)) bounded = false; }
    catch { threw = true; }
  }
  ok(!threw, 'garbage / NaN / negative / missing metrics never throw');
  ok(bounded, 'dissonance stays a finite number in [0,1] on any input');
  ok(pairRoughness(-1, 1, NaN, 'x') === 0 && pairRoughness(440, 0, 440, 1) === 0, 'non-physical partials contribute exactly zero roughness');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ THE EAR HEARS IT — health is a chord, degradation is roughness, correlation is audible before the red-line · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
