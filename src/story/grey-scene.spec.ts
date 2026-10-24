import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addLight, addProp, atmosphere, createHistory, describeScene, lookFilter, moveProp, normalizeScene, removeProp, sceneIsEmpty, setLook, shiftLayer, updateLight, updateProp } from "./grey-scene";

describe("props", () => {
  it("a new prop lands in the middle of the frame, in front of the actor, at a believable size", () => {
    const s = addProp({}, { name: "Wooden chair", url: "/p/chair.png" });
    assert.equal(s.props!.length, 1);
    const p = s.props![0]!;
    assert.deepEqual([p.x, p.y, p.w, p.rotate, p.behind, p.opacity], [0.5, 0.5, 0.25, 0, false, 1]);
    assert.ok(p.id);
  });

  it("moves, resizes and rotates inside the frame and never past it", () => {
    let s = addProp({}, { name: "Lamp", url: "/p/lamp.png" });
    const id = s.props![0]!.id;
    s = moveProp(s, id, { x: 1.8, y: -0.4 });
    assert.deepEqual([s.props![0]!.x, s.props![0]!.y], [1, 0]);
    s = updateProp(s, id, { w: 9, rotate: 725 });
    assert.equal(s.props![0]!.w, 1.5);
    assert.equal(s.props![0]!.rotate, 5, "angles wrap to a single turn");
    s = updateProp(s, id, { w: 0.0001 });
    assert.equal(s.props![0]!.w, 0.03);
  });

  it("a locked prop doesn't move", () => {
    let s = addProp({}, { name: "Door", url: "/p/door.png" });
    const id = s.props![0]!.id;
    s = updateProp(s, id, { locked: true });
    const moved = moveProp(s, id, { x: 0.1, y: 0.1 });
    assert.deepEqual([moved.props![0]!.x, moved.props![0]!.y], [0.5, 0.5]);
  });

  it("removes a prop and orders layers back and forward", () => {
    let s = addProp(addProp(addProp({}, { name: "A", url: "a" }), { name: "B", url: "b" }), { name: "C", url: "c" });
    const [a, b] = [s.props![0]!.id, s.props![1]!.id];
    s = shiftLayer(s, a, 1);
    assert.deepEqual(s.props!.map((p) => p.name), ["B", "A", "C"]);
    s = shiftLayer(s, a, 5);
    assert.deepEqual(s.props!.map((p) => p.name), ["B", "C", "A"], "stops at the front");
    s = removeProp(s, b);
    assert.deepEqual(s.props!.map((p) => p.name), ["C", "A"]);
  });
});

