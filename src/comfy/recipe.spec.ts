import assert from "node:assert/strict";
import { test } from "node:test";

import { compile, nextSteps, STEPS, type Recipe } from "./recipe";

test("a chain of steps becomes one wired Comfy workflow ending in a save", () => {
  const recipe: Recipe = { name: "Product to ad", steps: [
    { kind: "picture-in" },
    { kind: "edit-picture", prompt: "Put the bottle on a wet slate slab, rim light" },
    { kind: "animate", prompt: "Slow push-in, droplets run down the bottle", seconds: 6 },
  ] };
  const w = compile(recipe);
  const load = Object.entries(w).find(([, n]) => n.class_type === "LoadImage")!;
  const edit = Object.entries(w).find(([, n]) => n.class_type === "FluxKontextProImageNode")!;
  const anim = Object.entries(w).find(([, n]) => n.class_type === "MinimaxHailuo03FirstLastFrameNode")!;
  assert.deepEqual(edit[1].inputs.input_image, [load[0], 0]);
  assert.deepEqual(anim[1].inputs.first_frame, [edit[0], 0]);
  assert.equal(anim[1].inputs["model.duration"], 6);
  const save = Object.values(w).find((n) => n.class_type === "SaveVideo")!;
  assert.deepEqual(save.inputs.video, [anim[0], 0]);
});

test("a recast takes the video it follows and the picture before it as the new face", () => {
  const w = compile({ name: "Put me in it", steps: [{ kind: "video-in" }, { kind: "picture-in" }, { kind: "recast", prompt: "Replace the dancer with the person in the picture" }] });
  const g = Object.values(w).find((n) => n.class_type === "HiggsfieldMotionTransferNode")!;
  const video = Object.entries(w).find(([, n]) => n.class_type === "LoadVideo")![0];
  const face = Object.entries(w).find(([, n]) => n.class_type === "LoadImage")![0];
  assert.deepEqual(g.inputs["model.video"], [video, 0]);
  assert.deepEqual(g.inputs["model.reference_images.image_1"], [face, 0]);
});

test("each step only follows what it can use", () => {
  assert.deepEqual(nextSteps([]).map((s) => s.kind).sort(), ["make-picture", "picture-in", "video-in"]);
  assert.ok(nextSteps([{ kind: "picture-in" }]).some((s) => s.kind === "animate"));
  assert.ok(!nextSteps([{ kind: "picture-in" }]).some((s) => s.kind === "speak"));
  assert.ok(nextSteps([{ kind: "picture-in" }, { kind: "animate", prompt: "x" }]).some((s) => s.kind === "speak"));
  assert.throws(() => compile({ name: "x", steps: [{ kind: "animate", prompt: "go go" }] }), /needs a picture/);
  assert.throws(() => compile({ name: "x", steps: [] }), /Add a step/);
  assert.ok(STEPS.length >= 7);
});
