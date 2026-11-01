import assert from "node:assert/strict";
import { test } from "node:test";

import { detectTempo } from "./tempo";

/** A click track: a short decaying burst on every beat. */
function clicks(bpm: number, first: number, seconds: number, rate = 22050): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  const spb = 60 / bpm;
  for (let t = first; t < seconds; t += spb) {
    const i = Math.floor(t * rate);
    for (let k = 0; k < 400 && i + k < out.length; k++) out[i + k] = (out[i + k] ?? 0) + Math.sin(k * 0.5) * Math.exp(-k / 80);
  }
  return out;
}

test("it finds the tempo and where the first beat falls", () => {
  const r = detectTempo(clicks(120, 0.25, 20), 22050)!;
  assert.ok(Math.abs(r.bpm - 120) < 1.5, `bpm ${r.bpm}`);
  assert.ok(Math.abs(r.firstBeat - 0.25) < 0.04, `first ${r.firstBeat}`);
});

test("a faster track, started later", () => {
  const r = detectTempo(clicks(150, 0.6, 20), 22050)!;
  assert.ok(Math.abs(r.bpm - 150) < 1.5, `bpm ${r.bpm}`);
  assert.ok(Math.abs(r.firstBeat - 0.6) < 0.04, `first ${r.firstBeat}`);
});

test("it still finds the beat under noise", () => {
  const x = clicks(132, 0.1, 24); let s = 7;
  for (let i = 0; i < x.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i]! += ((s / 4294967296) - 0.5) * 0.15; }
  const r = detectTempo(x, 22050)!;
  assert.ok(Math.abs(r.bpm - 132) < 2, `bpm ${r.bpm}`);
});

test("silence, or a clip too short to measure, gives nothing", () => {
  assert.equal(detectTempo(new Float32Array(22050 * 30), 22050), null);
  assert.equal(detectTempo(clicks(120, 0, 1.5), 22050), null);
});
