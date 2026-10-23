import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCut } from "../story/cut";
import { createProject, newShot } from "../story/model";
import { renderCut } from "./render";

const r = (url: string, kind: "image" | "video") => ({ url, kind, usd: null, promptHash: "", at: 1 });

function sizzle() {
  return { ...createProject("Sizzle v2"), music: { url: "/api/local/score.mp3", name: "Score", gain: -8 }, shots: [
    { ...newShot(), heading: "a", seconds: 2, render: r("/api/local/stills/N1.png", "image") },
    { ...newShot(), heading: "b", seconds: 3, trimIn: 1, render: r("/api/local/takes/shot07.mp4", "video"), voices: [{ id: "v", text: "x", speaker: "R", voice: "Sarah (female, american)", url: "/api/local/v.mp3", offset: 0.5 }] },
  ] };
}

test("a render normalises each clip, joins them, mixes the sound and keeps the film next to the media", async () => {
  const runs: string[][] = [];
  const out = await renderCut(buildCut(sizzle()), "Sizzle v2", {
    root: "/media",
    work: "/tmp/w",
    stamp: "2026-10-21-1800",
    ffmpeg: async (args) => void runs.push(args),
    hasAudio: async (path) => path.endsWith(".mp4"),
    write: async () => undefined,
  });
  assert.equal(out.url, "/api/local/haggs-renders/Sizzle-v2-2026-10-21-1800.mp4");
  assert.equal(runs.length, 4, "two clips, a join and a mix");
  assert.deepEqual(runs[0]!.slice(0, 6), ["-loglevel", "error", "-y", "-loop", "1", "-t"]);
  assert.ok(runs[0]!.includes("/media/stills/N1.png"));
  assert.ok(runs[1]!.includes("-ss") && runs[1]![runs[1]!.indexOf("-ss") + 1] === "1", "a trimmed take starts where it was trimmed");
  assert.ok(runs[2]!.includes("concat"));
  assert.ok(runs[3]!.includes("/media/score.mp3") && runs[3]!.includes("/media/v.mp3"));
  assert.ok(runs[3]!.includes("/media/haggs-renders/Sizzle-v2-2026-10-21-1800.mp4"));
});

test("only this machine's media folder is read; anything else is refused before ffmpeg runs", async () => {
  const p = sizzle();
  p.shots[0]!.render = r("https://evil.test/x.png", "image");
  const runs: string[][] = [];
  await assert.rejects(renderCut(buildCut(p), "x", { root: "/media", work: "/tmp/w", stamp: "s", ffmpeg: async (a) => void runs.push(a), hasAudio: async () => false, write: async () => undefined }), /this machine/);
  const escape = sizzle();
  escape.shots[0]!.render = r("/api/local/../../etc/passwd", "image");
  await assert.rejects(renderCut(buildCut(escape), "x", { root: "/media", work: "/tmp/w", stamp: "s", ffmpeg: async (a) => void runs.push(a), hasAudio: async () => false, write: async () => undefined }), /this machine/);
  assert.equal(runs.length, 0);
});

test("a cut from the browser is rebuilt from checked numbers and local links only", async () => {
  const { checkCut } = await import("./render");
  const good = buildCut(sizzle());
  assert.deepEqual(checkCut(JSON.parse(JSON.stringify(good))).voices, good.voices);
  assert.throws(() => checkCut({ ...good, music: { url: "/api/local/s.mp3", name: "s", gain: "0dB[x];[y]" } }), /out of range/);
  assert.throws(() => checkCut({ ...good, clips: [{ ...good.clips[0], url: "file:///etc/passwd" }] }), /this machine/);
  assert.throws(() => checkCut({ ...good, clips: [] }), /nothing/);
});

test("a vertical cut is normalised to 1080×1920, and the export script says so too", async () => {
  const { ffmpegScript } = await import("../story/cut");
  const cut = { ...buildCut(sizzle()), aspect: "9:16" as const };
  const runs: string[][] = [];
  await renderCut(cut, "V", { root: "/media", work: "/tmp/w", stamp: "s", ffmpeg: async (a) => void runs.push(a), hasAudio: async () => false, write: async () => undefined });
  assert.ok(runs[0]!.some((a) => a.includes("scale=1080:1920")));
  assert.match(ffmpegScript(cut, "V"), /scale=1080:1920/);
  const { checkCut } = await import("./render");
  assert.equal(checkCut(JSON.parse(JSON.stringify(cut))).aspect, "9:16");
  assert.equal(checkCut(JSON.parse(JSON.stringify({ ...cut, aspect: "weird" }))).aspect, "16:9");
});

test("fades go into the clip's own pass, and titles get a pass of their own before the mix", async () => {
  const p = sizzle();
  p.shots[1]!.fadeIn = 0.5;
  (p as unknown as { overlays: unknown }).overlays = [{ id: "o", name: "T", url: "/api/local/titles/t.png", start: 1, seconds: 2 }];
  const runs: string[][] = [];
  await renderCut(buildCut(p), "F", { root: "/media", work: "/tmp/w", stamp: "s", ffmpeg: async (a) => void runs.push(a), hasAudio: async (path) => path.endsWith(".mp4"), write: async () => undefined });
  assert.match(runs[1]!.join(" "), /fade=t=in:st=0:d=0\.5/);
  assert.match(runs[1]!.join(" "), /afade=t=in:st=0:d=0\.5/);
  const titlePass = runs.find((a) => a.includes("/media/titles/t.png"));
  assert.ok(titlePass, "a pass lays the title over the film");
  assert.match(titlePass!.join(" "), /enable='between\(t,1,3\)'/);
  assert.ok(runs.indexOf(titlePass!) < runs.length - 1, "the mix comes after the titles");
});

test("a cut from the browser keeps checked titles and refuses links off this machine", async () => {
  const { checkCut } = await import("./render");
  const base = buildCut(sizzle());
  const ok = checkCut({ ...base, overlays: [{ id: "o", name: "T", url: "/api/local/t.png", start: 1, seconds: 2 }] });
  assert.equal(ok.overlays?.length, 1);
  assert.throws(() => checkCut({ ...base, overlays: [{ id: "o", name: "T", url: "https://x.test/t.png", start: 1, seconds: 2 }] }), /this machine/);
});
