// test.mjs — PROOF-OF-PLAY for THE EAR. Zero tokens. The claim under test: a running system's health maps to a
// chord whose SENSORY DISSONANCE (Sethares roughness) tracks degradation — healthy resolves, a leak rises, and a
// correlated fault is AUDIBLE before any single metric trips its red-line. We prove the acoustics are the real
// Plomp–Levelt curve (not a linear stand-in), that dissonance tracks a real leak/resolve, and — the flag — the
// ear-beats-eye operating point exists. All pure, deterministic, fuzz-safe.
import {
  pairRoughness, spectrumRoughness, roughnessOf, dissonance01, health, label,
  voicesOf, spectrumOf, render, dev, eyeAlarm, eyeAlarms, VOICES, METRICS,
  HEALTHY_STATE, REDLINE_STATE, RESOLVED, TENSE, newSystem, step, F0, HARM,
} from './ear.mjs';

const approx = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

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

console.log('\n=== §9 · BOUNDARY PINS — exact-edge assertions that kill single-operator mutants the happy path flies past ===');
{
  // ── the EYE fires exactly AT the red-line, not one step past it (dev === 1 boundary) ──
  // pins `dev(id,value) >= 1` in eyeAlarm: at exactly the red-line dev is exactly 1, so >= fires and > would not.
  VOICES.forEach(v => {
    ok(eyeAlarm(v.id, METRICS[v.id].redline) === true, `  · eyeAlarm(${v.id}) fires AT the red-line — dev is exactly 1 there (>= boundary, not >)`);
    ok(dev(v.id, METRICS[v.id].redline) === 1, `  · dev(${v.id}, redline) is exactly 1`);
  });

  // ── every voice carries exactly HARM partials (the `n <= HARM` loop bound) ──
  // pins the harmonic count: `<= HARM` yields HARM partials; `< HARM` would silently drop the top harmonic.
  const vs = voicesOf(HEALTHY_STATE);
  ok(vs.length === VOICES.length && vs.every(v => v.partials.length === HARM),
     `every voice has exactly HARM=${HARM} partials (loop bound n <= HARM, off-by-one would drop the top harmonic)`);
  ok(spectrumOf(HEALTHY_STATE).length === VOICES.length * HARM,
     `the full spectrum has exactly ${VOICES.length}×${HARM}=${VOICES.length * HARM} partials`);

  // ── the fundamental partial (n=1) sits at full voice weight: a = weight·0.8^(n-1) ──
  // pins the `n - 1` exponent: at n=1 the roll-off exponent is 0 so amplitude equals the weight exactly;
  // an `n + 1` flip would make it weight·0.8^2 and every partial 0.64× too quiet.
  ok(vs.every((v, i) => approx(v.partials[0].a, VOICES[i].weight)),
     'the fundamental of each voice has amplitude exactly = its weight (0.8^0 = 1 roll-off), pinning the n-1 exponent');
  ok(approx(vs[0].partials[1].a, VOICES[0].weight * 0.8) && approx(vs[0].partials[2].a, VOICES[0].weight * 0.64),
     'higher partials roll off as weight·0.8^(n-1) — 0.8, 0.64, … (geometric, one step per harmonic)');

  // ── the physicality guard: a partial with a non-positive FREQUENCY contributes exactly zero roughness ──
  // pins the two frequency clauses of `!(f1>0) || !(f2>0) || ...` (the `>` on f1/f2 and the OR short-circuits):
  // a zero/negative frequency must be rejected BEFORE the roughness formula, which would otherwise return >0.
  ok(pairRoughness(0, 1, 440, 1) === 0, 'a zero first-frequency partial is rejected (f1>0 guard) — exactly zero roughness');
  ok(pairRoughness(440, 1, 0, 1) === 0, 'a zero second-frequency partial is rejected (f2>0 guard) — exactly zero roughness');
  ok(pairRoughness(-1, 1, 440, 1) === 0, 'a negative first-frequency partial is rejected — the OR-guard short-circuits to zero');
  ok(pairRoughness(440, 1, -1, 1) === 0, 'a negative second-frequency partial is rejected — the OR-guard short-circuits to zero');
  // and the guard does NOT swallow a legitimately rough pair (proves the guard is a gate, not a blanket zero)
  ok(pairRoughness(440, 1, 452, 1) > 0, 'two physical partials a semitone-ish apart ARE rough (the guard lets real roughness through)');

  // ── throughput sags under EITHER storm OR spike, not only when BOTH coincide (the `f.storm || f.spike`) ──
  // pins the OR in the throughput target: a storm ALONE must drag throughput down; an && flip would leave it healthy.
  const sysStorm = newSystem();
  for (let i = 0; i < 12; i++) step(sysStorm, { storm: true });          // storm only — spike stays false
  ok(sysStorm.throughput < METRICS.throughput.healthy - 0.05,
     `a storm ALONE sags throughput (${sysStorm.throughput.toFixed(3)} < healthy) — the (storm || spike) target, not (storm && spike)`);
  const sysSpike = newSystem();
  for (let i = 0; i < 12; i++) step(sysSpike, { spike: true });          // spike only — storm stays false
  ok(sysSpike.throughput < METRICS.throughput.healthy - 0.05,
     `a spike ALONE sags throughput (${sysSpike.throughput.toFixed(3)} < healthy) — either fault alone is enough`);
}

