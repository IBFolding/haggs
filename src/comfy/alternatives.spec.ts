import assert from "node:assert/strict";
import { test } from "node:test";

import { alternativesFor, isOpen } from "./alternatives";

const e = (name: string, kind: string, inputs: string[], usage = 0, models: string[] = []) => ({ name, title: name, description: "", category: "", kind, tags: [], models, thumb: "", usage, inputs: inputs.map((media, i) => ({ file: `f${i}`, media })), runnable: true }) as never;

const library = [
  e("t2i_open", "image", [], 50, ["Z-Image"]),
  e("api_t2i_partner", "image", [], 90),
  e("edit_open", "image", ["image"], 10, ["Qwen-Image-Edit"]),
  e("i2v_wan", "video", ["image"], 70, ["Wan 2.2"]),
  e("api_i2v_h3", "video", ["image"], 80),
  e("swap", "video", ["video", "image"], 30),
  e("v2v", "video", ["video"], 5),
];

test("each step finds the library workflows that do its job, most used first", () => {
  assert.deepEqual(alternativesFor("make-picture", library).map((x) => x.name), ["api_t2i_partner", "t2i_open"]);
  assert.deepEqual(alternativesFor("edit-picture", library).map((x) => x.name), ["edit_open"]);
  assert.deepEqual(alternativesFor("animate", library).map((x) => x.name), ["api_i2v_h3", "i2v_wan"]);
  assert.deepEqual(alternativesFor("recast", library).map((x) => x.name), ["swap"]);
  assert.deepEqual(alternativesFor("picture-in", library), []);
});

test("open weights are the workflows that don't call a partner API", () => {
  assert.equal(isOpen(library[0] as never), true);
  assert.equal(isOpen(library[1] as never), false);
});
