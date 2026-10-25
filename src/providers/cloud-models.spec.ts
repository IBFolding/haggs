import assert from "node:assert/strict";
import { test } from "node:test";

import { CLOUD_MODELS, cloudModel, cloudPrice, cloudWorkflow, usdFromCredits } from "./cloud-models";

const P = "A woman runs down a rain-soaked street at night";
const node = (w: Record<string, { class_type: string; inputs: Record<string, unknown> }>, cls: string) => Object.values(w).find((n) => n.class_type === cls)!;

test("credits become dollars at Comfy's rate of about 211 to the dollar", () => {
  assert.equal(usdFromCredits(211), 1);
  assert.equal(usdFromCredits(89), 0.422);
});

test("the line-up: nine video models and four image models, each known by its id", () => {
  assert.deepEqual(Object.keys(CLOUD_MODELS).filter((id) => CLOUD_MODELS[id]!.kind === "video").sort(), [
    "byteplus/seedance-2-0", "byteplus/seedance-2-0-fast", "byteplus/seedance-2-0-mini", "byteplus/seedance-2-5",
    "google/veo-3-1", "google/veo-3-1-fast", "google/veo-3-1-lite", "kling/kling-3.0-turbo", "kling/kling-v3",
  ]);
  assert.deepEqual(Object.keys(CLOUD_MODELS).filter((id) => CLOUD_MODELS[id]!.kind === "image").sort(), ["bfl/flux-kontext-pro", "google/nano-banana-2", "google/nano-banana-2-1", "google/nano-banana-2-lite"]);
  assert.equal(cloudModel("minimax/minimax-h3"), undefined);
});

/* ── Kling 3 ───────────────────────────────────────────── */
test("Kling 3 is one node with the model and its settings; a start frame switches it to image to video", () => {
  const w = cloudWorkflow("kling/kling-v3", { prompt: P, settings: { duration: 5, resolution: "1080p", aspect_ratio: "16:9", generate_audio: true }, images: [] });
  const n = node(w, "KlingVideoNode");
  assert.equal(n.inputs.model, "kling-v3");
  assert.equal(n.inputs["model.resolution"], "1080p");
  assert.equal(n.inputs["model.aspect_ratio"], "16:9");
  assert.equal(n.inputs.multi_shot, "disabled");
  assert.equal(n.inputs["multi_shot.duration"], 5);
  assert.equal(n.inputs["multi_shot.prompt"], P);
  assert.equal(n.inputs.generate_audio, true);
  assert.equal(n.inputs.start_frame, undefined);
  assert.equal(node(w, "SaveVideo").inputs.video?.toString(), "1,0");
  const i2v = cloudWorkflow("kling/kling-v3", { prompt: P, settings: { duration: 5, resolution: "720p", aspect_ratio: "16:9", generate_audio: false }, images: ["a.png"] });
  assert.deepEqual(node(i2v, "KlingVideoNode").inputs.start_frame, ["2", 0]);
  assert.equal(node(i2v, "LoadImage").inputs.image, "a.png");
});

test("Kling 3 Turbo names its own model and only offers 720p and 1080p", () => {
  const w = cloudWorkflow("kling/kling-3.0-turbo", { prompt: P, settings: { duration: 6, resolution: "4k", aspect_ratio: "9:16" }, images: [] });
  assert.equal(node(w, "KlingVideoNode").inputs.model, "kling-3.0-turbo");
  assert.equal(node(w, "KlingVideoNode").inputs["model.resolution"], "720p", "a resolution it does not have falls back");
});

test("Kling prices come from Comfy's estimates: 5s is $0.42 at 720p without sound and $0.84 at 1080p with it", () => {
  assert.equal(cloudPrice("kling/kling-v3", { duration: 5, resolution: "720p", generate_audio: false }), usdFromCredits(89));
  assert.equal(cloudPrice("kling/kling-v3", { duration: 5, resolution: "720p", generate_audio: true }), usdFromCredits(133));
  assert.equal(cloudPrice("kling/kling-v3", { duration: 5, resolution: "1080p", generate_audio: false }), usdFromCredits(118));
  assert.equal(cloudPrice("kling/kling-v3", { duration: 5, resolution: "1080p", generate_audio: true }), usdFromCredits(177));
  assert.equal(cloudPrice("kling/kling-3.0-turbo", { duration: 5, resolution: "720p" }), usdFromCredits(118));
  assert.equal(cloudPrice("kling/kling-3.0-turbo", { duration: 5, resolution: "1080p" }), usdFromCredits(148));
  assert.equal(cloudPrice("kling/kling-v3", { duration: 10, resolution: "720p", generate_audio: false }), usdFromCredits(178));
});

