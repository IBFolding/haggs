import assert from "node:assert/strict";
import { test } from "node:test";

import { CAM_SECONDS, camAt, dropKey, drawnKeys, presetKeys, setKey, stepOf, tidyKeys, wordsToKeys,retimeKey,reverseKeys } from "./grey-camera";

const cam = { angle: 20, distance: 5, height: 1.5, lens: 35 };

test("retiming moves only the chosen camera key and refuses occupied or invalid times",()=>{
 const keys=[{...cam,t:0},{...cam,t:2,angle:380},{...cam,t:6,distance:2}],before=JSON.stringify(keys);
 const moved=retimeKey(keys,2,3.12)!;
 assert.deepEqual(moved.map(k=>k.t),[0,3.1,6]);assert.deepEqual(moved[1],{...keys[1],t:3.1});assert.equal(JSON.stringify(keys),before);
 for(const at of [-1,7,NaN,Infinity,0,6,5.999])assert.equal(retimeKey(keys,2,at),undefined);
 assert.equal(retimeKey(keys,4,3),undefined);assert.equal(retimeKey(undefined,0,1),undefined);
 assert.deepEqual(retimeKey(keys,0,4)!.map(k=>k.t),[2,4,6]);
});
test("reversing preserves the motion interval, orbit angles and all camera values",()=>{
 const keys=[{...cam,t:1,angle:-40},{...cam,t:2,angle:180,lens:50},{...cam,t:5,angle:400,height:3}],before=JSON.stringify(keys);
 const reversed=reverseKeys(keys)!;assert.deepEqual(reversed.map(k=>k.t),[1,4,5]);
 for(const t of [1,1.5,2,3,4,5]){const actual=camAt(cam,reversed,t),expected=camAt(cam,keys,6-t);for(const field of ["angle","distance","height","lens"] as const)assert.ok(Math.abs(actual[field]-expected[field])<1e-9);}
 assert.deepEqual(reverseKeys(reversed),keys);assert.equal(JSON.stringify(keys),before);
 assert.equal(reverseKeys([keys[0]!]),undefined);assert.equal(reverseKeys(undefined),undefined);
});

test("with no keys the camera is the still camera", () => {
  assert.deepEqual(camAt(cam, undefined, 3), cam);
  assert.deepEqual(camAt(cam, [], 3), cam);
});

test("between keys the camera eases linearly, and holds outside them", () => {
  const keys = [{ t: 0, ...cam }, { t: 4, ...cam, distance: 1 }];
  assert.equal(camAt(cam, keys, 2).distance, 3);
  assert.equal(camAt(cam, keys, -1).distance, 5);
  assert.equal(camAt(cam, keys, 99).distance, 1);
});

test("a key within a twentieth of a second replaces the one there; others stay sorted", () => {
  let keys = setKey(undefined, 2, cam);
  keys = setKey(keys, 0, { ...cam, lens: 50 });
  keys = setKey(keys, 2.03, { ...cam, lens: 85 });
  assert.deepEqual(keys.map((k) => [k.t, k.lens]), [[0, 50], [2.05, 85]]);
  assert.equal(dropKey(keys, 0)?.length, 1);
  assert.equal(dropKey(dropKey(keys, 0), 2.05), undefined);
});

test("tidyKeys clamps to real ranges, drops junk and caps the count", () => {
  const out = tidyKeys([{ t: 99, angle: 400, distance: 50, height: -3, lens: 500 }, { t: "x" }, null])!;
  assert.deepEqual(out, [{ t: CAM_SECONDS, angle: 400, distance: 12, height: 0.2, lens: 135 }]);
  assert.equal(tidyKeys("nope"), undefined);
  assert.equal(tidyKeys(Array.from({ length: 30 }, (_, i) => ({ t: i / 5, ...cam })))!.length, 12);
});

test("words make a path: each phrase is one move, spread over the path", () => {
  const { keys, unknown } = wordsToKeys("push in, then orbit left and rise", cam);
  assert.equal(unknown, undefined);
  assert.deepEqual(keys.map((k) => k.t), [0, 3, 6]);
  assert.equal(keys[1]!.distance, 2.5);
  assert.equal(keys[2]!.angle, -40);
  assert.equal(keys[2]!.height, 3.5);
});

test("a phrase that is not a move is reported, and the rest still apply", () => {
  const { keys, unknown } = wordsToKeys("push in, then do a barrel roll", cam);
  assert.equal(unknown, "do a barrel roll");
  assert.equal(keys.length, 2);
  assert.equal(stepOf("nonsense", cam), null);
});

test("presets start at the current camera and stay inside the safe ranges", () => {
  for (const name of ["Push in", "Pull back", "Orbit", "Crane up"] as const) {
    const k = presetKeys(name, cam);
    assert.deepEqual({ ...k[0]!, t: 0 }, { t: 0, ...cam });
    assert.ok(k.every((x) => x.distance >= 1 && x.distance <= 12 && x.height <= 6));
  }
  assert.equal(presetKeys("Orbit", cam).length, 3);
});

test("a drawn line becomes at most eight keys on the same lens and height", () => {
  const line = Array.from({ length: 60 }, (_, i) => ({ x: Math.sin(i / 10) * 4, z: -Math.cos(i / 10) * 4 }));
  const keys = drawnKeys(line, { height: 2, lens: 50 });
  assert.ok(keys.length >= 3 && keys.length <= 8);
  assert.equal(keys[0]!.t, 0);
  assert.equal(keys.at(-1)!.t, CAM_SECONDS);
  assert.ok(keys.every((k) => k.height === 2 && k.lens === 50));
  assert.ok(Math.abs(keys[0]!.distance - 4) < 0.01);
  assert.deepEqual(drawnKeys([{ x: 0, z: 0 }], { height: 2, lens: 50 }), []);
});

test("an orbit left eases the way it was drawn, not the long way round", () => {
  const keys = wordsToKeys("orbit left", cam).keys;
  assert.equal(keys.at(-1)!.angle, -40);
  assert.equal(camAt(cam, keys, 3).angle, -10);
});
