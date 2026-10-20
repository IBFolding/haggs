import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { fromV1Board, guessMove, type V1Board } from "./import-v1";
import { parseScreenplay } from "./screenplay";
import { buildSheets } from "./sheets";

const sample = readFileSync(new URL("./fixtures/sheets-sample.md", import.meta.url), "utf8");
const cam = (over = {}) => ({ size: "Wide", angle: "Eye level unless the shot explicitly specifies low", lens: "65mm", movement: "Locked; she backs screen-right", blocking: "Maya at the dock edge", ...over });
const v1: V1Board = {
  title: "Lantern · v1",
  logline: "A reel",
  format: "16:9",
  shots: [
    { name: "Waiting", seconds: 2, visual: "Maya waits on the dock.", prompt: "p", dialogue: "", sound: "Water.", references: [], camera: cam(), continuity: "Maya19.", source: "Episode 2, lines 11–30", beat: "01 · She waits" },
    { name: "He runs", seconds: 3, visual: "Otto runs down the bank.", prompt: "p", dialogue: "OTTO: Dawn is a range!", sound: "", references: [], camera: cam({ size: "Medium two-shot", movement: "Slow push in", lens: "no lens" }), continuity: "", source: "Episode 2, lines 11–30", beat: "01 · She waits" },
    { name: "Cabin", seconds: 5, visual: "They sit facing each other.", prompt: "p", dialogue: "", sound: "", references: [], camera: cam({ movement: "Handheld, close" }), continuity: "", source: "Episode 2, lines 31–43", beat: "02 · Facing each other" },
  ],
};

test("a v1 storyboard becomes beats and shots on the sheets, keeping every camera note", () => {
  const sheets = fromV1Board(buildSheets([parseScreenplay(sample)], { title: "Lantern", seconds: 10 }), v1);
  assert.deepEqual(sheets.story.map((b) => [b.title, b.sceneIds]), [["She waits", ["e2-s1"]], ["Facing each other", ["e2-s2"]]]);
  assert.equal(sheets.story[0]?.source, "Ep 2, lines 11–30");
  const [a, b, c] = sheets.shots;
  assert.ok(a && b && c);
  assert.deepEqual([a.seconds, a.size, a.angle, a.lens, a.move, a.blocking, a.action, a.sound], [2, "Wide", "Eye level", "65mm", "static", "Maya at the dock edge", "Maya waits on the dock.", "Water."]);
  assert.match(a.note, /Locked; she backs screen-right/);
  assert.match(a.note, /Maya19\./);
  assert.match(a.note, /Eye level unless/);
  assert.deepEqual([b.size, b.lens, b.move, b.dialogue], ["Medium two-shot", "", "dolly-in", "OTTO: Dawn is a range!"]);
  assert.equal(c.move, "handheld");
  assert.equal(c.sceneId, "e2-s2");
  assert.deepEqual(a.characters, ["MAYA", "OTTO"]);
});

test("a v1 shot whose source is outside the uploaded scripts is refused by name", () => {
  const bad = { ...v1, shots: [{ ...v1.shots[0]!, source: "Episode 9, lines 1–5" }] };
  assert.throws(() => fromV1Board(buildSheets([parseScreenplay(sample)]), bad), /Waiting.*Episode 9/);
});

test("camera movement notes map to the nearest named move, or none", () => {
  assert.equal(guessMove("Locked at waist height"), "static");
  assert.equal(guessMove("Slow push in to her eyes"), "dolly-in");
  assert.equal(guessMove("Pull back to reveal the hill"), "dolly-out");
  assert.equal(guessMove("Crane up over the town"), "crane-up");
  assert.equal(guessMove("Rack focus to the ring"), "focus-change");
  assert.equal(guessMove("Slow pan right"), "pan-right");
  assert.equal(guessMove("Small lateral settle into shared frame"), "");
});

test("media attaches to shots by number, and each shot shows its best footage that is not rejected", async () => {
  const { attachMedia } = await import("./import-v1");
  const { createProject } = await import("../story/model");
  const { syncBoard } = await import("./sheets");
  const sheets = fromV1Board(buildSheets([parseScreenplay(sample)], { title: "Lantern", seconds: 10 }), v1);
  const project = syncBoard(createProject("Lantern"), sheets).project;
  const out = attachMedia(project, [
    { url: "/a1.png", kind: "image", name: "A still", origin: "v1 stills", status: "review", note: "", shot: 1 },
    { url: "/a1.mp4", kind: "video", name: "A take", origin: "v1 takes", status: "review", note: "", shot: 1, seconds: 5.2 },
    { url: "/b.mp4", kind: "video", name: "B take", origin: "v1 takes", status: "rejected", note: "wrong eyeline", shot: 2 },
    { url: "/b.png", kind: "image", name: "B still", origin: "v1 stills", status: "review", note: "", shot: 2 },
    { url: "/cut.mp4", kind: "video", name: "Opening", origin: "v1 cuts", status: "reference", note: "" },
  ]);
  const [one, two, three] = out.shots;
  assert.equal(out.media?.length, 5);
  assert.equal(one?.render?.url, "/a1.mp4", "video wins over a still");
  assert.equal(two?.render?.url, "/b.png", "a rejected take is never put on the shot");
  assert.equal(three?.render, undefined);
  assert.equal(one?.render?.usd, null);
  assert.equal(out.media?.[4]?.shotId, undefined);
  assert.equal(out.media?.[0]?.shotId, one?.id);
  assert.throws(() => attachMedia(project, [{ url: "/x", kind: "image", name: "x", origin: "o", status: "review", note: "", shot: 9 }]), /shot 9/);
});
