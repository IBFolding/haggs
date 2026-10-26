import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { readWidgets, toApiPrompt, type Catalog, type UiWorkflow } from "./convert";

const dir = join(import.meta.dirname, "fixtures");
const catalog: Catalog = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
const load = (name: string): UiWorkflow => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));

test("Genjutsu's template becomes the prompt Comfy runs: nested model options, autogrow references, seed control skipped", () => {
  const { prompt, problems, outputs } = toApiPrompt(load("api_higgsfield_genjutsu_motion_transfer"), catalog);
  assert.deepEqual(problems, []);
  const g = prompt["9"]!;
  assert.equal(g.class_type, "HiggsfieldMotionTransferNode");
  assert.equal(g.inputs.model, "genjutsu-v1.0");
  assert.match(String(g.inputs["model.prompt"]), /snow queen/);
  assert.equal(g.inputs["model.resolution"], "720p");
  assert.equal(g.inputs["model.seed"], 42);
  assert.deepEqual(g.inputs["model.video"], ["13", 0]);
  assert.deepEqual(g.inputs["model.reference_images.image_2"], ["15", 0]);
  assert.equal(prompt["12"], undefined, "notes are left out");
  assert.deepEqual(outputs, ["10"]);
});

test("a subgraph is flattened: outer wires reach inner nodes by input name, and promoted values fill unwired inputs", () => {
  const { prompt, problems } = toApiPrompt(load("3d_moge_perspective_to_mesh"), catalog);
  assert.deepEqual(problems, []);
  const size = Object.entries(prompt).find(([id, n]) => id.startsWith("67:") && n.class_type === "GetImageSize")!;
  assert.deepEqual(size[1].inputs.image, ["9", 0], "the outer Load Image reaches inside");
  assert.ok(Object.keys(prompt).every((id) => !id.startsWith("67") || id.includes(":")), "the instance itself isn't a node");
});

test("a view-only node is dropped and a widget added since the template was saved takes its default", () => {
  const { prompt, problems } = toApiPrompt(load("api_bria_eraser"), catalog);
  assert.deepEqual(problems, []);
  assert.ok(Object.values(prompt).every((n) => n.class_type !== "ImageCompare"));
});

test("a node Comfy Cloud doesn't have, or a choice it doesn't offer, is reported before anything is sent", () => {
  const wf = load("api_nano_banana_2_1_t2i");
  const broken = structuredClone(wf);
  broken.nodes[0]!.type = "SomeCustomPackNode";
  assert.match(toApiPrompt(broken, catalog).problems.join(" "), /SomeCustomPackNode/);
  assert.deepEqual(toApiPrompt(wf, catalog).problems, []);
  assert.match(toApiPrompt({ nodes: "x" } as unknown as UiWorkflow, catalog).problems[0]!, /isn't a Comfy workflow/);
});

test("readWidgets skips a seed's control value and walks a chosen option's own inputs", () => {
  const def = catalog.HiggsfieldMotionTransferNode!;
  assert.deepEqual(readWidgets(def, ["genjutsu-v1.0", "p", "480p", 7, "randomize", "randomize"]), { model: "genjutsu-v1.0", "model.prompt": "p", "model.resolution": "480p", "model.seed": 7 });
});

test("a workflow is priced the way Comfy prices each partner node", async () => {
  const { priceOf } = await import("./price");
  const { prompt } = toApiPrompt(load("api_higgsfield_genjutsu_motion_transfer"), catalog);
  const price = await priceOf(prompt, catalog);
  assert.equal(price.min, 0.97383);
  assert.ok(price.perSecond);
  assert.equal(price.label, "97 credits per second");
  prompt["9"]!.inputs["model.resolution"] = "480p";
  assert.equal((await priceOf(prompt, catalog)).min, 0.45474);
});

test("a model file a template names but Cloud calls something else is swapped for the closest one it has, and said so", async () => {
  const { useAvailable } = await import("./convert");
  const cat = { VAELoader: { input: { required: { vae_name: [["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors", "flux2-vae.safetensors"]] as unknown as [string[]] } } } } as unknown as Catalog;
  const prompt = { "1": { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_int8_convrot.safetensors" } } };
  const out = useAvailable(prompt, cat);
  assert.equal(out.prompt["1"]!.inputs.vae_name, "minimax_h3_video_vae_fp16.safetensors");
  assert.deepEqual(out.swaps, ["VAELoader: used minimax_h3_video_vae_fp16.safetensors in place of minimax_h3_video_vae_int8_convrot.safetensors"]);
  const none = useAvailable({ "1": { class_type: "VAELoader", inputs: { vae_name: "totally_unrelated.safetensors" } } }, cat);
  assert.equal(none.prompt["1"]!.inputs.vae_name, "totally_unrelated.safetensors", "no close match: left alone, so validation still reports it");
  assert.deepEqual(none.swaps, []);
});

test("prepare swaps what it can, then reports only what is still wrong", async () => {
  const { prepare } = await import("./convert");
  const ok = prepare(load("api_higgsfield_genjutsu_motion_transfer"), catalog);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.swaps, []);
  assert.deepEqual(prepare({ nodes: "x" } as unknown as UiWorkflow, catalog).problems, ["That isn't a Comfy workflow file."]);
});
