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

// Review finding (important): `running = running.then(writePending)` meant a single
// rejected save turned the chain into a rejected promise, so writePending was never
// called again — every later edit was silently dropped for the rest of the session.
test("a failed save does not stop later saves", async () => {
  const store = createProjectStore(memoryKv());
  let failNext = true;
  const errors: unknown[] = [];
  const flaky = {
    ...store,
    async save(project: ReturnType<typeof createProject>) {
      if (failNext) {
        failNext = false;
        throw new Error("QuotaExceeded");
      }
      return store.save(project);
    },
  };

  const q = createSaveQueue(flaky, 5, (error) => errors.push(error));
  q.queue(createProject("doomed"));
  await q.flush();

  const later = createProject("later");
  q.queue(later);
  await q.flush();

  assert.equal((await store.load(later.id))?.name, "later");
  assert.equal(errors.length, 1);
});

test("flush does not reject when a save fails", async () => {
  const store = createProjectStore(memoryKv());
  const broken = {
    ...store,
    async save() {
      throw new Error("nope");
    },
  };
  const q = createSaveQueue(broken, 5, () => {});
  q.queue(createProject("A"));
  await q.flush();
});
