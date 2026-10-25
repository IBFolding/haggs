import assert from "node:assert/strict";
import { test } from "node:test";

import { addNote, empty, groupCards, moveCard, place } from "./workspace";
import { projectFromWorkspace, type WorkPicture } from "./workspace-project";

const pic = (id: string, over: Partial<WorkPicture> = {}): WorkPicture => ({ id, src: `/api/local/${id}.png`, kind: "image", prompt: `prompt ${id}`, usd: 0.01, at: 1, ...over });

test("each group becomes a board, and the loose pictures go on Main", () => {
  let l = place(empty(), ["a", "b", "c"]);
  l = moveCard(moveCard(moveCard(l, "a", 100, 100), "b", 360, 100), "c", 1500, 900);
  l = groupCards(l, ["a", "b"], "Opening");
  const p = projectFromWorkspace("Test", l, [pic("a"), pic("b"), pic("c")])!;
  const names = p.boards!.map((b) => b.name);
  assert.deepEqual(names, ["Opening", "Main"]);
  assert.equal(p.boards![0]!.shots.length, 2);
  assert.equal(p.boards![1]!.shots.length, 1);
  assert.equal(p.boards![0]!.shots[0]!.render!.url, "/api/local/a.png");
});

test("pictures are in reading order: left to right along a row, rows top to bottom", () => {
  let l = place(empty(), ["a", "b", "c", "d"]);
  l = moveCard(moveCard(moveCard(moveCard(l, "a", 500, 40), "b", 40, 40), "c", 40, 400), "d", 500, 405);
  const p = projectFromWorkspace("Order", l, ["a", "b", "c", "d"].map((i) => pic(i)))!;
  assert.deepEqual(p.boards![0]!.shots.map((s) => s.render!.url.split("/").pop()), ["b.png", "a.png", "c.png", "d.png"]);
});

test("reference pictures go to Media as references and are not made into shots", () => {
  const l = place(empty(), ["ref:x", "a"]);
  const p = projectFromWorkspace("Refs", l, [pic("ref:x", { reference: true }), pic("a")])!;
  assert.equal(p.boards![0]!.shots.length, 1);
  const ref = p.media!.find((m) => m.url.endsWith("ref:x.png"))!;
  assert.equal(ref.status, "reference");
  assert.equal(p.media!.find((m) => m.url.endsWith("a.png"))!.status, "approved");
});

test("every shot's picture is also listed in Media and points back at its shot", () => {
  const p = projectFromWorkspace("Media", place(empty(), ["a"]), [pic("a")])!;
  assert.equal(p.media!.length, 1);
  assert.equal(p.media![0]!.shotId, p.boards![0]!.shots[0]!.id);
});

test("notes travel with the board they sit in, relative to its frame", () => {
  let l = moveCard(place(empty(), ["a", "b"]), "a", 100, 200);
  l = moveCard(l, "b", 1600, 1000);
  l = groupCards(l, ["a"], "Look");
  const frame = l.frames[0]!;
  l = addNote(l, "warmer light", frame.x + 20, frame.y + 20);
  l = addNote(l, "loose idea", 1700, 40);
  const p = projectFromWorkspace("Notes", l, [pic("a"), pic("b")])!;
  const look = p.boards!.find((b) => b.name === "Look")!;
  const main = p.boards!.find((b) => b.name === "Main")!;
  assert.deepEqual(look.notes.map((n) => [n.text, n.x, n.y]), [["warmer light", 20, 20]]);
  assert.deepEqual(main.notes.map((n) => n.text), ["loose idea"]);
});

test("two groups with the same name become two boards with different names", () => {
  let l = moveCard(moveCard(place(empty(), ["a", "b"]), "a", 100, 100), "b", 1500, 800);
  l = groupCards(groupCards(l, ["a"], "Scene"), ["b"], "Scene");
  const names = projectFromWorkspace("Dup", l, [pic("a"), pic("b")])!.boards!.map((b) => b.name);
  assert.equal(new Set(names).size, 2);
});

test("a workspace with nothing on it does not make a project", () => {
  assert.equal(projectFromWorkspace("Empty", empty(), []), null);
});

test("a video becomes a longer shot than a still", () => {
  const p = projectFromWorkspace("Clip", place(empty(), ["v", "i"]), [pic("v", { kind: "video" }), pic("i")])!;
  const secs = p.boards![0]!.shots.map((s) => s.seconds);
  assert.ok(secs.includes(4) && secs.includes(3));
});
