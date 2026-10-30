import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { dismiss, inbox, listSnapshots, propose, readSnapshot, writeSnapshot } from "./bridge";
import { createProject } from "../story/model";

const root = () => mkdtempSync(join(tmpdir(), "haggs-bridge-"));

test("a project's snapshot is written and read back, and listed by name", async () => {
  const dir = root();
  const project = { ...createProject("Waylight"), id: "p1" };
  await writeSnapshot(dir, { project, sheets: null });
  assert.equal((await readSnapshot(dir, "p1"))?.project.name, "Waylight");
  assert.deepEqual((await listSnapshots(dir)).map((s) => [s.id, s.name]), [["p1", "Waylight"]]);
  assert.equal(await readSnapshot(dir, "missing"), null);
});

test("ids that could escape the folder are refused", async () => {
  const dir = root();
  await assert.rejects(writeSnapshot(dir, { project: { ...createProject("x"), id: "../evil" }, sheets: null }), /project id/);
  await assert.rejects(readSnapshot(dir, "../../etc"), /project id/);
  await assert.rejects(propose(dir, "a/b", { kind: "fill", summary: "s", payload: {} }), /project id/);
});

test("proposals wait in the project's inbox, oldest first, until dismissed", async () => {
  const dir = root();
  const a = await propose(dir, "p1", { kind: "fill", summary: "Looks for 12 characters", payload: { characters: [], locations: [] } });
  const b = await propose(dir, "p1", { kind: "draft", summary: "A vertical drama", payload: { title: "x" }, boardId: "main", formatId: "vertical-drama" });
  assert.deepEqual((await inbox(dir, "p1")).map((i) => [i.id, i.kind]), [[a.id, "fill"], [b.id, "draft"]]);
  assert.deepEqual(await inbox(dir, "p2"), []);
  await dismiss(dir, "p1", a.id);
  assert.deepEqual((await inbox(dir, "p1")).map((i) => i.id), [b.id]);
  await assert.rejects(dismiss(dir, "p1", "../x"), /proposal id/);
  await assert.rejects(propose(dir, "p1", { kind: "nope" as never, summary: "", payload: {} }), /kind/);
});

test("proposals made in the same millisecond remain in arrival order", async (t) => {
  const dir = root();
  t.mock.method(Date, "now", () => 1234567890000);
  let uuid = 0;
  t.mock.method(crypto, "randomUUID", () => (++uuid === 1
    ? "ffffffff-ffff-4fff-8fff-ffffffffffff"
    : "00000000-0000-4000-8000-000000000000"));
  const first = await propose(dir, "p1", { kind: "fill", summary: "first", payload: {} });
  const second = await propose(dir, "p1", { kind: "draft", summary: "second", payload: {} });
  assert.equal(first.at, second.at);
  assert.deepEqual((await inbox(dir, "p1")).map((item) => item.id), [first.id, second.id]);
});

test("removing a project's snapshot takes it off the list Claude sees", async () => {
  const { removeSnapshot } = await import("./bridge");
  const dir = root();
  await writeSnapshot(dir, { project: { ...createProject("Gone"), id: "p9" }, sheets: null });
  await removeSnapshot(dir, "p9");
  assert.deepEqual(await listSnapshots(dir), []);
  await assert.rejects(removeSnapshot(dir, "../x"), /project id/);
});
