import assert from "node:assert/strict";
import test from "node:test";
import { memoryKv } from "./kv";
import { KEEP, listVersions, removeVersion, restoreVersion, saveVersion } from "./versions";
import type { Project } from "./model";

const p = (name: string) => ({ id: "p", name, shots: [] }) as unknown as Project;

test("a version is a copy, newest first, that later edits do not touch", async () => {
  const kv = memoryKv();
  const a = p("a");
  await saveVersion(kv, "p", undefined, a, "First pass");
  (a as { name: string }).name = "changed";
  await saveVersion(kv, "p", undefined, p("b"), "Second");
  const list = await listVersions(kv, "p");
  assert.deepEqual(list.map((v) => v.name), ["Second", "First pass"]);
  assert.equal(list[1]!.project.name, "a");
});

test("boards keep their own versions", async () => {
  const kv = memoryKv();
  await saveVersion(kv, "p", "b1", p("x"), "Mine");
  assert.equal((await listVersions(kv, "p")).length, 0);
  assert.equal((await listVersions(kv, "p", "b1")).length, 1);
});

test("past the limit the oldest safety copy goes before a named version", async () => {
  const kv = memoryKv();
  await saveVersion(kv, "p", undefined, p("keep"), "Keep me");
  for (let i = 0; i < KEEP + 2; i += 1) await saveVersion(kv, "p", undefined, p("x"), `auto ${i}`, true, new Date(1000 + i));
  const list = await listVersions(kv, "p");
  assert.equal(list.length, KEEP);
  assert.ok(list.some((v) => v.name === "Keep me"));
});

test("restoring returns the old cut and keeps the current one as a safety copy", async () => {
  const kv = memoryKv();
  const [old] = await saveVersion(kv, "p", undefined, p("old"), "Old");
  const out = await restoreVersion(kv, "p", undefined, old!.id, p("now"));
  assert.equal(out!.project.name, "old");
  assert.equal(out!.versions[0]!.auto, true);
  assert.equal(out!.versions[0]!.project.name, "now");
  assert.equal(await restoreVersion(kv, "p", undefined, "nope", p("now")), null);
});

test("a version can be removed", async () => {
  const kv = memoryKv();
  const [v] = await saveVersion(kv, "p", undefined, p("a"), "A");
  assert.deepEqual(await removeVersion(kv, "p", undefined, v!.id), []);
});
