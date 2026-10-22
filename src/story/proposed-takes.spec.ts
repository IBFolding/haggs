import assert from "node:assert/strict";
import { test } from "node:test";

import { staleShots } from "./assemble";
import { view } from "./boards";
import { createProject, newShot, type Project } from "./model";
import { applyTakes, validateTakes } from "./proposed-takes";

function project(): Project {
  const still = { url: "/api/local/still.png", kind: "image" as const, usd: null, promptHash: "x", at: 1 };
  const shot = { ...newShot(), beat: "Rowan laughs", seconds: 3, render: still, takes: [{ id: "take-first", ...still }] };
  return { ...createProject("W"), boards: [{ id: "b1", name: "Sizzle", kind: "reel", shots: [shot, newShot()], notes: [] }, { id: "b2", name: "Other", kind: "board", shots: [], notes: [] }] };
}

test("a sent take joins the shot's takes and goes on the shot, keeping the still", () => {
  const p = project();
  const id = p.boards![0]!.shots[0]!.id;
  const { project: next, added } = applyTakes(p, validateTakes({ board: "b1", takes: [{ shot: id, url: "/api/local/takes/shot11.mp4", kind: "video", origin: "MiniMax H3", usd: 0.51 }] }));
  const shot = next.boards![0]!.shots[0]!;
  assert.equal(added, 1);
  assert.equal(shot.takes!.length, 2);
  assert.equal(shot.render!.url, "/api/local/takes/shot11.mp4");
  assert.equal(shot.takes![1]!.usd, 0.51);
  assert.equal(shot.takes![1]!.origin, "MiniMax H3");
  assert.deepEqual(staleShots(view(next, "b1")).filter((s) => s === id), []);
});

test("use: false keeps what the shot shows and only shelves the take", () => {
  const p = project();
  const id = p.boards![0]!.shots[0]!.id;
  const shot = applyTakes(p, validateTakes({ board: "b1", takes: [{ shot: id, url: "/api/local/t.mp4", kind: "video", use: false }] })).project.boards![0]!.shots[0]!;
  assert.equal(shot.render!.url, "/api/local/still.png");
  assert.equal(shot.takes!.length, 2);
});

test("the same file twice is one take", () => {
  const p = project();
  const id = p.boards![0]!.shots[0]!.id;
  const once = applyTakes(p, validateTakes({ board: "b1", takes: [{ shot: id, url: "/api/local/t.mp4", kind: "video" }] })).project;
  const twice = applyTakes(once, validateTakes({ board: "b1", takes: [{ shot: id, url: "/api/local/t.mp4", kind: "video" }] }));
  assert.equal(twice.added, 0);
  assert.equal(twice.project.boards![0]!.shots[0]!.takes!.length, 2);
});

test("takes for a missing board or shot, or from off this machine, are refused", () => {
  const p = project();
  assert.throws(() => applyTakes(p, validateTakes({ board: "nope", takes: [{ shot: "s", url: "/api/local/t.mp4", kind: "video" }] })), /board/);
  assert.throws(() => applyTakes(p, validateTakes({ board: "b1", takes: [{ shot: "nope", url: "/api/local/t.mp4", kind: "video" }] })), /no shot/);
  assert.throws(() => validateTakes({ board: "b1", takes: [{ shot: "s", url: "file:///etc/passwd", kind: "video" }] }), /Take 1 must be/);
  assert.throws(() => validateTakes({ board: "b1", takes: [] }), /1–100/);
});

test("sent voice lines land on their shots, spoken, and the same file twice is one line", async () => {
  const { applyVoices, validateVoices } = await import("./proposed-takes");
  const p = project();
  const id = p.boards![0]!.shots[0]!.id;
  const sent = validateVoices({ board: "b1", lines: [{ shot: id, speaker: "ellis", text: "Stop counting.", voice: "Chris (male, american)", url: "/api/local/v/stop.mp3", offset: 0.5 }] });
  const once = applyVoices(p, sent);
  assert.equal(once.added, 1);
  const line = once.project.boards![0]!.shots[0]!.voices![0]!;
  assert.equal(line.speaker, "ELLIS");
  assert.equal(line.url, "/api/local/v/stop.mp3");
  assert.equal(applyVoices(once.project, sent).added, 0);
  assert.throws(() => validateVoices({ board: "b1", lines: [{ shot: id, speaker: "X", text: "hi", voice: "v", url: "https://evil.test/x.mp3" }] }), /line 1/i);
  assert.throws(() => applyVoices(p, validateVoices({ board: "b1", lines: [{ shot: "nope", speaker: "X", text: "hi", voice: "v", url: "/api/local/a.mp3" }] })), /no shot/);
});
