import assert from "node:assert/strict";
import { test } from "node:test";

import { addBoard, boardOf, commit, normalize, removeBoard, renameBoard, view } from "./boards";
import { createProject, summarize, type Project, type Shot } from "./model";

const shot = (id: string): Shot => ({ id, heading: id, beat: "", threadIds: [], seconds: 2, model: { id: "m", settings: {} } });
const legacy = (): Project => ({ ...createProject("Old"), shots: [shot("a"), shot("b")], notes: [{ id: "n", text: "x", x: 0, y: 0 }] });

test("a project from before boards becomes one board called Main, with nothing lost", () => {
  const p = normalize(legacy());
  assert.equal(p.boards?.length, 1);
  assert.equal(p.boards?.[0]?.name, "Main");
  assert.deepEqual(p.boards?.[0]?.shots.map((s) => s.id), ["a", "b"]);
  assert.equal(p.boards?.[0]?.notes.length, 1);
  assert.deepEqual(p.shots, [], "shots live on boards only, so there is one source of truth");
  assert.deepEqual(normalize(p), p, "normalising twice changes nothing");
});

test("a new project starts with one empty board", () => {
  const p = normalize(createProject("New"));
  assert.equal(p.boards?.length, 1);
  assert.deepEqual(p.boards?.[0]?.shots, []);
});

test("a view is the project as one board sees it, and commit writes it back to that board only", () => {
  let p = normalize(legacy());
  const made = addBoard(p, "Episode 1", "episode");
  p = made.project;
  assert.equal(p.boards?.length, 2);
  const ep = view(p, made.board.id);
  assert.deepEqual(ep.shots, []);
  const changed = commit(p, made.board.id, { ...ep, shots: [shot("c")], threads: [{ id: "t", name: "MAYA", color: "#fff", kind: "character" }] });
  assert.deepEqual(boardOf(changed, made.board.id).shots.map((s) => s.id), ["c"]);
  assert.deepEqual(boardOf(changed).shots.map((s) => s.id), ["a", "b"], "the first board is untouched");
  assert.equal(changed.threads.length, 1, "characters are shared across boards");
  assert.deepEqual(changed.shots, []);
  assert.deepEqual(view(changed, "nope").shots.map((s) => s.id), ["a", "b"], "an unknown board falls back to the first");
});

test("boards can be renamed and removed, but never the last one", () => {
  let p = addBoard(normalize(legacy()), "Sizzle", "reel").project;
  const second = p.boards![1]!.id;
  p = renameBoard(p, second, "Sizzle — The Life Between");
  assert.equal(boardOf(p, second).name, "Sizzle — The Life Between");
  p = removeBoard(p, second);
  assert.equal(p.boards?.length, 1);
  assert.throws(() => removeBoard(p, p.boards![0]!.id), /last board/);
  assert.throws(() => addBoard(p, "  ", "board"), /name/);
});

test("the library counts shots across every board", () => {
  let p = normalize(legacy());
  const made = addBoard(p, "Ep 1", "episode");
  p = commit(made.project, made.board.id, { ...view(made.project, made.board.id), shots: [shot("c")] });
  assert.equal(summarize(p).shotCount, 3);
  assert.equal(summarize(p).boardCount, 2);
});

test("each board keeps its own soundtrack through a view and a commit", () => {
  const p: Project = { ...createProject("W"), boards: [
    { id: "a", name: "Sizzle", kind: "reel", shots: [], notes: [], music: { url: "/api/local/score.mp3", name: "Score", gain: -6 } },
    { id: "b", name: "Ep 1", kind: "episode", shots: [], notes: [] },
  ] };
  assert.equal(view(p, "a").music?.name, "Score");
  assert.equal(view(p, "b").music, undefined);
  const seen = { ...view(p, "b"), music: { url: "/api/local/ep1.mp3", name: "Ep 1 theme", gain: 0 } };
  const back = commit(p, "b", seen);
  assert.equal(back.boards![1]!.music?.name, "Ep 1 theme");
  assert.equal(back.boards![0]!.music?.name, "Score");
  assert.equal(back.music, undefined, "the soundtrack lives on the board, not the project");
});
