import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryKv } from "./kv";
import { createProject } from "./model";
import { createProjectStore } from "./store";
import { createSaveQueue } from "./use-autosave";

test("queue coalesces rapid edits into one save", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const p = createProject("A");
  q.queue({ ...p, name: "B" });
  q.queue({ ...p, name: "C" });
  await q.flush();
  assert.equal((await store.load(p.id))?.name, "C");
  assert.equal((await store.list()).length, 1);
});

// Review Focus 5: a save landing after a delete must not resurrect it.
test("drop cancels a pending save", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const p = createProject("A");
  q.queue(p);
  q.drop(p.id);
  await q.flush();
  assert.deepEqual(await store.list(), []);
});

test("flush with nothing queued resolves", async () => {
  await createSaveQueue(createProjectStore(memoryKv()), 5).flush();
});

test("queue saves distinct projects independently", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const a = createProject("A");
  const b = createProject("B");
  q.queue(a);
  q.queue(b);
  await q.flush();
  assert.equal((await store.list()).length, 2);
});

test("dropping one project leaves another queued save intact", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const a = createProject("A");
  const b = createProject("B");
  q.queue(a);
  q.queue(b);
  q.drop(a.id);
  await q.flush();
  assert.deepEqual((await store.list()).map((s) => s.name), ["B"]);
});

test("a queue after a flush still saves", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const p = createProject("A");
  q.queue(p);
  await q.flush();
  q.queue({ ...p, name: "renamed" });
  await q.flush();
  assert.equal((await store.load(p.id))?.name, "renamed");
});
