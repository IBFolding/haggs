import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHistory, setLook, type GreyScene } from "./grey-scene";
import { finishCutout, undoPending } from "./grey-edit-safety";

describe("Grey Room edit safety", () => {
  const source = { url: "/shot.mp4", kind: "video" as const, revision: "one", trimIn: 2 };
  const matte = { url: "/matte.webm", at: 1, price: "$0" };

  it("keeps edits made while a cut-out runs and refuses a changed source", () => {
    const edited: GreyScene = setLook({ source }, { exposure: 0.4 });
    assert.deepEqual(finishCutout(edited, source, matte), { ...edited, matte });
    assert.equal(finishCutout({ ...edited, source: { ...source, revision: "two" } }, source, matte), null);
    assert.equal(finishCutout({ ...edited, source: { ...source, trimIn: 3 } }, source, matte), null);
    const { source: _removed, ...withoutSource } = edited;
    assert.equal(finishCutout(withoutSource, source, matte), null);
  });

  it("undoes a pending edit first and makes it available to redo", () => {
    const first: GreyScene = { source };
    const edited: GreyScene = setLook({ source }, { exposure: 0.2 });
    const pending: GreyScene = setLook({ source }, { exposure: 0.5 });
    const history = createHistory(first);
    assert.equal(undoPending(history, edited), first);
    assert.equal(history.redo(), edited);
    assert.equal(undoPending(history, pending), edited);
    assert.equal(history.redo(), pending);
    assert.equal(history.current, pending);
  });
});
