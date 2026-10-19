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

/** A Kv with latency, so a read-modify-write has a window to interleave. */
function slowKv(delayMs = 5) {
  const inner = memoryKv();
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    async get<T>(key: string) {
      await wait();
      return inner.get<T>(key);
    },
    async set(key: string, value: unknown) {
      await wait();
      return inner.set(key, value);
    },
    async remove(key: string) {
      await wait();
      return inner.remove(key);
    },
  };
}

// Review finding (critical): two overlapping saves each read the same index and
// the later write dropped the earlier one's entry, losing a project for good.
test("concurrent saves both reach the index", async () => {
  const store = createProjectStore(slowKv());
  const a = createProject("A");
  const b = createProject("B");
  await Promise.all([store.save(a), store.save(b)]);
  assert.deepEqual(
    (await store.list()).map((s) => s.name).sort(),
    ["A", "B"],
  );
});

test("a save concurrent with a remove leaves the index consistent", async () => {
  const store = createProjectStore(slowKv());
  const keep = createProject("keep");
  const going = createProject("going");
  await store.save(keep);
  await store.save(going);
  await Promise.all([store.remove(going.id), store.save({ ...keep, name: "renamed" })]);
  assert.deepEqual((await store.list()).map((s) => s.name), ["renamed"]);
});

// Review finding (important): the index's type was guarded but not its contents,
// so one bad record crashed the render and made every later save throw.
test("list skips index records that are not summaries", async () => {
  const kv = memoryKv();
  await kv.set("projects/index", [
    null,
    { id: "partial" },
    { id: "ok", name: "Ok", updatedAt: 1, shotCount: 0 },
  ]);
  assert.deepEqual(
    (await createProjectStore(kv).list()).map((s) => s.name),
    ["Ok"],
  );
});

test("save still works when the index holds junk", async () => {
  const kv = memoryKv();
  await kv.set("projects/index", [null, 7]);
  const store = createProjectStore(kv);
  const p = createProject("A");
  await store.save(p);
  assert.deepEqual((await store.list()).map((s) => s.name), ["A"]);
});

// Review finding (important): a save already in flight when the user deleted
// put the project back, name and all.
test("a save that lands after a remove does not resurrect the project", async () => {
  const store = createProjectStore(slowKv());
  const p = createProject("A");
  await store.save(p);
  await Promise.all([store.remove(p.id), store.save({ ...p, name: "edited" })]);
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.load(p.id), undefined);
});
