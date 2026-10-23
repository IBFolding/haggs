import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryKv } from "../story/kv";
import { LESSONS, createProgress } from "./lessons";

test("the Academy is seven short lessons, each ending in something you make in haggs", () => {
  assert.equal(LESSONS.length, 7);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, 7);
  for (const l of LESSONS) {
    assert.ok(l.steps.length >= 3 && l.steps.length <= 6, l.id);
    assert.match(l.doIt.href, /^\//, l.id);
    assert.ok(l.homework.length > 20, l.id);
    assert.ok(l.minutes >= 1 && l.minutes <= 20, l.id);
  }
  assert.ok(LESSONS.reduce((n, l) => n + l.minutes, 0) <= 90);
  assert.match(LESSONS[0]!.doIt.href, /quick=photo-to-clip/);
});

test("progress is kept, can be undone, and the certificate opens only when all seven are done", async () => {
  const p = createProgress(memoryKv());
  assert.deepEqual(await p.done(), []);
  for (const l of LESSONS.slice(0, 6)) await p.mark(l.id, true);
  assert.equal(await p.certified(), false);
  await p.mark(LESSONS[6]!.id, true);
  assert.equal(await p.certified(), true);
  await p.mark(LESSONS[0]!.id, false);
  assert.equal(await p.certified(), false);
  await p.mark("not-a-lesson", true);
  assert.equal((await p.done()).length, 6);
});
