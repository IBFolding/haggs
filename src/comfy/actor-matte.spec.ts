import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { actorMattePrompt, imageMattePrompt } from "./actor-matte";

describe("actorMattePrompt", () => {
  it("cuts the people you describe out of the footage and saves a transparent video at the footage's own frame rate", () => {
    const p = actorMattePrompt({ describe: "the man in the black shirt" });
    const byType = (t: string) => Object.entries(p).filter(([, n]) => n.class_type === t);
    assert.equal(byType("LoadVideo").length, 1);
    const [id, detect] = byType("SAM3_Detect")[0]!;
    assert.ok(id);
    assert.equal(p[(byType("CLIPTextEncode")[0]![1].inputs.text as unknown) as string] ?? undefined, undefined);
    assert.equal(byType("CLIPTextEncode")[0]![1].inputs.text, "the man in the black shirt");
    assert.equal(detect.inputs.individual_masks, false);
    assert.equal("positive_coords" in detect.inputs, false, "no points unless you click");
    const save = byType("SaveWEBM")[0]![1];
    assert.equal(save.inputs.codec, "vp9");
    const fps = save.inputs.fps as [string, number];
    assert.equal(p[fps[0]]!.class_type, "GetVideoComponents");
    assert.equal(fps[1], 2);
    const join = byType("JoinImageWithAlpha")[0]![1];
    assert.deepEqual(join.inputs.alpha, [id, 0]);
  });

  it("passes the places you clicked as pixel points", () => {
    const p = actorMattePrompt({ describe: "", points: [{ x: 412.6, y: 880.2 }, { x: 30, y: 40 }] });
    const detect = Object.values(p).find((n) => n.class_type === "SAM3_Detect")!;
    assert.equal(detect.inputs.positive_coords, JSON.stringify([{ x: 413, y: 880 }, { x: 30, y: 40 }]));
  });

  it("falls back to 'person' when you give it nothing, and keeps the description short enough for the model", () => {
    const blank = Object.values(actorMattePrompt({ describe: "  " })).find((n) => n.class_type === "CLIPTextEncode")!;
    assert.equal(blank.inputs.text, "person");
    const long = Object.values(actorMattePrompt({ describe: "x".repeat(300) })).find((n) => n.class_type === "CLIPTextEncode")!;
    assert.equal((long.inputs.text as string).length, 120);
  });
});

it("still-photo selection loads an image and saves RGBA PNG without video nodes", () => {
  const p = imageMattePrompt("the wooden floor");
  assert.equal(p["1"]!.class_type, "LoadImage");
  assert.equal(p["7"]!.class_type, "SaveImage");
  assert.deepEqual(p["5"]!.inputs.image, ["1", 0]);
  assert.deepEqual(p["6"]!.inputs.alpha, ["5", 0]);
  assert.equal(p["4"]!.inputs.text, "the wooden floor");
  for (const node of Object.values(p)) {
    assert.ok(!["LoadVideo", "GetVideoComponents", "SaveWEBM"].includes(node.class_type));
    for (const input of Object.values(node.inputs)) {
      if (Array.isArray(input) && typeof input[0] === "string" && typeof input[1] === "number") assert.ok(p[input[0]], `missing node ${input[0]}`);
    }
  }
});
