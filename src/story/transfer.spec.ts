import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject } from "./model";
import { TransferError, exportProject, importProject } from "./transfer";

test("export then import round-trips the content", () => {
  const p = createProject("A");
  const back = importProject(exportProject(p));
  assert.equal(back.name, "A");
  assert.deepEqual(back.shots, []);
});

test("export is indented for readability", () => {
  assert.ok(exportProject(createProject("A")).includes("\n  "));
});

// Review Focus 2: importing must never clobber an existing project.
test("import assigns a fresh id", () => {
  const p = createProject("A");
  assert.notEqual(importProject(exportProject(p)).id, p.id);
});

// Review Focus 1: hostile and merely wrong input both get a readable error.
test("import rejects a wrong format marker", () => {
  const json = JSON.stringify({ format: "comfy/1", project: {} });
  assert.throws(() => importProject(json), TransferError);
});

test("import rejects arbitrary valid JSON", () => {
  assert.throws(() => importProject('{"hello":"world"}'), TransferError);
});

test("import rejects malformed JSON with a readable error", () => {
  assert.throws(() => importProject("{{{"), TransferError);
});

test("import rejects an envelope whose project is not shaped like one", () => {
  const json = JSON.stringify({ format: "haggs.project/1", project: { name: 7 } });
  assert.throws(() => importProject(json), TransferError);
});

test("import rejects JSON that is not an object", () => {
  assert.throws(() => importProject("42"), TransferError);
  assert.throws(() => importProject("null"), TransferError);
});

test("every rejection carries a message a person can act on", () => {
  for (const bad of ["{{{", "42", '{"hello":"world"}', '{"format":"comfy/1"}']) {
    assert.throws(() => importProject(bad), (error: unknown) => {
      assert.ok(error instanceof TransferError);
      assert.match(error.message, /\S/);
      assert.ok(!/undefined|\[object/.test(error.message), error.message);
      return true;
    });
  }
});
