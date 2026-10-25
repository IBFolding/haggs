import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { analyze, parseScores, shape } from "./analyze";

const dir = mkdtempSync(join(tmpdir(), "doctor-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const ff = (...args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);

test("parseScores reads each frame's time and difference", () => {
  const text = "frame:0 pts:0 pts_time:0\nlavfi.scene_score=0.000000\nframe:1 pts:1 pts_time:0.1\nlavfi.scene_score=0.512000\n";
  assert.deepEqual(parseScores(text), [{ t: 0, score: 0 }, { t: 0.1, score: 0.512 }]);
});

test("shape finds a hard cut, a dissolve, and movement per window", () => {
  const scores = [];
  for (let i = 0; i < 100; i++) scores.push({ t: i / 10, score: i === 30 ? 0.8 : i >= 60 && i < 70 ? 0.06 : 0.001 });
  const s = shape(scores);
  assert.deepEqual(s.hardCuts, [3]);
  assert.equal(s.dissolves.length, 1);
  assert.ok(Math.abs(s.dissolves[0]! - 6.5) < 1);
});

test("a real file: hard cuts, size, sound", async () => {
  // Three 2-second colours joined by hard cuts, with a tone for sound.
  ff("-f", "lavfi", "-i", "color=c=red:s=320x180:r=30:d=2", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30:d=2", "-f", "lavfi", "-i", "color=c=green:s=320x180:r=30:d=2",
    "-f", "lavfi", "-i", "sine=f=440:d=6", "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", join(dir, "cuts.mp4"));
  const m = await analyze(join(dir, "cuts.mp4"));
  assert.equal(m.width, 320);
  assert.ok(Math.abs(m.seconds - 6) < 0.3);
  assert.equal(m.hasAudio, true);
  assert.equal(m.hardCuts.length, 2);
  assert.ok(Math.abs(m.hardCuts[0]! - 2) < 0.2 && Math.abs(m.hardCuts[1]! - 4) < 0.2);
  assert.ok(m.loudness && m.loudness.integrated !== null && m.loudness.openingDb !== null && m.loudness.openingDb > -45);
});

test("a real file: a silent film has no audio, and a still one barely moves", async () => {
  ff("-f", "lavfi", "-i", "color=c=gray:s=320x180:r=30:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(dir, "still.mp4"));
  const m = await analyze(join(dir, "still.mp4"));
  assert.equal(m.hasAudio, false);
  assert.equal(m.loudness, null);
  assert.equal(m.hardCuts.length, 0);
  assert.ok(m.motion.length >= 1 && Math.max(...m.motion) < 3);
});

test("a real file: a moving picture reads as motion", async () => {
  ff("-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(dir, "moving.mp4"));
  const m = await analyze(join(dir, "moving.mp4"));
  assert.ok(m.motion.length >= 1 && Math.min(...m.motion) > 2, `motion ${m.motion}`);
});
