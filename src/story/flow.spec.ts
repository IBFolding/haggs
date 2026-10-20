import assert from "node:assert/strict";
import { test } from "node:test";

import { addSubplot, laneOf, lanes, layout, placeShot } from "./flow";
import { createProject, type Project, type Shot } from "./model";

const shot = (id: string, threadIds: string[] = []): Shot => ({ id, heading: id, beat: "", threadIds, seconds: 2, model: { id: "m", settings: {} } });
const sample = (): Project => ({
  ...createProject("p"),
  threads: [
    { id: "maya", name: "MAYA", color: "#fff", kind: "character" },
    { id: "b", name: "B plot — the ferry", color: "#0ff", kind: "plot" },
  ],
  shots: [shot("1", ["maya"]), shot("2", ["b", "maya"]), shot("3"), shot("4", ["b"])],
});

test("lanes are the main story and then each subplot; characters are not lanes", () => {
  assert.deepEqual(lanes(sample()).map((l) => [l.id, l.name]), [[null, "Main story"], ["b", "B plot — the ferry"]]);
  assert.equal(laneOf(sample(), sample().shots[1]!), "b");
  assert.equal(laneOf(sample(), sample().shots[0]!), null, "a character thread does not move a shot off the main line");
});

test("every shot sits at its story position in its lane, and the story line runs through all of them in order", () => {
  const l = layout(sample());
  assert.deepEqual(l.nodes.map((n) => [n.id, n.col, n.lane]), [["1", 0, 0], ["2", 1, 1], ["3", 2, 0], ["4", 3, 1]]);
  assert.deepEqual(l.story.map((e) => [e.from, e.to]), [["1", "2"], ["2", "3"], ["3", "4"]]);
  assert.deepEqual(l.threads.map((e) => [e.from, e.to, e.thread]), [["2", "4", "b"], ["1", "2", "maya"]]);
});

test("placing a shot moves it in the story and into a lane, keeping its characters", () => {
  const moved = placeShot(sample(), "4", 0, null);
  assert.deepEqual(moved.shots.map((s) => s.id), ["4", "1", "2", "3"]);
  assert.deepEqual(moved.shots[0]!.threadIds, [], "leaving the subplot lane removes the subplot only");
  const intoB = placeShot(sample(), "1", 2, "b");
  assert.deepEqual(intoB.shots.map((s) => s.id), ["2", "3", "1", "4"]);
  assert.deepEqual(intoB.shots[2]!.threadIds, ["maya", "b"]);
  assert.deepEqual(sample().shots.map((s) => s.id), ["1", "2", "3", "4"], "the input is not mutated");
  assert.throws(() => placeShot(sample(), "nope", 0, null), /shot/);
});

test("a subplot is a named lane", () => {
  const p = addSubplot(sample(), "C plot — the orchard");
  assert.equal(lanes(p).length, 3);
  assert.equal(lanes(p)[2]!.name, "C plot — the orchard");
  assert.throws(() => addSubplot(p, " "), /name/);
});