/* ── Seedance ──────────────────────────────────────────── */
test("Seedance 2.5 text to video uses the text node with the model's name, and a first frame uses the first-frame node", () => {
  const t = cloudWorkflow("byteplus/seedance-2-5", { prompt: P, settings: { duration: 5, resolution: "720p", ratio: "16:9", generate_audio: true }, images: [] });
  const n = node(t, "ByteDance2TextToVideoNode");
  assert.equal(n.inputs.model, "Seedance 2.5");
  assert.equal(n.inputs["model.prompt"], P);
  assert.equal(n.inputs["model.duration"], 5);
  assert.equal(n.inputs["model.ratio"], "16:9");
  assert.equal(n.inputs["model.output_format"], "mp4");
  assert.equal(n.inputs.watermark, false);
  const f = cloudWorkflow("byteplus/seedance-2-5", { prompt: P, settings: { duration: 5, resolution: "720p", ratio: "adaptive", generate_audio: true }, images: ["a.png"] });
  const first = node(f, "ByteDance2FirstLastFrameNode");
  assert.deepEqual(first.inputs.first_frame, ["2", 0]);
});

test("on a first frame Seedance 2.5 follows the picture's shape and sends no ratio, while 2.0 sends one", () => {
  const settings = { duration: 5, resolution: "720p", ratio: "9:16", generate_audio: true };
  const v25 = node(cloudWorkflow("byteplus/seedance-2-5", { prompt: P, settings, images: ["a.png"] }), "ByteDance2FirstLastFrameNode");
  assert.equal(v25.inputs["model.ratio"], undefined);
  const v20 = node(cloudWorkflow("byteplus/seedance-2-0", { prompt: P, settings, images: ["a.png"] }), "ByteDance2FirstLastFrameNode");
  assert.equal(v20.inputs["model.ratio"], "9:16");
  assert.equal(v20.inputs["model.output_format"], undefined);
  assert.equal(node(cloudWorkflow("byteplus/seedance-2-5", { prompt: P, settings, images: [] }), "ByteDance2TextToVideoNode").inputs["model.ratio"], "9:16", "text to video still takes the ratio");
});

test("the Seedance 2.0 family names its models and leaves out the 2.5-only output format", () => {
  const names: [string, string][] = [["byteplus/seedance-2-0", "Seedance 2.0"], ["byteplus/seedance-2-0-fast", "Seedance 2.0 Fast"], ["byteplus/seedance-2-0-mini", "Seedance 2.0 Mini"]];
  for (const [id, name] of names) {
    const n = node(cloudWorkflow(id, { prompt: P, settings: { duration: 5, resolution: "720p", ratio: "16:9", generate_audio: true }, images: [] }), "ByteDance2TextToVideoNode");
    assert.equal(n.inputs.model, name);
    assert.equal(n.inputs["model.output_format"], undefined);
  }
});

test("Seedance prices: audio does not change the price, resolution and the model do", () => {
  const s = (id: string, resolution: string, generate_audio = true) => cloudPrice(id, { duration: 5, resolution, generate_audio });
  assert.equal(s("byteplus/seedance-2-5", "720p"), usdFromCredits(352));
  assert.equal(s("byteplus/seedance-2-5", "480p"), usdFromCredits(156));
  assert.equal(s("byteplus/seedance-2-5", "1080p"), usdFromCredits(865));
  assert.equal(s("byteplus/seedance-2-0", "720p"), usdFromCredits(228));
  assert.equal(s("byteplus/seedance-2-0", "720p", false), usdFromCredits(228));
  assert.equal(s("byteplus/seedance-2-0", "480p"), usdFromCredits(106));
  assert.equal(s("byteplus/seedance-2-0", "1080p"), usdFromCredits(567));
  assert.equal(s("byteplus/seedance-2-0-fast", "720p"), usdFromCredits(182));
  assert.equal(s("byteplus/seedance-2-0-mini", "720p"), usdFromCredits(114));
  assert.equal(s("byteplus/seedance-2-0-mini", "480p"), usdFromCredits(53));
});

/* ── Veo 3.1 ───────────────────────────────────────────── */
test("Veo 3.1 names its model, takes 4 to 8 seconds, and an optional reference picture", () => {
  const w = cloudWorkflow("google/veo-3-1-fast", { prompt: P, settings: { duration: 8, resolution: "720p", aspect_ratio: "9:16", generate_audio: true }, images: ["a.png"] });
  const n = node(w, "Veo3VideoGenerationNode");
  assert.equal(n.inputs.model, "veo-3.1-fast-generate");
  assert.equal(n.inputs.duration_seconds, 8);
  assert.equal(n.inputs.aspect_ratio, "9:16");
  assert.equal(n.inputs.generate_audio, true);
  assert.deepEqual(n.inputs.image, ["2", 0]);
  assert.equal(node(cloudWorkflow("google/veo-3-1-lite", { prompt: P, settings: { duration: 2, resolution: "720p", aspect_ratio: "16:9", generate_audio: false }, images: [] }), "Veo3VideoGenerationNode").inputs.duration_seconds, 4, "shorter than the model allows is lifted to 4");
});

