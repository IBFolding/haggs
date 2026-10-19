import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultKv, memoryKv } from "./kv";

test("memoryKv round-trips a value", async () => {
  const kv = memoryKv();
  await kv.set("a", { n: 1 });
  assert.deepEqual(await kv.get("a"), { n: 1 });
});

test("memoryKv returns undefined for a missing key", async () => {
  assert.equal(await memoryKv().get("nope"), undefined);
});

test("memoryKv remove deletes the key", async () => {
  const kv = memoryKv();
  await kv.set("a", 1);
  await kv.remove("a");
  assert.equal(await kv.get("a"), undefined);
});

// Review Focus 3: no indexedDB in Node, so this must not throw.
test("defaultKv falls back to memory when indexedDB is absent", async () => {
  assert.equal(typeof indexedDB, "undefined");
  const kv = defaultKv();
  await kv.set("a", 1);
  assert.equal(await kv.get("a"), 1);
});
