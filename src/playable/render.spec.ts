import assert from "node:assert/strict";
import { test } from "node:test";

import { fit, matchLayout, toWorld } from "./render";
import { defaultSpec, readSpec, type MatchSpec } from "./spec";

test("the world letterboxes into any canvas, and points map back into it", () => {
  assert.deepEqual(fit(1600, 900), { scale: 2, x: 0, y: 0 });
  const tall = fit(400, 900);
  assert.equal(tall.scale, 0.5);
  assert.equal(tall.x, 0);
  assert.equal(tall.y, (900 - 225) / 2);
  assert.deepEqual(toWorld(1600, 900, 800, 450), { x: 400, y: 225 });
  assert.deepEqual(toWorld(400, 900, 0, tall.y), { x: 0, y: 0 });
});

test("the match grid fits the world for every size, and taps find their cell", () => {
  for (const [cols, rows] of [[5, 5], [8, 9], [8, 5]] as const) {
    const spec = readSpec({ ...defaultSpec("match"), rules: { cols, rows, kinds: 5, moves: 20, target: 1000 } }) as MatchSpec;
    const { size, x, y, cellAt } = matchLayout(spec);
    assert.ok(x >= 0 && y >= 0 && x + size * cols <= 800 && y + size * rows <= 450);
    assert.deepEqual(cellAt(x + 1, y + 1), [0, 0]);
    assert.deepEqual(cellAt(x + size * cols - 1, y + size * rows - 1), [rows - 1, cols - 1]);
    assert.equal(cellAt(x - 1, y + 1), null);
    assert.equal(cellAt(x + 1, y + size * rows + 1), null);
  }
});
