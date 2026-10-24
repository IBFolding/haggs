import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planRuns, type Stamp } from "./run-sync";

const s = (id: string, rev: number, deleted = false): Stamp => ({ id, rev, ...(deleted ? { deleted } : {}) });

describe("planRuns", () => {
  it("uploads what only this device has and downloads what only the account has", () => {
    const p = planRuns([s("a", 1)], [s("b", 2)], []);
    assert.deepEqual(p.push, ["a"]);
    assert.deepEqual(p.pull, ["b"]);
  });

  it("the newer change wins, so a favourite set elsewhere arrives and one set here leaves", () => {
    const p = planRuns([s("a", 5), s("b", 1)], [s("a", 2), s("b", 9)], []);
    assert.deepEqual(p.push, ["a"]);
    assert.deepEqual(p.pull, ["b"]);
  });

  it("a deletion made elsewhere removes it here, and is not downloaded as a new run", () => {
    const p = planRuns([s("a", 1)], [s("a", 4, true), s("z", 3, true)], []);
    assert.deepEqual(p.removeLocal, ["a"]);
    assert.deepEqual(p.pull, []);
  });

  it("a deletion made here is sent up as a marker, even if the account still has the run", () => {
    const p = planRuns([], [s("a", 1)], ["a"]);
    assert.deepEqual(p.markDeleted, ["a"]);
    assert.deepEqual(p.pull, []);
  });

  it("does nothing when both sides agree", () => {
    assert.deepEqual(planRuns([s("a", 3)], [s("a", 3)], []), { push: [], pull: [], removeLocal: [], markDeleted: [] });
  });
});
