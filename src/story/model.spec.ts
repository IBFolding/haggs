import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject, summarize } from "./model";

test("createProject returns an empty, named, timestamped project", () => {
  const p = createProject("Light Again");
  assert.equal(p.name, "Light Again");
  assert.deepEqual(p.shots, []);
  assert.deepEqual(p.threads, []);
  assert.deepEqual(p.notes, []);
  assert.ok(p.id.length > 0);
  assert.equal(p.createdAt, p.updatedAt);
});

test("createProject gives every project a distinct id", () => {
  assert.notEqual(createProject("a").id, createProject("a").id);
});

test("summarize reports the shot count", () => {
  const p = createProject("x");
  assert.equal(summarize(p).shotCount, 0);
});
