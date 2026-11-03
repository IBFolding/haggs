import assert from "node:assert/strict";
import { test } from "node:test";

import { CAM_SECONDS, camAt, retimeKey, reverseKeys, tidyKeys } from "./grey-camera";
import { MOVES, MOVE_INFO, defaultMoveOptions, describeMove, moveKeys, moveStart } from "./grey-camera-moves";

const cam = { angle: 20, distance: 5, height: 1.5, lens: 35 };

test("every move starts exactly at the camera and is already safe to save", () => {
  for (const move of MOVES) {
    for (const way of ["left", "right"] as const) {
      const keys = moveKeys(move, cam, { ...defaultMoveOptions(move), way });
      assert.deepEqual({ ...keys[0]!, t: 0 }, { t: 0, ...cam }, move);
      assert.equal(keys[0]!.t, 0);
      assert.ok(keys.length >= 2 && keys.length <= 12, move);
      assert.deepEqual(tidyKeys(keys), keys, `${move} survives tidyKeys unchanged`);
      assert.ok(keys.every((k, i) => i === 0 || k.t > keys[i - 1]!.t), `${move} key times strictly rise`);
    }
  }
});

test("moves are deterministic and do not change their input", () => {
  const before = JSON.stringify(cam);
  for (const move of MOVES) assert.deepEqual(moveKeys(move, cam), moveKeys(move, cam));
  assert.equal(JSON.stringify(cam), before);
});

test("duration sets where the move ends and is kept inside the path", () => {
  assert.equal(moveKeys("Push in", cam, { seconds: 2 }).at(-1)!.t, 2);
  assert.equal(moveKeys("Push in", cam, { seconds: 99 }).at(-1)!.t, CAM_SECONDS);
  assert.equal(moveKeys("Push in", cam, { seconds: -3 }).at(-1)!.t, 1);
  assert.equal(moveKeys("Whip", cam, { seconds: 1 }).at(-1)!.t, 1);
});

test("push in and pull out change only distance, by the amount asked, within the room limits", () => {
  const push = moveKeys("Push in", cam, { amount: 2 }).at(-1)!;
  assert.deepEqual({ ...push, t: 0 }, { t: 0, ...cam, distance: 3 });
  const pull = moveKeys("Pull out", cam, { amount: 4 }).at(-1)!;
  assert.equal(pull.distance, 9);
  assert.equal(moveKeys("Push in", cam, { amount: 8 }).at(-1)!.distance, 1.5);
  assert.equal(moveKeys("Pull out", { ...cam, distance: 11 }, { amount: 8 }).at(-1)!.distance, 12);
});

test("crane up and down change only height and stop at the floor and ceiling", () => {
  assert.equal(moveKeys("Crane up", cam, { amount: 2 }).at(-1)!.height, 3.5);
  assert.equal(moveKeys("Crane up", cam, { amount: 5 }).at(-1)!.height, 6);
  assert.equal(moveKeys("Crane down", cam, { amount: 1 }).at(-1)!.height, 0.5);
  assert.equal(moveKeys("Crane down", cam, { amount: 5 }).at(-1)!.height, 0.3);
  for (const k of moveKeys("Crane up", cam)) assert.ok(k.angle === cam.angle && k.distance === cam.distance && k.lens === cam.lens);
});

test("arc and orbit turn the stated angle in the stated direction, unwrapped", () => {
  assert.equal(moveKeys("Orbit", cam, { amount: 360, way: "right" }).at(-1)!.angle, 380);
  assert.equal(moveKeys("Orbit", cam, { amount: 360, way: "left" }).at(-1)!.angle, -340);
  assert.equal(moveKeys("Arc", cam, { amount: 70, way: "right" }).at(-1)!.angle, 90);
  assert.equal(moveKeys("Arc", cam, { amount: 70, way: "left" }).at(-1)!.angle, -50);
  const worst = moveKeys("Orbit", { ...cam, angle: 359 }, { amount: 999, way: "right" });
  assert.equal(worst.at(-1)!.angle, 719, "stays inside the saved angle range");
  for (const k of moveKeys("Orbit", cam)) assert.ok(k.distance === 5 && k.height === 1.5);
});

test("an orbit turns at a steady rate; an arc eases in and out", () => {
  const orbit = moveKeys("Orbit", cam, { seconds: 6, amount: 360 });
  assert.ok(Math.abs(camAt(cam, orbit, 3).angle - 200) < 1e-9);
  const arc = moveKeys("Arc", cam, { seconds: 4, amount: 60 });
  const early = camAt(cam, arc, 0.5).angle - 20, mid = camAt(cam, arc, 2).angle - 20;
  assert.ok(early < 60 * (0.5 / 4), "slower than linear at the start");
  assert.ok(Math.abs(mid - 30) < 1e-9);
});

