import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryKv } from "./kv";
import { createProject } from "./model";
import { createProjectStore } from "./store";

test("save then load round-trips a project", async () => {
  const store = createProjectStore(memoryKv());
  const p = createProject("A");
  await store.save(p);
  assert.equal((await store.load(p.id))?.name, "A");
});

test("list returns summaries newest-updated first", async () => {
  const store = createProjectStore(memoryKv());
  const a = createProject("A");
  const b = createProject("B");
  await store.save(a);
  await store.save(b);
  assert.deepEqual((await store.list()).map((s) => s.name), ["B", "A"]);
});

test("re-saving an existing project moves it to the front without duplicating", async () => {
  const store = createProjectStore(memoryKv());
  const a = createProject("A");
  const b = createProject("B");
  await store.save(a);
  await store.save(b);
  await store.save(a);
  assert.deepEqual((await store.list()).map((s) => s.name), ["A", "B"]);
});

test("save stamps updatedAt", async () => {
  const store = createProjectStore(memoryKv());
  const p = { ...createProject("A"), updatedAt: 0 };
  await store.save(p);
  assert.ok((await store.load(p.id))!.updatedAt > 0);
});

test("list reflects a renamed project", async () => {
  const store = createProjectStore(memoryKv());
  const p = createProject("A");
  await store.save(p);
  await store.save({ ...p, name: "B" });
  assert.deepEqual((await store.list()).map((s) => s.name), ["B"]);
});

test("remove drops the record and the index entry", async () => {
  const store = createProjectStore(memoryKv());
  const p = createProject("A");
  await store.save(p);
  await store.remove(p.id);
  assert.equal(await store.load(p.id), undefined);
  assert.deepEqual(await store.list(), []);
});

test("load of an unknown id returns undefined", async () => {
  assert.equal(await createProjectStore(memoryKv()).load("nope"), undefined);
});

// Review Focus 4: a corrupt index must not make the library unusable.
test("list returns empty when the index is corrupt", async () => {
  const kv = memoryKv();
  await kv.set("projects/index", "not an array");
  assert.deepEqual(await createProjectStore(kv).list(), []);
});
