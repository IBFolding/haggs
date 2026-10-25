import assert from "node:assert/strict";
import { test } from "node:test";

import { FX, fxFilter, isFx } from "./fx";

test("there are seven looks, each with a name and a plain one-line description", () => {
  assert.deepEqual(FX.map((f) => f.id), ["vhs", "crt", "glitch", "thermal", "night", "retro", "noir"]);
  for (const f of FX) assert.ok(f.name.length > 2 && f.says.length > 20, f.id);
});

test("every look is a real ffmpeg filter chain; none or an unknown look adds nothing", () => {
  for (const f of FX) assert.ok(fxFilter(f.id).length > 20, f.id);
  assert.equal(fxFilter(undefined), "");
  assert.equal(fxFilter("none"), "");
  assert.equal(fxFilter("rm -rf /"), "");
});

test("a filter chain can't break out of a shell script or a filter graph", () => {
  for (const f of FX) {
    const chain = fxFilter(f.id);
    assert.doesNotMatch(chain, /[;\n"`$]|'/, `${f.id} has a character that needs quoting`);
    // Every comma that is inside an expression is escaped, so it isn't read as the end of a filter.
    assert.doesNotMatch(chain, /\((?:[^()]*[^\\(),]),/, `${f.id} has an unescaped comma inside an expression`);
  }
});

test("only the known look names are accepted", () => {
  assert.equal(isFx("vhs"), true);
  assert.equal(isFx("none"), false);
  assert.equal(isFx(7), false);
  assert.equal(isFx("VHS"), false);
});
