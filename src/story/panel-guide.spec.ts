import assert from "node:assert/strict";
import test from "node:test";

import { GROUPS, groupAfter, groupForTab, railFor, stepProgress, suggestNext } from "./panel-guide";

test("every group is on the All tools rail, in order", () => {
  assert.deepEqual(railFor("advanced", "timing").map((g) => g.id), GROUPS.map((g) => g.id));
});

test("Simple shows fewer groups but never hides the open one", () => {
  const simple = railFor("simple", "timing").map((g) => g.id);
  assert.ok(simple.length < GROUPS.length);
  assert.ok(!simple.includes("reshoot"));
  assert.ok(railFor("simple", "reshoot").some((g) => g.id === "reshoot"));
});

test("the suggestion is the first group not yet opened, and never the open one", () => {
  const rail = railFor("advanced", "timing");
  assert.equal(suggestNext([], rail, "timing"), "picture");
  assert.equal(suggestNext(["picture"], rail, "timing"), "reframe");
  assert.equal(suggestNext(["picture", "reframe", "caption"], rail, "timing"), "cut");
});

test("free navigation: opening anything out of order is fine and the guide keeps suggesting what is left", () => {
  const rail = railFor("advanced", "sound");
  assert.equal(suggestNext([], rail, "sound"), "timing");
});

test("the suggestion runs out when everything has been opened", () => {
  const rail = railFor("simple", "more");
  assert.equal(suggestNext(rail.map((g) => g.id), rail, "more"), null);
});

test("progress dots: done when every group of the step was opened, current for the open step", () => {
  const rail = railFor("simple", "timing");
  const none = stepProgress([], rail, "timing");
  assert.deepEqual(none.map((s) => s.state), ["current", "todo", "todo"]);
  const prepared = stepProgress(["timing", "picture", "caption"], rail, "cut");
  assert.deepEqual(prepared.map((s) => s.state), ["done", "current", "todo"]);
  assert.equal(prepared[0]!.seen, 3);
});

test("a step with groups only in All tools does not count them in Simple", () => {
  const simple = stepProgress(["picture", "caption"], railFor("simple", "timing"), "timing");
  assert.equal(simple[0]!.total, 3);
  assert.equal(stepProgress([], railFor("advanced", "timing"), "timing")[0]!.total, 4);
});

test("Next walks the rail and stops at the end", () => {
  const rail = railFor("advanced", "timing");
  assert.equal(groupAfter("timing", rail)?.id, "picture");
  assert.equal(groupAfter("more", rail), null);
});

test("each legacy tab maps to a group", () => {
  assert.equal(groupForTab("shot"), "timing");
  assert.equal(groupForTab("tools"), "edit");
  assert.equal(groupForTab("sound"), "sound");
});
