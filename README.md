# the ear — debug a running system by *listening* to it

**▶ Live: https://sjgant80-hub.github.io/the-ear/**  (press **listen**, then hit **error storm** and watch the eye stay green while the ear goes tense)

A stethoscope for a running system. Each live metric drives a **voice** in a chord, and the combined
spectrum's **sensory dissonance** (Plomp–Levelt / Sethares roughness) is the health signal. A healthy
system **resolves** — a consonant chord, near-zero roughness. Degradation is literally **audible**: a
memory leak is a *rising* dissonance, an error storm is *beating*, a fix **resolves** back to the tonic.
Nobody debugs code by ear. You can hear the bug before the profiler finds it.

## The one real, novel claim — the ear beats the eye

A per-metric dashboard alarms only when *one* metric crosses *its own* red-line. But `the ear` computes
dissonance from the **interaction** of the voices — so a fault that lives in the **correlation** of several
metrics, each still under its own threshold, is **audible while every dial is green**.

Proven in the gate (`§6`): with error-rate, event-loop-lag and throughput all held at **75% of their red-lines**
(zero per-metric alarms), the chord reads **0.96 dissonance**. And on a simulated leak (`§4`), the ear crosses
"tense" at **step 12** — the heap red-line only fires at **step 54**. You hear it coming 42 ticks early.

## Honest scope

- **Real:** the acoustics are the actual Plomp–Levelt/Sethares roughness curve (`§1` proves it's non-monotonic
  in pitch separation — the real critical band, not a linear stand-in). Healthy resolves; degradation is
  monotone-audible; a leak rises; a fix resolves; correlated faults are audible pre-red-line. The tones you
  hear are the **exact 6-harmonic spectrum the gate scores** — the gated logic *is* the live logic.
- **NOT claimed:** it does **not** find bugs for you or replace a profiler. It makes a system's health
  *hearable* — a pre-attentive channel your eyes don't have. Sonification, not diagnosis.

## Listen to a real system

The **listen to this tab** button sonifies *this browser tab's own* event-loop lag (from `requestAnimationFrame`
jitter) and JS heap (`performance.memory`, Chrome) — genuinely real data. Freeze the tab and hear it detune.

## Proven — `node test.mjs`, zero tokens, 28/28

`§1` the acoustics are the real roughness curve · `§2` healthy resolves · `§3` degradation is monotone-audible ·
`§4` a leak is a rising dissonance, heard before its red-line · `§5` a fix resolves to consonance · `§6` **the
flag** — a correlated fault is audible while every metric is green · `§7` the synthesized sound is finite +
non-clipping · `§8` deterministic + fuzz-safe (garbage never throws).

## Files

`ear.mjs` (the kernel — roughness, the chord, dissonance, additive synthesis, a running-system simulator) ·
`test.mjs` (the 28/28 gate) · `index.html` (the live auscultation dashboard — WebAudio, an oscilloscope of the
health chord, eye-vs-ear panel). Zero-dep, Node + browser, offline. Built on
[the-throat](https://sjgant80-hub.github.io/the-throat/) ("coherence is a chord").

```bash
node test.mjs                 # the proof
python -m http.server 8080    # then open http://localhost:8080 and press "listen"
```