console.log('\n=== §10 · LABEL BOUNDARIES ARE EXACT — a state sitting precisely ON a threshold takes the < side, not <= ===');
{
  // The label() bands compare the (continuous, float) dissonance to fixed thresholds with STRICT `<`.
  // A `< → <=` flip only shows up on a state whose dissonance lands EXACTLY on the threshold double — which
  // the happy-path tests never do. We CONSTRUCT such a witness: search metric-space for a state with
  // dissonance01(state) === threshold (bit-exact), then assert label() takes the strict-`<` branch there.
  // Seeded with a known witness for speed; re-derives one deterministically if the kernel ever shifts.
  const boundaryState = (thr, ...seeds) => {
    for (const s of seeds) if (dissonance01(s) === thr) return s;
    let seed = 20240607;                                   // deterministic LCG — same witness on every platform
    const rnd = () => { seed = (1103515245 * seed + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const at = (dir, t) => Object.fromEntries(VOICES.map(v => [v.id, METRICS[v.id].healthy + t * dir[v.id]]));
    for (let k = 0; k < 40000; k++) {
      const dir = {}; for (const v of VOICES) dir[v.id] = (0.15 + rnd()) * (METRICS[v.id].redline - METRICS[v.id].healthy);
      const f = t => dissonance01(at(dir, t));
      let lo = 0, hi = 8; if (f(lo) >= thr) continue; if (f(hi) <= thr) { hi = 50; if (f(hi) <= thr) continue; }
      for (let i = 0; i < 120; i++) { const mid = (lo + hi) / 2; if (mid === lo || mid === hi) break; if (f(mid) < thr) lo = mid; else hi = mid; }
      if (f(lo) === thr) return at(dir, lo);
      if (f(hi) === thr) return at(dir, hi);
    }
    return null;
  };

  // A witness sitting EXACTLY on TENSE: d < TENSE is false there, so the band is "tense" — a `<=` flip says "unsettled".
  const onTense = boundaryState(TENSE,
    { heap: 0.3382627724813818, latency: 43.301168109852206, lag: 7.195203288136037, errors: 0.0062551121854667255, throughput: 0.9327906329215888 });
  ok(onTense && dissonance01(onTense) === TENSE, `constructed a state whose dissonance is EXACTLY TENSE=${TENSE} (${onTense ? dissonance01(onTense) : 'none'})`);
  ok(onTense && label(onTense) === 'tense', 'a state exactly ON the TENSE line labels "tense" (strict d<TENSE is false) — pins the middle `<`, a `<=` flip would say "unsettled"');

  // A witness sitting EXACTLY on 0.6: d < 0.6 is false there, so the band is "dissonant" — a `<=` flip says "tense".
  const onSix = boundaryState(0.6,
    { heap: 0.3823286712645371, latency: 70.02379862445167, lag: 13.01115780693599, errors: 0.011225607509863473, throughput: 0.8748607993213228 });
  ok(onSix && dissonance01(onSix) === 0.6, `constructed a state whose dissonance is EXACTLY the 0.6 line (${onSix ? dissonance01(onSix) : 'none'})`);
  ok(onSix && label(onSix) === 'dissonant', 'a state exactly ON the 0.6 line labels "dissonant" (strict d<0.6 is false) — pins the top `<`, a `<=` flip would say "tense"');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ THE EAR HEARS IT — health is a chord, degradation is roughness, correlation is audible before the red-line · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
