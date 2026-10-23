import assert from "node:assert/strict";
import { test } from "node:test";

import { animatePlan, readyToAnimate } from "./animate-all";
import { createProject, newShot, type Project, type Shot } from "./model";

const pic = (url: string) => ({ url, kind: "image" as const, usd: null, promptHash: "h", at: 1 });
const vid = { url: "/a.mp4", kind: "video" as const, usd: 0.5, promptHash: "h", at: 1 };

function board(shots: Shot[]): Project {
  return { ...createProject("W"), shots };
}

test("the plan is every shot showing a still, at its own length, with a total", () => {
  const p = board([
    { ...newShot(), id: "a", beat: "Rowan laughs", seconds: 3, render: pic("/n1.png") },
    { ...newShot(), id: "b", beat: "Already moving", seconds: 4, render: vid },
    { ...newShot(), id: "c", beat: "Comet Hill", seconds: 6, render: pic("/n4.png") },
    { ...newShot(), id: "d", beat: "Nothing yet", seconds: 3 },
  ]);
  const plan = animatePlan(p);
  assert.deepEqual(plan.shots.map((s) => [s.id, s.seconds]), [["a", 4], ["c", 6]]);
  assert.equal(plan.shots[0]!.usd, 0.515);
  assert.equal(plan.total, Math.round((0.515 + 0.772) * 1000) / 1000);
});

test("locked shots, like title cards, are left out", () => {
  const p = board([{ ...newShot(), id: "card", beat: "Card: WAYLIGHT", seconds: 4, render: pic("/title.png"), locked: true }]);
  assert.equal(animatePlan(p).shots.length, 0);
});

test("a shot made ready to animate runs on MiniMax H3 from its still, keeping everything else", () => {
  const shot: Shot = { ...newShot(), beat: "x", seconds: 3, render: pic("/n1.png"), refs: ["/face.png"] };
  const ready = readyToAnimate(shot);
  assert.equal(ready.model.id, "minimax/minimax-h3");
  assert.equal(ready.render!.url, "/n1.png");
  assert.deepEqual(ready.refs, ["/face.png"]);
  assert.equal(ready.seconds, 3);
});

test("the picture plan is every unlocked shot with a description and nothing to show, priced per still", async () => {
  const { picturePlan } = await import("./animate-all");
  const p = board([
    { ...newShot(), id: "a", beat: "A giant glowing belly in a neon city", seconds: 4 },
    { ...newShot(), id: "b", beat: "Already has one", seconds: 4, render: pic("/x.png") },
    { ...newShot(), id: "c", beat: "", seconds: 4 },
    { ...newShot(), id: "d", beat: "Kept as it is", seconds: 4, locked: true },
  ]);
  const plan = picturePlan(p);
  assert.deepEqual(plan.shots.map((s) => s.id), ["a"]);
  assert.equal(plan.shots[0]!.usd, 0.0686);
  assert.equal(plan.total, 0.0686);
});
