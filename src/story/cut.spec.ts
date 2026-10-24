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

test("voice lines play from their shot's start plus their offset, and move with the shot", () => {
  const a = shot({ seconds: 3, render: image() });
  const b = shot({ seconds: 4, render: video(), voices: [{ id: "v1", url: "/api/local/line.mp3", text: "Stop counting.", speaker: "ELLIS", voice: "Chris (male, american)", offset: 0.5 }] });
  const cut = buildCut(board(a, b));
  assert.deepEqual(cut.voices.map((v) => [v.text, v.start]), [["Stop counting.", 3.5]]);
  const moved = buildCut(board(b, a));
  assert.equal(moved.voices[0]!.start, 0.5);
});

test("a line not spoken yet, or on a shot with nothing to show, is left out of the cut", () => {
  const unspoken = shot({ seconds: 2, render: image(), voices: [{ id: "v", text: "Be brave.", speaker: "VOICE", voice: "Laura (female, american)", offset: 0 }] });
  const empty = shot({ seconds: 2, voices: [{ id: "w", url: "/api/local/w.mp3", text: "x", speaker: "X", voice: "Laura (female, american)", offset: 0 }] });
  assert.deepEqual(buildCut(board(unspoken, empty)).voices, []);
});

test("the board's soundtrack runs under the whole cut", () => {
  const p = { ...board(shot({ seconds: 2, render: image() })), music: { url: "/api/local/score.mp3", name: "Score", gain: -4 } };
  assert.deepEqual(buildCut(p).music, { url: "/api/local/score.mp3", name: "Score", gain: -4 });
  assert.equal(buildCut(board(shot({ seconds: 2, render: image() }))).music, null);
});

test("the export script mixes voices over the clips and dips the soundtrack under them", () => {
  const p = { ...board(shot({ seconds: 2, render: image("/api/local/a.png"), voices: [{ id: "v", url: "/api/local/v.mp3", text: "Hi", speaker: "A", voice: "Laura (female, american)", offset: 0.25 }] })), music: { url: "/api/local/score.mp3", name: "Score", gain: -6 } };
  const script = ffmpegScript(buildCut(p), "Sizzle", "http://localhost:3111");
  assert.match(script, /curl -fsSL 'http:\/\/localhost:3111\/api\/local\/a\.png'/, "local media is fetched from the app");
  assert.match(script, /adelay=250\|250/);
  assert.match(script, /sidechaincompress/);
  assert.match(script, /volume=-6dB/);
});

test("a shot's caption rides on its clip", () => {
  const cut = buildCut(board(shot({ render: video(), caption: "WHAT IF" }), shot({ render: video() })));
  assert.equal(cut.clips[0]!.caption, "WHAT IF");
  assert.equal(cut.clips[1]!.caption, undefined);
});

test("captions become overlays timed to their clips", async () => {
  const { captionFilter } = await import("./cut");
  const cut = buildCut(board(shot({ render: video(), seconds: 2 }), shot({ render: video(), seconds: 3, caption: "HELLO" })));
  const f = captionFilter(cut)!;
  assert.equal(f.captions.length, 1);
  assert.equal(f.captions[0]!.text, "HELLO");
  assert.match(f.filter, /overlay=0:0:enable='between\(t,2,5\)'/);
  assert.equal(captionFilter(buildCut(board(shot({ render: video() })))), null);
});

test("the voice treatment shapes each line and the master", async () => {
  const { mixFilter, BLEND } = await import("./cut");
  const base = { ...buildCut(board(shot({ render: video(), voices: [{ id: "a", text: "hi", speaker: "X", voice: "v", offset: 0, url: "/api/local/a.mp3" } as never] }))), music: { url: "/api/local/m.wav", name: "m", gain: -3 } };
  const plain = mixFilter(base)!.filter;
  assert.doesNotMatch(plain, /aecho|acompressor|loudnorm|equalizer/);
  const tuned = mixFilter({ ...base, sound: { ...BLEND, loud: true } })!.filter;
  assert.match(tuned, /equalizer=f=200/);
  assert.match(tuned, /acompressor/);
  assert.match(tuned, /aecho/);
  assert.match(tuned, /sidechaincompress=threshold=0\.04:ratio=\d+/);
  assert.match(tuned, /loudnorm=I=-16/);
  assert.match(tuned, /\[mix\]$/);
});

test("a deeper duck presses the soundtrack harder under the voice", async () => {
  const { mixFilter } = await import("./cut");
  const base = { ...buildCut(board(shot({ render: video(), voices: [{ id: "a", text: "hi", speaker: "X", voice: "v", offset: 0, url: "/api/local/a.mp3" } as never] }))), music: { url: "/api/local/m.wav", name: "m", gain: 0 } };
  const ratio = (duck: number) => Number(/ratio=(\d+)/.exec(mixFilter({ ...base, sound: { duck } })!.filter)![1]);
  assert.ok(ratio(1) > ratio(0.1));
  const none = mixFilter({ ...base, sound: { duck: 0 } })!.filter;
  assert.doesNotMatch(none, /sidechaincompress/);
});

