import assert from "node:assert/strict";
import { test } from "node:test";

import { assemble, hashPrompt, promptFor, staleShots } from "./assemble";
import { createProject, moveShot, newShot, type Project, type Shot } from "./model";

const DIRECTION = {
  camera: "35mm, handheld",
  light: "amber practicals against indigo",
  staging: "wet asphalt, reflections",
  constants: "one continuous rainy night",
};

function board(...beats: string[]): Project {
  const project = createProject("Light Again");
  return {
    ...project,
    direction: DIRECTION,
    shots: beats.map((beat, i) => ({ ...newShot(), id: `s${i}`, heading: `SHOT ${i}`, beat })),
  };
}

test("a shot's prompt carries its own beat", () => {
  const prompt = assemble(board("she turns").shots[0]!, undefined, DIRECTION);
  assert.match(prompt, /she turns/);
});

test("the craft direction is in every prompt", () => {
  const prompt = assemble(board("she turns").shots[0]!, undefined, DIRECTION);
  assert.match(prompt, /35mm, handheld/);
  assert.match(prompt, /one continuous rainy night/);
});

test("the opening shot says it opens, rather than citing a predecessor", () => {
  const prompt = assemble(board("she turns").shots[0]!, undefined, DIRECTION);
  assert.equal(/Continues from/.test(prompt), false);
});

test("a later shot continues from the one before it", () => {
  const b = board("she turns", "she runs");
  const prompt = assemble(b.shots[1]!, b.shots[0]!, DIRECTION);
  assert.match(prompt, /Continues from/);
  assert.match(prompt, /she turns/);
});

test("a shot's own direction overrides the project's", () => {
  const b = board("she turns");
  const shot: Shot = { ...b.shots[0]!, direction: { camera: "85mm macro" } };
  const prompt = assemble(shot, undefined, DIRECTION);
  assert.match(prompt, /85mm macro/);
  assert.equal(/35mm, handheld/.test(prompt), false);
});

test("assemble is pure — same input, same prompt", () => {
  const b = board("she turns", "she runs");
  assert.equal(assemble(b.shots[1]!, b.shots[0]!, DIRECTION), assemble(b.shots[1]!, b.shots[0]!, DIRECTION));
});

test("moveShot reorders without losing a shot", () => {
  const b = board("a", "b", "c");
  const moved = moveShot(b.shots, 2, 0);
  assert.deepEqual(moved.map((s) => s.beat), ["c", "a", "b"]);
  assert.equal(moved.length, 3);
});

test("moveShot leaves the array alone when the index does not move", () => {
  const b = board("a", "b");
  assert.deepEqual(moveShot(b.shots, 1, 1).map((s) => s.beat), ["a", "b"]);
});

// This is the whole point of the board: move a shot and the prompts that
// depended on its position are genuinely different, not just renumbered.
test("reordering changes the prompt of the shot whose predecessor changed", () => {
  const b = board("a", "b", "c");
  const before = promptFor(b, 2);
  const after = promptFor({ ...b, shots: moveShot(b.shots, 0, 1) }, 2);
  assert.notEqual(before, after);
});

test("a shot is stale when its render came from a different prompt", () => {
  const b = board("a", "b");
  const withRender: Project = {
    ...b,
    shots: [
      b.shots[0]!,
      { ...b.shots[1]!, render: { url: "u", kind: "image", usd: 0.01, promptHash: "stale", at: 1 } },
    ],
  };
  assert.deepEqual(staleShots(withRender), ["s1"]);
});

test("a shot whose render matches its prompt is not stale", () => {
  const b = board("a", "b");
  const fresh: Project = {
    ...b,
    shots: [
      b.shots[0]!,
      {
        ...b.shots[1]!,
        render: { url: "u", kind: "image", usd: 0.01, promptHash: hashPrompt(promptFor(b, 1)), at: 1 },
      },
    ],
  };
  assert.deepEqual(staleShots(fresh), []);
});

test("a shot with no render is never stale", () => {
  assert.deepEqual(staleShots(board("a", "b")), []);
});

// Locking is the escape hatch that stops the recompute rule being tyrannical.
test("a locked shot never goes stale", () => {
  const b = board("a", "b");
  const locked: Project = {
    ...b,
    shots: [
      b.shots[0]!,
      { ...b.shots[1]!, locked: true, render: { url: "u", kind: "image", usd: 0, promptHash: "old", at: 1 } },
    ],
  };
  assert.deepEqual(staleShots(locked), []);
});

test("the same prompt always hashes the same, a different one does not", () => {
  assert.equal(hashPrompt("abc"), hashPrompt("abc"));
  assert.notEqual(hashPrompt("abc"), hashPrompt("abd"));
});

test("a shot's look goes into its prompt as plain words, and an empty look changes nothing", () => {
  const project = board("She runs");
  const before = promptFor(project, 0);
  assert.equal(promptFor({ ...project, shots: [{ ...project.shots[0]!, look: {} }] }, 0), before);
  const looked = promptFor({ ...project, shots: [{ ...project.shots[0]!, look: { framing: "close-up", move: "push-in", grade: "teal-orange" } }] }, 0);
  assert.match(looked, /close-up on the face/i);
  assert.match(looked, /push in/i);
  assert.match(looked, /teal and orange/i);
  for (const line of before.split("\n")) assert.ok(looked.includes(line), line);
});
