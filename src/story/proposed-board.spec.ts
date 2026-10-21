import assert from "node:assert/strict";
import { test } from "node:test";

import { staleShots } from "./assemble";
import { addTake } from "./takes";
import { view } from "./boards";
import { createProject, newShot, type Project } from "./model";
import { applyBoardProposal, validateBoardProposal } from "./proposed-board";

function waylight(): Project {
  const shot = addTake({ ...newShot(), beat: "Ellis checks the light", seconds: 5, sheetShotId: "row-3", refs: ["/api/local/ellis.png"] }, { url: "/api/local/a.mp4", kind: "video", usd: 0.5, promptHash: "h", at: 1 }, "MiniMax H3");
  const p = createProject("WAYLIGHT");
  return { ...p, boards: [{ id: "sizzle", name: "Sizzle", kind: "reel", shots: [shot], notes: [] }] };
}

test("a proposed board lands as a new board after the others, in order", () => {
  const p = waylight();
  const from = p.boards![0]!.shots[0]!.id;
  const raw = { name: "Sizzle v2", shots: [
    { beat: "Black. A voice.", seconds: 2, picture: { url: "/api/local/cards/black.png", kind: "image", origin: "title card" } },
    { beat: "Ellis checks the light", seconds: 2, from, dialogue: "ELLIS: It was like that." },
  ] };
  const { project, board } = applyBoardProposal(p, validateBoardProposal(raw));
  assert.equal(project.boards!.length, 2);
  assert.equal(project.boards![1]!.id, board.id);
  assert.equal(board.name, "Sizzle v2");
  assert.equal(board.shots.length, 2);
  assert.equal(board.shots[0]!.render!.url, "/api/local/cards/black.png");
  assert.equal(board.shots[0]!.takes![0]!.origin, "title card");
});

test("a reused shot keeps its takes and references but becomes its own shot", () => {
  const p = waylight();
  const source = p.boards![0]!.shots[0]!;
  const { project, board } = applyBoardProposal(p, validateBoardProposal({ name: "v2", shots: [{ beat: "Checks the light", seconds: 2, from: source.id }] }));
  const copy = board.shots[0]!;
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.takes!.length, 1);
  assert.equal(copy.render!.url, "/api/local/a.mp4");
  assert.deepEqual(copy.refs, ["/api/local/ellis.png"]);
  assert.equal(copy.seconds, 2);
  assert.equal(copy.sheetShotId, undefined, "the other board's sheet row is not this board's");
  assert.equal(project.boards![0]!.shots[0]!.seconds, 5, "the original is untouched");
});

test("dialogue rides on the beat, and pictures are not stale on arrival", () => {
  const { project, board } = applyBoardProposal(waylight(), validateBoardProposal({ name: "v2", shots: [{ beat: "Comet Hill", seconds: 4, dialogue: "ELLIS: Stop counting.", picture: { url: "/api/local/n4.png", kind: "image" } }] }));
  assert.match(board.shots[0]!.beat, /Comet Hill.*Stop counting\./);
  assert.deepEqual(staleShots(view(project, board.id)), []);
});

test("a proposal is refused when it names a shot the project doesn't have, or a picture off this machine", () => {
  assert.throws(() => applyBoardProposal(waylight(), validateBoardProposal({ name: "v2", shots: [{ beat: "x", seconds: 2, from: "nope" }] })), /no shot/);
  assert.throws(() => validateBoardProposal({ name: "v2", shots: [{ beat: "x", seconds: 2, picture: { url: "javascript:alert(1)", kind: "image" } }] }), /picture/);
  assert.throws(() => validateBoardProposal({ name: "", shots: [{ beat: "x", seconds: 2 }] }), /name/);
  assert.throws(() => validateBoardProposal({ name: "v2", shots: [] }), /1–200/);
  assert.throws(() => validateBoardProposal({ name: "v2", shots: [{ beat: "x", seconds: 0 }] }), /seconds/);
});

test("reused takes are not stale on arrival, though their old board's prompts differ", () => {
  const p = waylight();
  const from = p.boards![0]!.shots[0]!.id;
  const { project, board } = applyBoardProposal(p, validateBoardProposal({ name: "v2", shots: [{ beat: "Black", seconds: 2, picture: { url: "/api/local/black.png", kind: "image" } }, { beat: "Checks the light", seconds: 2, from }] }));
  assert.deepEqual(staleShots(view(project, board.id)), []);
  assert.equal(board.shots[1]!.render!.url, "/api/local/a.mp4");
});