describe("lights and look", () => {
  it("adds a light with a colour and a clamped strength", () => {
    let s = addLight({}, "key");
    const id = s.lights![0]!.id;
    s = updateLight(s, id, { intensity: 7, size: -1, x: 2 });
    const l = s.lights![0]!;
    assert.equal(l.kind, "key");
    assert.deepEqual([l.intensity, l.size, l.x], [1, 0.05, 1]);
  });

  it("the look becomes a CSS filter, and neutral does nothing", () => {
    assert.equal(lookFilter(undefined), "none");
    assert.equal(lookFilter({ exposure: 0, contrast: 0, warmth: 0, saturation: 0, vignette: 0 }), "none");
    const f = lookFilter({ exposure: 0.2, contrast: 0.1, warmth: 0.5, saturation: -0.5, vignette: 0.3 });
    assert.match(f, /brightness\(1\.2\)/);
    assert.match(f, /contrast\(1\.1\)/);
    assert.match(f, /saturate\(0\.5\)/);
    assert.match(f, /sepia\(/, "warmth leans the picture amber");
    assert.equal(setLook({}, { exposure: 5 }).look!.exposure, 1);
  });

  it("atmosphere comes in as amounts between nothing and everything", () => {
    assert.deepEqual(atmosphere({ atmos: [{ kind: "rain", amount: 3 }, { kind: "fog", amount: 0 }] }), [{ kind: "rain", amount: 1 }]);
  });
});

describe("scene as a whole", () => {
  it("knows when nothing has been done to a shot yet", () => {
    assert.equal(sceneIsEmpty(undefined), true);
    assert.equal(sceneIsEmpty({}), true);
    assert.equal(sceneIsEmpty({ place: "p1" }), false);
    assert.equal(sceneIsEmpty(addProp({}, { name: "x", url: "u" })), false);
  });

  it("tidies a scene from an older save or a bad import", () => {
    const s = normalizeScene({ props: [{ id: "1", name: "x", url: "u", x: 4, y: 0.5, w: 0.2, rotate: 0, behind: false, opacity: 1 }, { nope: true }], lights: "bad" } as never);
    assert.equal(s.props!.length, 1);
    assert.equal(s.props![0]!.x, 1);
    assert.deepEqual(s.lights, []);
  });

  it("describes the set in words, for the pass that makes it look real", () => {
    let s = addProp({}, { name: "wooden chair", url: "u" });
    s = addLight(s, "key");
    s = setLook(s, { warmth: 0.6 });
    s = { ...s, atmos: [{ kind: "rain", amount: 0.8 }] };
    const text = describeScene(s, "a decaying dining room");
    assert.match(text, /decaying dining room/);
    assert.match(text, /wooden chair/);
    assert.match(text, /warm/);
    assert.match(text, /rain/);
  });
});

describe("history", () => {
  it("undoes and redoes, drops the redo when you change course, and keeps a bounded past", () => {
    const h = createHistory<number>(0, 3);
    h.push(1); h.push(2);
    assert.equal(h.undo(), 1);
    assert.equal(h.undo(), 0);
    assert.equal(h.undo(), null, "nothing left to undo");
    assert.equal(h.redo(), 1);
    h.push(9);
    assert.equal(h.redo(), null);
    for (let i = 0; i < 10; i++) h.push(i);
    let steps = 0;
    while (h.undo() !== null) steps += 1;
    assert.equal(steps, 3);
  });
});

import { exprAt, mergeEdit, resolveScene, withKey } from "./grey-scene";

describe("keyframes", () => {
  it("holds before the first key and after the last, and moves in a straight line between", () => {
    let s = addProp({}, { name: "Ball", url: "u" });
    const id = s.props![0]!.id;
    s = { ...s, props: [{ ...s.props![0]!, keys: [{ t: 1, x: 0.2 }, { t: 3, x: 0.8 }] }] };
    const at = (t: number) => resolveScene(s, t).props![0]!.x;
    assert.equal(at(0), 0.2);
    assert.equal(at(1), 0.2);
    assert.ok(Math.abs(at(2) - 0.5) < 1e-9);
    assert.equal(at(9), 0.8);
    assert.equal(resolveScene(s, 2).props![0]!.y, 0.5, "channels without keys stay where they were put");
    assert.equal(id, s.props![0]!.id);
  });

  it("a key near the same moment is updated rather than duplicated, and keys stay in time order", () => {
    let keys = withKey(undefined, 2, { x: 0.3 });
    keys = withKey(keys, 0.5, { x: 0.1 });
    keys = withKey(keys, 2.02, { y: 0.9 });
    assert.deepEqual(keys.map((k) => k.t), [0.5, 2]);
    assert.deepEqual([keys[1]!.x, keys[1]!.y], [0.3, 0.9]);
  });

  it("an edit in animate mode becomes a key at that moment, and the start of the move is kept", () => {
    const base = addProp({}, { name: "Ball", url: "u" });
    const before = resolveScene(base, 2);
    const after = { ...before, props: [{ ...before.props![0]!, x: 0.9 }] };
    const next = mergeEdit(base, before, after, 2, true);
    const p = next.props![0]!;
    assert.equal(p.x, 0.5, "the starting value is untouched");
    assert.deepEqual(p.keys!.map((k) => [k.t, k.x]), [[0, 0.5], [2, 0.9]]);
    assert.equal(resolveScene(next, 1).props![0]!.x, 0.7);
  });

  it("an edit with animate off changes the base, unless that channel already has keys", () => {
    const base = addProp({}, { name: "Ball", url: "u" });
    const before = resolveScene(base, 0);
    const moved = mergeEdit(base, before, { ...before, props: [{ ...before.props![0]!, y: 0.2, behind: true }] }, 0, false);
    assert.deepEqual([moved.props![0]!.y, moved.props![0]!.behind, moved.props![0]!.keys], [0.2, true, undefined]);
    const keyed = mergeEdit({ ...base, props: [{ ...base.props![0]!, keys: [{ t: 0, x: 0.1 }, { t: 2, x: 0.9 }] }] }, resolveScene(base, 1), { ...before, props: [{ ...before.props![0]!, x: 0.4 }] }, 1, false);
    assert.equal(keyed.props![0]!.x, 0.5, "base stays; the key at this moment takes the edit");
    assert.ok(keyed.props![0]!.keys!.some((k) => k.t === 1 && k.x === 0.4));
  });

  it("writes the same motion as an ffmpeg expression in seconds", () => {
    assert.equal(exprAt(0.5, undefined, "x"), "0.5");
    assert.equal(exprAt(0.5, [{ t: 1, x: 0.2 }], "x"), "0.2");
    const e = exprAt(0.5, [{ t: 1, x: 0.2 }, { t: 3, x: 0.8 }], "x");
    assert.match(e, /^if\(lt\(t,1\),0\.2,if\(lt\(t,3\),0\.2\+\(0\.6\)\*\(t-1\)\/2,0\.8\)\)$/);
  });
});

import { actorShadow, propShadow, setShadow } from "./grey-scene";

describe("shadows", () => {
  it("props get a soft contact shadow unless you turn it off, and the actor's is off until you ask", () => {
    const s = addProp({}, { name: "Chair", url: "u" });
    assert.equal(propShadow(s.props![0]!), 0.4);
    assert.equal(propShadow(updateProp(s, s.props![0]!.id, { shadow: 0 }).props![0]!), 0);
    assert.deepEqual(actorShadow({}), { amount: 0, angle: 135 });
    assert.deepEqual(actorShadow(setShadow({}, { amount: 5, angle: 450 })), { amount: 1, angle: 90 });
  });
});

import { addSurface, removeSurface, updateSurface } from "./grey-scene";

describe("surfaces", () => {
  it("a wall or floor starts empty, waiting to be found and given a texture", () => {
    const s = addSurface({}, "Wall");
    const w = s.surfaces![0]!;
    assert.deepEqual([w.label, w.strength, w.mask, w.texture], ["Wall", 0.85, undefined, undefined]);
    assert.equal(sceneIsEmpty(s), false);
  });

  it("keeps strength and texture size inside sensible bounds, and removes cleanly", () => {
    let s = addSurface(addSurface({}, "Wall"), "Floor");
    const id = s.surfaces![0]!.id;
    s = updateSurface(s, id, { strength: 4, texture: { url: "t.png", name: "Brick", scale: 0 } });
    assert.equal(s.surfaces![0]!.strength, 1);
    assert.equal(s.surfaces![0]!.texture!.scale, 0.1);
    s = removeSurface(s, id);
    assert.deepEqual(s.surfaces!.map((x) => x.label), ["Floor"]);
  });

  it("the set in words names what a surface became", () => {
    let s = addSurface({}, "Floor");
    s = updateSurface(s, s.surfaces![0]!.id, { mask: { url: "m.webm", at: 1, price: "x" }, texture: { url: "t.png", name: "polished oak", scale: 1 } });
    assert.match(describeScene(s), /floor in polished oak/i);
  });
});

import { describeLighting } from "./grey-scene";

describe("describeLighting", () => {
  it("says which way the light comes from, how warm it is and how hard", () => {
    let s = addLight({}, "key");
    s = updateLight(s, s.lights![0]!.id, { x: 0.15, y: 0.1, color: "#ffb866", intensity: 0.9 });
    const text = describeLighting(s);
    assert.match(text, /from the upper left/);
    assert.match(text, /warm/);
    assert.match(text, /strong|hard/);
  });

  it("falls back to the look when there are no lights, and says nothing when there is nothing to say", () => {
    assert.match(describeLighting(setLook({}, { warmth: -0.6, exposure: -0.3 })), /cool.*dim|dim.*cool/);
    assert.equal(describeLighting({}), "");
  });
});
