import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_IMAGE_SECONDS,
  DEFAULT_VIDEO_SECONDS,
  atTime,
  buildCut,
  clipSeconds,
  cutList,
  ffmpegScript,
} from "./cut";
import { createProject, newShot, type Project, type Shot } from "./model";

function shot(over: Partial<Shot> = {}): Shot {
  return { ...newShot(), id: crypto.randomUUID(), heading: "SHOT", beat: "x", ...over };
}

const image = (url = "https://cdn.test/a.png"): NonNullable<Shot["render"]> => ({
  url, kind: "image", usd: 0.01, promptHash: "h", at: 1,
});
const video = (url = "https://cdn.test/a.mp4"): NonNullable<Shot["render"]> => ({
  url, kind: "video", usd: 0.1, promptHash: "h", at: 1,
});

function board(...shots: Shot[]): Project {
  return { ...createProject("Light Again"), shots };
}

test("an image holds for the default when no duration is set", () => {
  assert.equal(clipSeconds(shot({ render: image() })), DEFAULT_IMAGE_SECONDS);
});

test("a video takes the duration its model setting asked for", () => {
  const s = shot({ render: video(), model: { id: "m", settings: { duration: 8 } } });
  assert.equal(clipSeconds(s), 8);
});

// fal's Veo takes "8s" and Kling takes "5" — both are durations in seconds.
test("a duration setting written as text still counts", () => {
  assert.equal(clipSeconds(shot({ render: video(), model: { id: "m", settings: { duration: "8s" } } })), 8);
  assert.equal(clipSeconds(shot({ render: video(), model: { id: "m", settings: { duration: "5" } } })), 5);
});

test("a video with no stated duration falls back to the default", () => {
  assert.equal(clipSeconds(shot({ render: video() })), DEFAULT_VIDEO_SECONDS);
});

test("an explicit duration on the shot beats everything", () => {
  const s = shot({ render: video(), seconds: 2.5, model: { id: "m", settings: { duration: 8 } } });
  assert.equal(clipSeconds(s), 2.5);
});

test("a nonsense duration is ignored rather than producing a zero-length clip", () => {
  assert.equal(clipSeconds(shot({ render: image(), seconds: 0 })), DEFAULT_IMAGE_SECONDS);
  assert.equal(clipSeconds(shot({ render: image(), seconds: -4 })), DEFAULT_IMAGE_SECONDS);
  assert.equal(clipSeconds(shot({ render: image(), seconds: Number.NaN })), DEFAULT_IMAGE_SECONDS);
});

test("the cut follows story order and accumulates start times", () => {
  const cut = buildCut(board(
    shot({ render: image(), seconds: 2 }),
    shot({ render: image(), seconds: 3 }),
    shot({ render: image(), seconds: 4 }),
  ));
  assert.deepEqual(cut.clips.map((c) => c.start), [0, 2, 5]);
  assert.equal(cut.total, 9);
});

test("a shot with no render is left out and reported, not silently dropped", () => {
  const empty = shot({ heading: "EMPTY" });
  const cut = buildCut(board(shot({ render: image(), seconds: 2 }), empty));
  assert.equal(cut.clips.length, 1);
  assert.deepEqual(cut.skipped, [empty.id]);
});

test("reordering the board reorders the cut", () => {
  const a = shot({ heading: "A", render: image("https://x/a.png"), seconds: 1 });
  const b = shot({ heading: "B", render: image("https://x/b.png"), seconds: 1 });
  assert.deepEqual(buildCut(board(a, b)).clips.map((c) => c.heading), ["A", "B"]);
  assert.deepEqual(buildCut(board(b, a)).clips.map((c) => c.heading), ["B", "A"]);
});

test("an empty board makes an empty cut", () => {
  const cut = buildCut(board());
  assert.equal(cut.total, 0);
  assert.deepEqual(cut.clips, []);
});

test("atTime finds the clip under the playhead and the offset into it", () => {
  const cut = buildCut(board(
    shot({ render: image(), seconds: 2 }),
    shot({ render: image(), seconds: 3 }),
  ));
  assert.equal(atTime(cut, 0)?.clip.index, 0);
  assert.equal(atTime(cut, 1.5)?.offset, 1.5);
  assert.equal(atTime(cut, 2)?.clip.index, 1);
  assert.equal(atTime(cut, 3.25)?.offset, 1.25);
});

test("atTime clamps past the end to the last frame rather than returning nothing", () => {
  const cut = buildCut(board(shot({ render: image(), seconds: 2 })));
  const end = atTime(cut, 99);
  assert.equal(end?.clip.index, 0);
  assert.equal(end?.offset, 2);
});

test("atTime on an empty cut is null", () => {
  assert.equal(atTime(buildCut(board()), 0), null);
});

test("a negative time is treated as the start", () => {
  const cut = buildCut(board(shot({ render: image(), seconds: 2 })));
  assert.equal(atTime(cut, -5)?.offset, 0);
});

test("the cut list is readable JSON naming every clip and the total", () => {
  const cut = buildCut(board(shot({ heading: "INT. ALLEY", render: image(), seconds: 2 })));
  const text = cutList(cut, "Light Again");
  assert.ok(text.includes("\n  "), "indented");
  const parsed = JSON.parse(text) as { name: string; total: number; clips: Array<{ heading: string }> };
  assert.equal(parsed.name, "Light Again");
  assert.equal(parsed.total, 2);
  assert.equal(parsed.clips[0]!.heading, "INT. ALLEY");
});

test("the ffmpeg script names every clip and its duration", () => {
  const cut = buildCut(board(
    shot({ render: image("https://cdn.test/one.png"), seconds: 2 }),
    shot({ render: video("https://cdn.test/two.mp4"), seconds: 5 }),
  ));
  const script = ffmpegScript(cut, "Light Again");
  assert.match(script, /one\.png/);
  assert.match(script, /two\.mp4/);
  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /set -euo pipefail/);
});

// A URL goes into a shell script. A quote in one must not break out of it.
test("a hostile URL cannot escape its quoting in the ffmpeg script", () => {
  const evil = "https://cdn.test/a.png';touch /tmp/pwned;'";
  const script = ffmpegScript(buildCut(board(shot({ render: image(evil), seconds: 1 }))), "x");
  assert.equal(/;touch \/tmp\/pwned;(?!')/.test(script.replace(/'\\''/g, "")), false);
  assert.ok(script.includes(`'\\''`), "the quote was escaped");
});

test("a project name with shell metacharacters stays inert in the script", () => {
  const script = ffmpegScript(buildCut(board(shot({ render: image(), seconds: 1 }))), '$(rm -rf ~) "x"');
  assert.equal(script.includes("$(rm -rf ~)"), false);
});

test("an empty cut refuses to produce a script that does nothing", () => {
  assert.throws(() => ffmpegScript(buildCut(board()), "x"), /nothing to export/i);
});