test("bullet time is fast at the ends and slow around the middle, and still ends at the full angle", () => {
  const keys = moveKeys("Bullet time", cam, { seconds: 6, amount: 270 });
  const speed = (a: number, b: number) => Math.abs(camAt(cam, keys, b).angle - camAt(cam, keys, a).angle) / (b - a);
  const ends = speed(0, 0.6), middle = speed(2.7, 3.3);
  assert.ok(middle < ends / 4, `middle ${middle} vs ends ${ends}`);
  assert.ok(Math.abs(keys.at(-1)!.angle - 290) < 1e-9);
  assert.ok(Math.abs(camAt(cam, keys, 3).angle - 155) < 1e-6, "halfway in time is halfway round");
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i]!.angle >= keys[i - 1]!.angle, "never goes backward");
  assert.ok(moveKeys("Bullet time", cam, { way: "left" }).at(-1)!.angle < cam.angle);
});

test("dolly zoom keeps distance and lens in proportion all the way, so the middle holds its size", () => {
  for (const way of ["right", "left"] as const) {
    const keys = moveKeys("Dolly zoom", cam, { amount: 2, way });
    for (const k of keys) assert.ok(Math.abs(k.lens / k.distance - cam.lens / cam.distance) < 0.2, `${way} ${k.t}`);
  }
  const inward = moveKeys("Dolly zoom", cam, { amount: 2, way: "right" }).at(-1)!;
  assert.equal(inward.distance, 3);
  assert.ok(inward.lens < cam.lens, "closer means wider");
  assert.ok(moveKeys("Dolly zoom", cam, { amount: 2, way: "left" }).at(-1)!.lens > cam.lens);
  const wide = moveKeys("Dolly zoom", { ...cam, lens: 135 }, { amount: 2, way: "left" }).at(-1)!;
  assert.equal(wide.lens, 135, "lens stops at its limit and the move shrinks to match");
  assert.equal(wide.distance, 5);
});

test("whip holds, swings quickly, then holds", () => {
  const keys = moveKeys("Whip", cam, { seconds: 3, amount: 90, way: "right" });
  assert.deepEqual(camAt(cam, keys, 1).angle, 20);
  assert.equal(keys.at(-1)!.angle, 110);
  const swingStart = keys.find((k) => k.angle !== 20)!;
  assert.ok(swingStart.t - keys[keys.indexOf(swingStart) - 1]!.t <= 0.3, "the swing takes a quarter second");
  assert.equal(moveKeys("Whip", cam, { way: "left" }).at(-1)!.angle, -70);
});

test("a chosen figure sets the starting side; the rest of the camera is kept", () => {
  const subjects = [{ id: "a", label: "Ann", x: 0, z: 0, facing: 90 }, { id: "b", label: "Bo", x: 1, z: 0 }];
  assert.deepEqual(moveStart(cam, subjects, "a"), { ...cam, angle: 90 });
  assert.deepEqual(moveStart(cam, subjects, "b"), { ...cam, angle: 0 }, "no explicit facing means the room front");
  assert.deepEqual(moveStart(cam, subjects, "gone"), cam);
  assert.deepEqual(moveStart(cam, subjects), cam);
  const keys = moveKeys("Orbit", moveStart(cam, subjects, "a"), { amount: 180 });
  assert.equal(keys[0]!.angle, 90);
});

test("junk options fall back to safe values", () => {
  for (const move of MOVES) {
    const keys = moveKeys(move, cam, { seconds: NaN, amount: Infinity, way: "sideways" as never });
    assert.ok(keys.length >= 2);
    assert.ok(keys.every((k) => Object.values(k).every(Number.isFinite)));
  }
  assert.ok(MOVES.every((m) => MOVE_INFO[m].min <= MOVE_INFO[m].amount && MOVE_INFO[m].amount <= MOVE_INFO[m].max));
});

test("a made move can still be retimed and reversed like any path", () => {
  const keys = moveKeys("Arc", cam, { seconds: 4, amount: 60 });
  const reversed = reverseKeys(keys)!;
  for (const t of [0, 1, 2.5, 4]) assert.ok(Math.abs(camAt(cam, reversed, t).angle - camAt(cam, keys, 4 - t).angle) < 1e-9);
  const moved = retimeKey(keys, keys[1]!.t, keys[1]!.t + 0.05);
  assert.ok(moved === undefined || moved.length === keys.length);
});

test("the one-line description names the move, way, size, time and figure", () => {
  assert.equal(describeMove("Orbit", { amount: 360, seconds: 6, way: "left" }, "Ann"), "Orbit left, 360° over 6.0 s, from the front of Ann");
  assert.equal(describeMove("Push in"), "Push in, 2.5m over 4.0 s");
});
