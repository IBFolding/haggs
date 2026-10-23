import assert from "node:assert/strict";
import { test } from "node:test";

import { backupsToOffer, toRestore } from "./restore";
import { createProject } from "./model";

const disk = (id: string, name: string, shots = 5, savedAt = 1) => ({ id, name, savedAt, boards: 1, shots });

test("projects saved on disk but missing from the browser are offered, empty ones are not", () => {
  const offered = backupsToOffer([{ id: "a" }], [disk("a", "Here"), disk("b", "Waylight", 144), disk("c", "Untitled", 0)]);
  assert.deepEqual(offered.map((o) => o.name), ["Waylight"]);
  assert.deepEqual(backupsToOffer([], []), []);
});

test("a restore keeps the project's id and sheets, and refuses a file that isn't a project", () => {
  const p = createProject("W");
  const r = toRestore({ project: p, sheets: null, savedAt: 1 });
  assert.equal(r.project.id, p.id);
  assert.equal(r.summary.name, "W");
  assert.equal(r.sheets, null);
  assert.throws(() => toRestore({ project: { name: "x" }, sheets: null } as never), /isn't a project/);
});
