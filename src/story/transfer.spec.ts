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

// Review finding (important): arrays were checked for array-ness but not element
// shape, direction only defaulted on null/undefined, and "" passed as a name — so
// import could persist a project that crashes whatever reads it next.
function envelope(project: unknown): string {
  return JSON.stringify({ format: "haggs.project/1", exportedAt: 0, project });
}

const wellFormed = {
  id: "x",
  name: "A",
  createdAt: 1,
  updatedAt: 1,
  shots: [],
  threads: [],
  notes: [],
  direction: { camera: "", light: "", staging: "", constants: "" },
};

test("import rejects an empty name", () => {
  assert.throws(() => importProject(envelope({ ...wellFormed, name: "   " })), TransferError);
});

test("import rejects shots that are not objects with ids", () => {
  assert.throws(() => importProject(envelope({ ...wellFormed, shots: [null] })), TransferError);
  assert.throws(() => importProject(envelope({ ...wellFormed, shots: [7] })), TransferError);
  assert.throws(() => importProject(envelope({ ...wellFormed, threads: [{}] })), TransferError);
});

test("import rejects a direction that is not an object", () => {
  assert.throws(() => importProject(envelope({ ...wellFormed, direction: "nope" })), TransferError);
});

test("import accepts a well-formed project with real shots", () => {
  const shot = { id: "s1", heading: "INT. ALLEY", beat: "she turns", threadIds: [], seconds: null,
    model: { id: "m", ratio: "1:1", count: 1 } };
  const back = importProject(envelope({ ...wellFormed, shots: [shot] }));
  assert.equal(back.shots.length, 1);
  assert.equal(back.shots[0]!.id, "s1");
});