test("sound effects are their own track: placed on the cut's clock, with their own level, between the voices and the music", async () => {
  const { mixFilter } = await import("./cut");
  const base = { ...buildCut(board(shot({ render: video(), voices: [{ id: "a", text: "hi", speaker: "X", voice: "v", offset: 0, url: "/api/local/v.mp3" } as never] }))), music: { url: "/api/local/m.wav", name: "m", gain: -3 } };
  const cut = { ...base, effects: [{ id: "e1", name: "door", url: "/api/local/door.mp3", start: 2.5, gain: -6, seconds: 1 }, { id: "e2", name: "thunder", url: "/api/local/thunder.mp3", start: 4, gain: 0, seconds: 3 }] };
  const m = mixFilter(cut)!;
  assert.deepEqual(m.inputs, ["/api/local/v.mp3", "/api/local/door.mp3", "/api/local/thunder.mp3", "/api/local/m.wav"]);
  assert.match(m.filter, /\[2:a\]aresample=48000,adelay=2500\|2500,volume=-6dB\[fx0\]/);
  assert.match(m.filter, /\[fx0\]\[fx1\]amix=inputs=2:normalize=0\[fx\]/);
  assert.match(m.filter, /\[0:a\].*\[fx\]amix=inputs=\d/);
  assert.ok(mixFilter({ ...base, effects: [] })!.inputs.length === 2);
});

test("each track has its own level and mute", async () => {
  const { mixFilter } = await import("./cut");
  const v = { id: "a", text: "hi", speaker: "X", voice: "v", offset: 0, url: "/api/local/v.mp3" } as never;
  const withAll = { ...buildCut(board(shot({ render: video(), voices: [v] }))), music: { url: "/api/local/m.wav", name: "m", gain: 0 }, effects: [{ id: "e", name: "e", url: "/api/local/e.mp3", start: 0, gain: 0, seconds: 1 }] };
  const quiet = mixFilter({ ...withAll, sound: { voiceGain: -4, fxGain: -3 } })!.filter;
  assert.match(quiet, /volume=-4dB\[v0\]/);
  assert.match(quiet, /volume=-3dB\[fx0\]/);
  assert.deepEqual(mixFilter({ ...withAll, sound: { voiceMute: true } })!.inputs, ["/api/local/e.mp3", "/api/local/m.wav"]);
  assert.deepEqual(mixFilter({ ...withAll, sound: { fxMute: true } })!.inputs, ["/api/local/v.mp3", "/api/local/m.wav"]);
  assert.deepEqual(mixFilter({ ...withAll, sound: { musicMute: true } })!.inputs, ["/api/local/v.mp3", "/api/local/e.mp3"]);
  assert.equal(mixFilter({ ...withAll, sound: { voiceMute: true, fxMute: true, musicMute: true } }), null);
});

test("the video track's own sound has a level and a mute too", async () => {
  const { mixFilter } = await import("./cut");
  const base = { ...buildCut(board(shot({ render: video() }))), music: { url: "/api/local/m.wav", name: "m", gain: 0 } };
  assert.match(mixFilter({ ...base, sound: { clipGain: -9 } })!.filter, /\[0:a\]volume=-9dB\[clip\]/);
  assert.match(mixFilter({ ...base, sound: { clipMute: true } })!.filter, /\[0:a\]volume=0\[clip\]/);
  assert.doesNotMatch(mixFilter(base)!.filter, /\[clip\]/);
});

test("a clip's fades are a dip from and to black, and a matching rise and fall in its own sound", async () => {
  const { fadeFilters } = await import("./cut");
  assert.deepEqual(fadeFilters({ seconds: 4 } as never), { v: "", a: "" });
  const f = fadeFilters({ seconds: 4, fadeIn: 0.5, fadeOut: 1 } as never);
  assert.equal(f.v, "fade=t=in:st=0:d=0.5,fade=t=out:st=3:d=1");
  assert.equal(f.a, "afade=t=in:st=0:d=0.5,afade=t=out:st=3:d=1");
  const long = fadeFilters({ seconds: 1, fadeIn: 2, fadeOut: 2 } as never);
  assert.match(long.v, /d=0\.5/, "fades never run longer than half the clip");
});

test("fades ride from the shot to its clip", () => {
  const cut = buildCut(board(shot({ render: video(), fadeIn: 0.4, fadeOut: 0.8 }), shot({ render: video() })));
  assert.equal(cut.clips[0]!.fadeIn, 0.4);
  assert.equal(cut.clips[0]!.fadeOut, 0.8);
  assert.equal(cut.clips[1]!.fadeIn, undefined);
});

