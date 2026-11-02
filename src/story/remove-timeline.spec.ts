import assert from "node:assert/strict";
import { test } from "node:test";
import { commit, normalize, view } from "./boards";
import { buildCut } from "./cut";
import { memoryKv } from "./kv";
import { createProject, newShot } from "./model";
import { createProjectStore } from "./store";
import { exportProject, importProject } from "./transfer";
import { addTake, removeFromTimeline, splitShot, takesOf } from "./takes";

const render = (url: string) => ({ url, kind: "video" as const, usd: 1, at: 1, promptHash: "original" });
function fixture() {
  const shot = addTake({ ...newShot(), id: "original", seconds: 9, render: render("first.mp4") }, render("second.mp4"), "Original animation");
  return { ...createProject("Segment removal"), shots: [shot, { ...newShot(), id: "next", seconds: 6, render: render("next.mp4") }] };
}

test("split/remove closes the gap, preserves the kept half, every take and the undo snapshot", () => {
  const original = fixture();
  const split = splitShot(original, "original", 6);
  const before = structuredClone(split);
  const removed = removeFromTimeline(split, split.shots[1]!.id);
  assert.deepEqual(split, before, "undo's input snapshot is immutable");
  assert.deepEqual(removed.shots, [split.shots[0], split.shots[2]]);
  assert.deepEqual(takesOf(removed.shots[0]!), takesOf(original.shots[0]!));
  assert.deepEqual(buildCut(removed).clips.map(c => [c.shotId, c.start, c.seconds]), [["original", 0, 6], ["next", 6, 6]]);
  assert.equal(buildCut(removed).total, 12);
  assert.deepEqual(removed.media!.map(m => m.url), ["first.mp4", "second.mp4"]);
  assert.equal(removed.media![1]!.sourceTake!.trimIn, 6);
  assert.equal(removed.media![1]!.sourceTake!.seconds, 3);
  assert.equal(removed.media![1]!.sourceTake!.origin, "Original animation");
  assert.deepEqual(buildCut(before).clips.map(c => c.seconds), [6, 3, 6], "restoring the undo snapshot restores the split");
});

test("removing the first split half preserves the remaining footage's source offset", () => {
  const split = splitShot(fixture(), "original", 6);
  const removed = removeFromTimeline(split, "original");
  assert.equal(buildCut(removed).clips[0]!.from, 6);
  assert.equal(buildCut(removed).clips[0]!.seconds, 3);
  assert.equal(buildCut(removed).clips[1]!.start, 3);
});

test("split/remove/save/reopen keeps the new cut and archived takes without touching another board", async () => {
  let full = normalize(fixture());
  const other = { id: "other", name: "Other edit", kind: "board" as const, shots: fixture().shots, notes: [] };
  full = { ...full, boards: [...full.boards!, other] };
  const split = splitShot(view(full, "main"), "original", 6);
  const removed = removeFromTimeline(split, split.shots[1]!.id);
  const store = createProjectStore(memoryKv());
  await store.save(commit(full, "main", removed));
  const reopened = (await store.load(full.id))!;
  assert.deepEqual(view(reopened, "main").shots, removed.shots);
  assert.deepEqual(reopened.media, removed.media);
  assert.deepEqual(reopened.boards![1], other);
  assert.equal(buildCut(view(reopened, "main")).total, 12);
  const imported = importProject(exportProject(reopened));
  assert.deepEqual(imported.media, removed.media, "portable project files also retain the source takes");
  assert.equal(buildCut(view(imported, "main")).total, 12);
});

test("removing the last occurrence retains sources; stale removal is a no-op", () => {
  const p = fixture();
  const removed = removeFromTimeline(removeFromTimeline(p, "original"), "next");
  assert.equal(buildCut(removed).total, 0);
  assert.deepEqual(removed.media!.map(m => m.url), ["first.mp4", "second.mp4", "next.mp4"]);
  assert.equal(removeFromTimeline(removed, "next"), removed);
});
