import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeWav, joinSamples, musicParts } from "./audio";

test("a film up to three minutes needs one track; longer ones are made in equal parts under the limit", () => {
  assert.deepEqual(musicParts(60), [60]);
  assert.deepEqual(musicParts(180), [180]);
  const p = musicParts(300);
  assert.ok(p.length === 2 && p.every((s) => s <= 180 && s >= 5));
  assert.ok(p.reduce((a, b) => a + b, 0) >= 300);
  assert.ok(musicParts(500).length >= 3);
});

test("two parts join with a short crossfade, so the join has no click and the length is right", () => {
  const a = new Float32Array(1000).fill(1), b = new Float32Array(1000).fill(1);
  const j = joinSamples([a, b], 1000, 0.1);
  assert.equal(j.length, 1900);
  assert.ok(Math.abs(j[950]! - 1) < 0.02, `middle of the fade ${j[950]}`);
  assert.equal(j[0], 1);
  assert.equal(joinSamples([a], 1000, 0.1).length, 1000);
});

test("a wav file has the right header, size and samples", () => {
  const w = encodeWav(new Float32Array([0, 1, -1, 0.5]), 8000);
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...w.slice(8, 12)), "WAVE");
  assert.equal(dv.getUint32(24, true), 8000);
  assert.equal(w.length, 44 + 8);
  assert.equal(dv.getInt16(46, true), 32767);
  assert.equal(dv.getInt16(48, true), -32768);
});