test("Veo prices: the sound doubles it, and the Lite model is far cheaper", () => {
  const v = (id: string, resolution: string, generate_audio: boolean, duration = 8) => cloudPrice(id, { duration, resolution, generate_audio });
  assert.equal(v("google/veo-3-1", "720p", true), usdFromCredits(675));
  assert.equal(v("google/veo-3-1", "1080p", true), usdFromCredits(675));
  assert.equal(v("google/veo-3-1", "720p", false), usdFromCredits(338));
  assert.equal(v("google/veo-3-1-fast", "720p", true), usdFromCredits(169));
  assert.equal(v("google/veo-3-1-lite", "720p", true), usdFromCredits(84));
  assert.equal(v("google/veo-3-1-lite", "1080p", true), usdFromCredits(135));
});

/* ── Nano Banana 2 ─────────────────────────────────────── */
test("Nano Banana 2 puts the model's name and its settings on one node and loads every reference picture", () => {
  const w = cloudWorkflow("google/nano-banana-2", { prompt: P, settings: { aspect_ratio: "16:9", resolution: "2K", thinking: "HIGH" }, images: ["a.png", "b.png"] });
  const n = node(w, "GeminiNanoBanana2V2");
  assert.equal(n.inputs.model, "Nano Banana 2 (Gemini 3.1 Flash Image)");
  assert.equal(n.inputs["model.resolution"], "2K");
  assert.equal(n.inputs["model.thinking_level"], "HIGH");
  assert.equal(n.inputs.response_modalities, "IMAGE");
  assert.deepEqual(n.inputs["model.images.image_1"], ["2", 0]);
  assert.deepEqual(n.inputs["model.images.image_2"], ["3", 0]);
  assert.equal(node(w, "SaveImage").inputs.filename_prefix, "haggs/still");
});

test("the other Nano Banana models name themselves, and Lite only makes 1K", () => {
  assert.equal(node(cloudWorkflow("google/nano-banana-2-1", { prompt: P, settings: { aspect_ratio: "auto", resolution: "1K", thinking: "MEDIUM" }, images: [] }), "GeminiNanoBanana2V2").inputs.model, "Gemini Nano Banana 2.1");
  const lite = node(cloudWorkflow("google/nano-banana-2-lite", { prompt: P, settings: { aspect_ratio: "auto", resolution: "4K", thinking: "MINIMAL" }, images: [] }), "GeminiNanoBanana2V2");
  assert.equal(lite.inputs.model, "Nano Banana 2 Lite");
  assert.equal(lite.inputs["model.resolution"], "1K");
});

test("Nano Banana prices per picture, by resolution", () => {
  const p = (id: string, resolution: string) => cloudPrice(id, { resolution });
  assert.equal(p("google/nano-banana-2", "1K"), usdFromCredits(18));
  assert.equal(p("google/nano-banana-2", "2K"), usdFromCredits(26));
  assert.equal(p("google/nano-banana-2", "4K"), usdFromCredits(39));
  assert.equal(p("google/nano-banana-2-1", "1K"), usdFromCredits(12));
  assert.equal(p("google/nano-banana-2-lite", "1K"), usdFromCredits(9));
});

/* ── Kontext and the rules for every model ─────────────── */
test("FLUX Kontext edits a picture and needs one", () => {
  const w = cloudWorkflow("bfl/flux-kontext-pro", { prompt: "make the jacket red", settings: { aspect_ratio: "16:9" }, images: ["a.png"] });
  assert.equal(node(w, "FluxKontextProImageNode").inputs.prompt, "make the jacket red");
  assert.deepEqual(node(w, "FluxKontextProImageNode").inputs.input_image, ["2", 0]);
  assert.throws(() => cloudWorkflow("bfl/flux-kontext-pro", { prompt: "make the jacket red", settings: {}, images: [] }), /picture/i);
  assert.equal(cloudPrice("bfl/flux-kontext-pro", {}), 0.04);
});

test("every model refuses an empty prompt and too many pictures, and an unknown model is an error", () => {
  for (const id of Object.keys(CLOUD_MODELS)) {
    assert.throws(() => cloudWorkflow(id, { prompt: " ", settings: {}, images: ["a.png"] }), /describe|say|write/i, id);
    assert.throws(() => cloudWorkflow(id, { prompt: P, settings: {}, images: Array.from({ length: 20 }, (_, i) => `${i}.png`) }), /picture/i, id);
  }
  assert.throws(() => cloudWorkflow("nope/none", { prompt: P, settings: {}, images: [] }), /isn't a cloud model/i);
});

test("a picture name that isn't a plain uploaded file is refused", () => {
  assert.throws(() => cloudWorkflow("kling/kling-v3", { prompt: P, settings: {}, images: ["../../etc/passwd"] }), /picture/i);
});