test("titles over the picture are scaled to the frame and shown only between their times", async () => {
  const { overlayFilter } = await import("./cut");
  assert.equal(overlayFilter({ overlays: [], aspect: "16:9" } as never), null);
  const f = overlayFilter({ aspect: "16:9", overlays: [{ id: "a", name: "t", url: "/api/local/a.png", start: 1, seconds: 2 }, { id: "b", name: "u", url: "/api/local/b.png", start: 5, seconds: 1.5 }] } as never)!;
  assert.deepEqual(f.inputs, ["/api/local/a.png", "/api/local/b.png"]);
  assert.match(f.filter, /\[1:v\]scale=1920:1080\[t0\]/);
  assert.match(f.filter, /\[0:v\]\[t0\]overlay=0:0:enable='between\(t,1,3\)'\[o0\]/);
  assert.match(f.filter, /\[o0\]\[t1\]overlay=0:0:enable='between\(t,5,6.5\)'\[out\]/);
});

test("overlays ride along in the cut", () => {
  const p = { ...board(shot({ render: video() })), overlays: [{ id: "a", name: "t", url: "/api/local/a.png", start: 0, seconds: 1 }] };
  assert.equal(buildCut(p as never).overlays?.length, 1);
});

test("fill crops to the frame around the focal point; fit (the default) letterboxes", async () => {
  const { normFilter } = await import("./cut");
  assert.match(normFilter("16:9"), /force_original_aspect_ratio=decrease,pad=1920:1080/);
  const fill = normFilter("16:9", { fit: "fill", focus: { x: 0.25, y: 0.5 } });
  assert.match(fill, /force_original_aspect_ratio=increase,crop=1920:1080:\(iw-ow\)\*0\.25:\(ih-ow\)\*0\.5|force_original_aspect_ratio=increase,crop=1920:1080:\(iw-ow\)\*0\.25:\(ih-oh\)\*0\.5/);
  assert.match(normFilter("9:16", { fit: "fill" }), /crop=1080:1920:\(iw-ow\)\*0\.5:\(ih-oh\)\*0\.5/);
  assert.match(normFilter("16:9", { fit: "fill", focus: { x: 9, y: -2 } }), /\*1:\(ih-oh\)\*0[,:]/, "the focal point is kept inside the picture");
});

test("framing and fades ride from the shot to the clip, the script and the render share one filter", async () => {
  const { clipFilters, ffmpegScript } = await import("./cut");
  const cut = buildCut(board(shot({ render: video(), fit: "fill", focus: { x: 0.2, y: 0.4 }, fadeOut: 1 })));
  assert.equal(cut.clips[0]!.fit, "fill");
  assert.deepEqual(cut.clips[0]!.focus, { x: 0.2, y: 0.4 });
  const f = clipFilters(cut.aspect, cut.clips[0]!);
  assert.match(f.v, /crop=.*fade=t=out/);
  assert.match(f.a, /afade=t=out/);
  assert.match(ffmpegScript(cut, "x"), /crop=1920:1080/);
});

test("a caption can start later in its shot and last a set time, and defaults to the whole shot", async () => {
  const { captionSpan } = await import("./cut");
  const cut = buildCut(board(shot({ render: video(), seconds: 2 }), shot({ render: video(), seconds: 4, caption: "A" }), shot({ render: video(), seconds: 4, caption: "B", captionAt: 1, captionFor: 1.5 }), shot({ render: video(), seconds: 2, caption: "C", captionAt: 1, captionFor: 9 })));
  assert.deepEqual(captionSpan(cut.clips[1]!), { start: 2, end: 6 });
  assert.deepEqual(captionSpan(cut.clips[2]!), { start: 7, end: 8.5 });
  assert.deepEqual(captionSpan(cut.clips[3]!), { start: 11, end: 12 }, "never runs past its shot");
});

test("the burn-in overlay follows the caption's own timing", async () => {
  const { captionFilter } = await import("./cut");
  const cut = buildCut(board(shot({ render: video(), seconds: 4, caption: "B", captionAt: 1, captionFor: 1.5 })));
  assert.match(captionFilter(cut)!.filter, /between\(t,1,2\.5\)/);
});

test("captions export as a subtitle file anyone can edit, in cut time", async () => {
  const { captionsSrt } = await import("./cut");
  const cut = buildCut(board(shot({ render: video(), seconds: 2 }), shot({ render: video(), seconds: 3.5, caption: "Marlow has a plan." })));
  assert.equal(captionsSrt(cut), "1\n00:00:02,000 --> 00:00:05,500\nMarlow has a plan.\n");
  assert.equal(captionsSrt(buildCut(board(shot({ render: video() })))), "");
});
