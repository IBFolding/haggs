import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCanvas, fromRecipe, portsOf, type Canvas } from "./canvas";
import { compile } from "./recipe";
import type { ApiPrompt } from "./convert";

const node = (id: string, kind: string, x = 0, extra = {}) => ({ id, kind, x, y: 0, ...extra }) as Canvas["nodes"][number];

test("a recipe laid out on the canvas compiles to the same workflow it always did", () => {
  const recipe = { name: "Ad", steps: [{ kind: "picture-in" as const }, { kind: "edit-picture" as const, prompt: "Wet slate, rim light" }, { kind: "animate" as const, prompt: "Slow push-in", seconds: 6 }] };
  assert.deepEqual(compileCanvas(fromRecipe(recipe), {}), compile(recipe));
});

test("links decide what feeds what, so a recast takes the video and the face you wired in", () => {
  const canvas: Canvas = {
    name: "Put me in it",
    nodes: [node("face", "picture-in", 0), node("clip", "video-in", 0), node("swap", "recast", 200, { prompt: "Replace the dancer" })],
    links: [{ from: "clip", to: "swap" }, { from: "face", to: "swap" }],
  };
  const w = compileCanvas(canvas, {});
  const g = Object.values(w).find((n) => n.class_type === "HiggsfieldMotionTransferNode")!;
  const video = Object.entries(w).find(([, n]) => n.class_type === "LoadVideo")![0];
  const face = Object.entries(w).find(([, n]) => n.class_type === "LoadImage")![0];
  assert.deepEqual(g.inputs["model.video"], [video, 0]);
  assert.deepEqual(g.inputs["model.reference_images.image_1"], [face, 0]);
});

test("a step with nothing wired into what it needs says which", () => {
  const canvas: Canvas = { name: "x", nodes: [node("a", "animate", 0, { prompt: "go go" })], links: [] };
  assert.throws(() => compileCanvas(canvas, {}), /“Animate it” needs a picture/);
});

test("a loop of links is refused", () => {
  const canvas: Canvas = { name: "x", nodes: [node("a", "edit-picture", 0), node("b", "edit-picture", 1)], links: [{ from: "a", to: "b" }, { from: "b", to: "a" }] };
  assert.throws(() => compileCanvas(canvas, {}), /loop/i);
});

test("the result is the step at the end of the line, furthest right", () => {
  const canvas: Canvas = { name: "x", nodes: [node("p", "picture-in", 0), node("v", "animate", 300, { prompt: "slow" })], links: [{ from: "p", to: "v" }] };
  const w = compileCanvas(canvas, {});
  assert.ok(Object.values(w).some((n) => n.class_type === "SaveVideo"));
});

const tpl: ApiPrompt = {
  "1": { class_type: "LoadImage", inputs: { image: "example.png" } },
  "2": { class_type: "UpscaleThing", inputs: { image: ["1", 0], scale: 2 } },
  "3": { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: "x" } },
};

test("a library workflow stacks: its picture input is replaced by what is linked in, and its result carries on", () => {
  const canvas: Canvas = {
    name: "Make, upscale, animate",
    nodes: [node("m", "make-picture", 0, { prompt: "A lighthouse at dusk" }), node("up", "library", 200, { template: "upscale" }), node("an", "animate", 400, { prompt: "waves move" })],
    links: [{ from: "m", to: "up" }, { from: "up", to: "an" }],
  };
  const w = compileCanvas(canvas, { upscale: tpl });
  const make = Object.entries(w).find(([, n]) => n.class_type === "Flux3ImageNode")![0];
  const up = Object.entries(w).find(([, n]) => n.class_type === "UpscaleThing")!;
  const anim = Object.values(w).find((n) => n.class_type === "MinimaxHailuo03FirstLastFrameNode")!;
  assert.deepEqual(up[1].inputs.image, [make, 0]);
  assert.deepEqual(anim.inputs.first_frame, [up[0], 0]);
  assert.ok(!Object.values(w).some((n) => n.class_type === "LoadImage"), "the template's own loader is gone");
  assert.equal(Object.values(w).filter((n) => n.class_type === "SaveImage").length, 0);
});

test("a library workflow's ports come from its own loaders and saver", () => {
  assert.deepEqual(portsOf(node("u", "library", 0, { template: "upscale" }), { upscale: tpl }), { needs: ["image"], makes: "image" });
  assert.deepEqual(portsOf(node("a", "animate"), {}), { needs: ["image"], makes: "video" });
});

test("a library workflow nobody has loaded can't be compiled", () => {
  const canvas: Canvas = { name: "x", nodes: [node("u", "library", 0, { template: "nope" })], links: [] };
  assert.throws(() => compileCanvas(canvas, {}), /“nope”/);
});

import { planToCanvas } from "./canvas";

test("a plan from Haggy becomes nodes in a row, linked by what each can take", () => {
  const c = planToCanvas({ name: "Poster to clip", steps: [{ kind: "picture-in" }, { kind: "edit-picture", prompt: "make it night" }, { kind: "animate", prompt: "slow push-in", seconds: 6 }] }, []);
  assert.deepEqual(c.nodes.map((n) => n.kind), ["picture-in", "edit-picture", "animate"]);
  assert.deepEqual(c.links.map((l) => [l.from, l.to]), [[c.nodes[0]!.id, c.nodes[1]!.id], [c.nodes[1]!.id, c.nodes[2]!.id]]);
  assert.equal(c.nodes[2]!.seconds, 6);
  assert.ok(c.nodes[1]!.x > c.nodes[0]!.x);
});

test("a plan only uses steps and library workflows that exist", () => {
  const c = planToCanvas({ name: "x", steps: [{ kind: "picture-in" }, { kind: "teleport" }, { template: "upscale" }, { template: "made_up" }] }, ["upscale"]);
  assert.deepEqual(c.nodes.map((n) => n.kind === "library" ? n.template : n.kind), ["picture-in", "upscale"]);
});
