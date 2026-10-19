import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultKv, memoryKv, resilient } from "./kv";

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

// Review finding (important): defaultKv only handled indexedDB being ABSENT.
// In a private window it is DEFINED and every operation rejects, which left the
// library hanging on its loading state forever with nothing shown.
const blockedKv = () => ({
  async get<T>(_key: string): Promise<T | undefined> {
    throw new Error("storage is blocked");
  },
  async set(_key: string, _value: unknown) {
    throw new Error("storage is blocked");
  },
  async remove(_key: string) {
    throw new Error("storage is blocked");
  },
});

test("resilient falls back to the spare when the primary rejects", async () => {
  const kv = resilient(blockedKv(), memoryKv());
  await kv.set("a", 1);
  assert.equal(await kv.get("a"), 1);
});

test("resilient stays on the spare once it has fallen back", async () => {
  const kv = resilient(blockedKv(), memoryKv());
  await kv.set("a", 1);
  await kv.remove("a");
  assert.equal(await kv.get("a"), undefined);
});

test("resilient uses the primary while it works", async () => {
  const primary = memoryKv();
  const kv = resilient(primary, memoryKv());
  await kv.set("a", 1);
  assert.equal(await primary.get("a"), 1);
});
