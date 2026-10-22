import assert from "node:assert/strict";
import { test } from "node:test";

import { bridgeFrames, bridgingShot } from "./bridge";
import { createProject, newShot, type Project, type Shot } from "./model";

const vid = (url: string) => ({ url, kind: "video" as const, usd: 0.5, promptHash: "h", at: 1 });
const pic = (url: string) => ({ url, kind: "image" as const, usd: null, promptHash: "h", at: 1 });

function p(...shots: Shot[]): Project {
  return { ...createProject("W"), shots };
}

test("a bridge takes the last frame you see of one shot and the first frame you see of the next", () => {
  const a = { ...newShot(), id: "a", beat: "Rowan at the fence", seconds: 3, trimIn: 1, render: vid("/a.mp4") };
  const b = { ...newShot(), id: "b", beat: "Mother's kitchen", seconds: 3, trimIn: 0.5, render: vid("/b.mp4") };
  const f = bridgeFrames(p(a, b), "a", "bridge");
  assert.deepEqual(f.start, { url: "/a.mp4", kind: "video", at: 3.95 });
  assert.deepEqual(f.end, { url: "/b.mp4", kind: "video", at: 0.5 });
  assert.equal(f.insertAt, 1);
});

test("a still is its own first and last frame; extending needs no next shot", () => {
  const a = { ...newShot(), id: "a", beat: "Comet Hill", seconds: 2, render: pic("/n4.png") };
  const f = bridgeFrames(p(a), "a", "extend");
  assert.deepEqual(f.start, { url: "/n4.png", kind: "image", at: 0 });
  assert.equal(f.end, null);
  assert.throws(() => bridgeFrames(p(a), "a", "bridge"), /no shot after/);
  assert.throws(() => bridgeFrames(p({ ...newShot(), id: "x" }), "x", "extend"), /nothing to show/);
});

test("the new shot starts on the first frame, ends on the second, runs on MiniMax and sits in the same lanes", () => {
  const a = { ...newShot(), id: "a", beat: "Rowan at the fence", threadIds: ["t1"] };
  const s = bridgingShot(a, { url: "/frames/a-last.png" }, { url: "/frames/b-first.png" }, "Mother's kitchen");
  assert.equal(s.render!.url, "/frames/a-last.png");
  assert.equal(s.render!.kind, "image");
  assert.equal(s.endsOn, "/frames/b-first.png");
  assert.equal(s.model.id, "minimax/minimax-h3");
  assert.equal(s.seconds, 4);
  assert.deepEqual(s.threadIds, ["t1"]);
  assert.match(s.beat, /Rowan at the fence.*Mother's kitchen/);
  const e = bridgingShot(a, { url: "/frames/a-last.png" }, null);
  assert.equal(e.endsOn, undefined);
  assert.match(e.beat, /continues/);
});
