import assert from "node:assert/strict";
import { test } from "node:test";
import { shotFootage } from "./media-display";
import { createProject, newShot, type Media } from "./model";
import { addTake, chooseTake, removeFromTimeline, splitShot } from "./takes";

const render = (url: string) => ({ url, kind: "video" as const, usd: 1, at: 1, promptHash: "made" });
for (const half of [0, 1]) {
  test(`removing split half ${half + 1} leaves both surviving takes visible and switchable`, () => {
    const shot = addTake({ ...newShot(), seconds: 9, render: render("first.mp4") }, render("second.mp4"));
    const split = splitShot({ ...createProject("test"), shots: [shot] }, shot.id, 6);
    const removed = removeFromTimeline(split, split.shots[half]!.id);
    const survivor = removed.shots[0]!;
    const display = shotFootage(survivor, removed.media!);
    assert.equal(display.own.length, 0, "archived sources belong in Cuts and references");
    assert.deepEqual(display.takes.map(t => t.url), ["first.mp4", "second.mp4"]);
    const switched = chooseTake(survivor, display.takes[0]!.id);
    assert.equal(switched.render!.url, "first.mp4");
    const restored = chooseTake(switched, display.takes[1]!.id);
    assert.equal(restored.render!.url, "second.mp4");
    assert.equal(restored.trimIn, survivor.trimIn ?? 0);
    assert.equal(restored.seconds, survivor.seconds);
  });
}

test("only displayed media on this shot suppress duplicate take cards", () => {
  const shot = { ...newShot(), render: render("a.mp4") };
  const m: Media = { id: "m", url: "a.mp4", kind: "video", name: "A", origin: "import", status: "review", note: "" };
  assert.equal(shotFootage(shot, [m]).takes.length, 1);
  assert.equal(shotFootage(shot, [{ ...m, shotId: "other" }]).takes.length, 1);
  assert.equal(shotFootage(shot, [{ ...m, shotId: shot.id }]).takes.length, 0);
  assert.equal(shotFootage(shot, []).takes.length, 1, "filtered-out media cannot hide take controls");
  const mismatched = { ...shot, takes: [{ id: "old", ...render("old.mp4") }] };
  assert.equal(shotFootage(mismatched, [m]).showRender, true);
  assert.equal(shotFootage(mismatched, [{ ...m, shotId: shot.id }]).showRender, false);
});
