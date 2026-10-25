import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnose, summarize, type Metrics } from "./doctor";

/** The long, soft cut: 112 seconds, a shot every 4 or 5 seconds in the first third, dissolves between them, little movement. */
const slow = (): Metrics => ({
  seconds: 112, width: 2048, height: 1152, fps: 30, hasAudio: true,
  hardCuts: [],
  dissolves: [2, 6, 10, 14, 16, 20, 23, 28, 30, 32, 35, 39, 43, 48, 51, 52, 53, 54, 55, 58, 61, 62, 63, 64, 65, 71, 74, 78, 79, 80, 81, 82, 83, 86, 89, 90, 91, 92, 93, 94, 98, 103, 107],
  motion: [7.5, 5.5, 5.7, 8.7, 6.9, 5.8, 5.7, 4.9, 9.7, 9.8, 8.9, 2.3, 11.8, 23.2, 6.4, 18, 14, 7.5, 4.2, 18.7, 17.6, 6.7, 21.3, 15.7, 11.2, 9.8, 11.7],
  loudness: { integrated: -16, range: 7.1, peak: -2, openingDb: -40 },
});

/** The tight cut: 57 seconds, hard cuts that speed up, music from the first frame. */
const tight = (): Metrics => ({
  seconds: 57, width: 1920, height: 1080, fps: 30, hasAudio: true,
  hardCuts: [2.7, 4.5, 6.3, 7.6, 9, 11.2, 12.1, 13, 13.9, 15.2, 16.6, 17.5, 18.4, 19.3, 19.7, 21.5, 22.8, 25.1, 26.4, 28.2, 29.6, 31.4, 33.6, 38.5, 39.9, 41.7, 43, 44.8, 46.1, 48.4, 51.5],
  dissolves: [52.1],
  motion: [14, 16, 15, 17, 19, 18, 21, 20, 22, 18, 17, 19, 21, 24],
  loudness: { integrated: -13.4, range: 6, peak: -1.6, openingDb: -30 },
});

const ids = (m: Metrics, level: string) => diagnose(m).filter((f) => f.level === level).map((f) => f.id);

test("the long soft cut is told to trim, to open faster and to cut instead of dissolve", () => {
  const bad = ids(slow(), "fail").concat(ids(slow(), "warn"));
  for (const want of ["length", "pace", "soft-cuts"]) assert.ok(bad.includes(want), `${want} missing from ${bad}`);
  assert.ok(summarize(diagnose(slow())).score < 65);
});

test("the tight cut passes on length, pace, cuts and loudness", () => {
  const good = ids(tight(), "good");
  for (const want of ["length", "pace", "soft-cuts", "loudness"]) assert.ok(good.includes(want), `${want} missing from ${good}`);
  assert.equal(ids(tight(), "fail").length, 0);
  assert.ok(summarize(diagnose(tight())).score >= 85);
});

test("length: up to a minute is good, to ninety seconds a warning, longer a failure", () => {
  const at = (seconds: number) => diagnose({ ...tight(), seconds }).find((f) => f.id === "length")!.level;
  assert.deepEqual([at(45), at(60), at(75), at(90), at(100), at(200)], ["good", "good", "warn", "warn", "fail", "fail"]);
});

test("the hook: nothing cut or moving in the first three seconds is flagged, and a cut inside them clears it", () => {
  const still = { ...tight(), hardCuts: [4.5, 6.3], dissolves: [], motion: [2, 14, 15] };
  assert.notEqual(diagnose(still).find((f) => f.id === "hook")!.level, "good");
  assert.equal(diagnose({ ...tight(), hardCuts: [1.2, 2.5, 4], motion: [16, 15, 14] }).find((f) => f.id === "hook")!.level, "good");
});

test("dead air at the start is flagged; music from the first frame is not", () => {
  assert.notEqual(diagnose({ ...tight(), loudness: { integrated: -14, range: 6, peak: -2, openingDb: -70 } }).find((f) => f.id === "opening-sound")!.level, "good");
  assert.equal(diagnose(tight()).find((f) => f.id === "opening-sound")!.level, "good");
});

test("loudness: too quiet or too loud, or clipping, is flagged", () => {
  const at = (integrated: number, peak = -2) => diagnose({ ...tight(), loudness: { integrated, range: 6, peak, openingDb: -30 } }).find((f) => f.id === "loudness")!.level;
  assert.deepEqual([at(-14), at(-16), at(-20), at(-9), at(-14, 0.5)], ["good", "good", "warn", "warn", "warn"]);
});

test("a film with no sound track is told so, and a measured one with no loudness data is not blamed", () => {
  assert.equal(diagnose({ ...tight(), hasAudio: false, loudness: null }).find((f) => f.id === "loudness")!.level, "fail");
  assert.equal(diagnose({ ...tight(), loudness: null }).find((f) => f.id === "loudness"), undefined);
});

test("pace should pick up: a cut that gets no faster toward the end is told so", () => {
  const flat = { ...tight(), hardCuts: Array.from({ length: 14 }, (_, i) => 4 + i * 4), dissolves: [], motion: Array.from({ length: 14 }, () => 15) };
  assert.notEqual(diagnose(flat).find((f) => f.id === "build")!.level, "good");
  assert.equal(diagnose(tight()).find((f) => f.id === "build")!.level, "good");
});

test("every finding says what is wrong and what to do about it", () => {
  for (const f of diagnose(slow())) {
    assert.ok(f.title.length > 3 && f.detail.length > 10, f.id);
    if (f.level !== "good") assert.ok(f.fix.length > 10, `${f.id} has no fix`);
  }
});

test("a very short clip is judged on what it has and never divides by zero", () => {
  const tiny: Metrics = { seconds: 2, width: 1080, height: 1920, fps: 30, hasAudio: true, hardCuts: [], dissolves: [], motion: [], loudness: null };
  const out = diagnose(tiny);
  assert.ok(out.length > 0);
  assert.ok(Number.isFinite(summarize(out).score));
});
