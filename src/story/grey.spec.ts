import assert from "node:assert/strict";
import test from "node:test";
import { ROOM, defaultGrey, describeGrey, project, realPrompt, tidy } from "./grey";

const cam = (angle: number, extra = {}) => ({ angle, distance: 5, height: 1.5, lens: 35, ...extra });

test("a subject at the middle of the room is in the middle of the frame, from any side", () => {
  for (const a of [0, 90, 180, 270]) {
    const p = project(cam(a), { x: 0, y: 1.2, z: 0 }, 16 / 9)!;
    assert.ok(Math.abs(p.u - 0.5) < 1e-6 && Math.abs(p.v - 0.5) < 1e-6, `${a}: ${p.u},${p.v}`);
  }
});

test("someone to the right of the room is on the right from the front and on the left from behind", () => {
  assert.ok(project(cam(0), { x: 1.5, y: 1, z: 0 }, 16 / 9)!.u > 0.55);
  assert.ok(project(cam(180), { x: 1.5, y: 1, z: 0 }, 16 / 9)!.u < 0.45);
});

test("a nearer subject is bigger and lower in the frame, and a longer lens crops tighter", () => {
  const near = project(cam(0), { x: 0, y: 0, z: -2 }, 16 / 9)!;
  const far = project(cam(0), { x: 0, y: 0, z: 2 }, 16 / 9)!;
  assert.ok(near.depth < far.depth && near.v > far.v);
  const wide = project(cam(0, { lens: 24 }), { x: 1, y: 1, z: 0 }, 16 / 9)!;
  const tele = project(cam(0, { lens: 85 }), { x: 1, y: 1, z: 0 }, 16 / 9)!;
  assert.ok(tele.u - 0.5 > wide.u - 0.5);
});

test("a point behind the camera isn't drawn", () => {
  assert.equal(project(cam(0), { x: 0, y: 1, z: -9 }, 16 / 9), null);
});

test("the camera is kept inside what makes sense", () => {
  const g = tidy({ cam: { angle: -90, distance: 99, height: -4, lens: 3 }, subjects: [{ id: "a", label: "x".repeat(60), x: 40, z: -40 }], light: { az: 400, el: 200 } });
  assert.deepEqual(g.cam, { angle: 270, distance: 12, height: 0.2, lens: 14 });
  assert.equal(g.subjects[0]!.x, ROOM);
  assert.equal(g.subjects[0]!.z, -ROOM);
  assert.equal(g.subjects[0]!.label.length, 24);
  assert.deepEqual(g.light, { az: 40, el: 90 });
});

test("the frame is described in words a model can follow", () => {
  const d = describeGrey({ ...defaultGrey(["Ellis"]), cam: cam(180, { height: 0.5, lens: 85 }) });
  assert.match(d, /low camera looking up/);
  assert.match(d, /telephoto/);
  assert.match(d, /Light from the front|Light from the left|Light from the right|Light from behind/);
  const p = realPrompt("Ellis checks the cracked light.", defaultGrey(["Ellis"]));
  assert.match(p, /^Turn this grey 3D blockout into a photoreal/);
  assert.match(p, /grey figures are: Ellis/);
  assert.match(p, /Keep the composition exactly/);
});

test("subjects are spread across the room by default", () => {
  assert.deepEqual(defaultGrey(["A", "B", "C"]).subjects.map((s) => s.x), [-1, 0, 1]);
  assert.equal(defaultGrey([]).subjects.length, 0);
});

import { needsApproval } from "./grey";
test("a real take is locked until it is approved; a shot with nothing real on it is free", () => {
  assert.equal(needsApproval({ render: { url: "x" } }), true);
  assert.equal(needsApproval({ render: { url: "x" }, approved: true }), false);
  assert.equal(needsApproval({}), false);
});
