import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { propCutoutPrompt, propPrompt, PROP_INPUT } from "./prop-cutout";

describe("props from words", () => {
  it("asks for one whole object alone on a plain background, so it can be cut out cleanly", () => {
    const p = propPrompt("a worn leather armchair");
    assert.match(p, /worn leather armchair/);
    assert.match(p, /plain white background/);
    assert.match(p, /no shadow/i);
    assert.match(p, /whole/i);
  });

  it("keeps what you typed to a sensible length and never sends blank words", () => {
    assert.equal(propPrompt("  ").trim(), "");
    assert.ok(propPrompt("x".repeat(500)).length < 700);
  });

  it("cuts the object out of its background and saves a picture that keeps its transparency", () => {
    const g = propCutoutPrompt();
    const types = Object.values(g).map((n) => n.class_type);
    assert.deepEqual(types, ["LoadImage", "LoadBackgroundRemovalModel", "RemoveBackground", "InvertMask", "JoinImageWithAlpha", "SaveImage"]);
    assert.equal(PROP_INPUT, "1/image");
    const join = g["5"]!.inputs;
    assert.deepEqual(join.image, ["1", 0]);
    assert.deepEqual(join.alpha, ["4", 0], "the mask is turned so the object is kept and the background goes");
  });
});
