import assert from "node:assert/strict";
import { test } from "node:test";

import { cloudPrice } from "./cloud-models";
import { createCloudModelProvider } from "./cloud-model-provider";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function fakeComfy(kind: "video" | "image") {
  const calls: { url: string; init?: RequestInit }[] = [];
  const file = kind === "video" ? "out.mp4" : "out.png";
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (url.endsWith("/api/upload/image")) return Response.json({ name: "up_still.png" });
    if (url.endsWith("/api/prompt")) return Response.json({ prompt_id: "job-1", node_errors: {} });
    if (url.includes("/api/jobs/job-1")) return Response.json({ status: "completed", outputs: { "20": { images: [{ filename: file, subfolder: "haggs", type: "output" }] } } });
    if (url.includes("/api/view")) return new Response(null, { status: 302, headers: { location: `https://storage.googleapis.com/bucket/${file}?sig=1` } });
    if (url.startsWith("https://storage.googleapis.com/")) return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-type": kind === "video" ? "video/mp4" : "image/png" } });
    return new Response("unexpected", { status: 500 });
  }) as unknown as typeof fetch;
  return { calls, fake };
}

test("a video model uploads the first frame, runs its own node and reports the price for those settings", async () => {
  const { calls, fake } = fakeComfy("video");
  const provider = createCloudModelProvider({ apiKey: "ck", fetch: fake, pollMs: 0, modelId: "google/veo-3-1-fast", keep: async () => "/api/local/haggs-renders/v.mp4" });
  const settings = { duration: 8, resolution: "720p", aspect_ratio: "16:9", generate_audio: true };
  const result = await provider.run({ capability: "image-to-video", prompt: "She turns to the window", images: [PNG], passthrough: settings });
  assert.deepEqual(result.assets, [{ url: "/api/local/haggs-renders/v.mp4", kind: "video" }]);
  assert.equal(result.usd, cloudPrice("google/veo-3-1-fast", settings));
  const body = JSON.parse(String(calls.find((c) => c.url.endsWith("/api/prompt"))!.init?.body));
  assert.equal(body.prompt["1"].class_type, "Veo3VideoGenerationNode");
  assert.equal(body.prompt["2"].inputs.image, "up_still.png");
  assert.equal(body.extra_data.api_key_comfy_org, "ck");
});

test("an image model with references loads each of them, and the finished picture is kept", async () => {
  const { calls, fake } = fakeComfy("image");
  const provider = createCloudModelProvider({ apiKey: "ck", fetch: fake, pollMs: 0, modelId: "google/nano-banana-2", keep: async () => "/api/local/haggs-renders/p.png" });
  const result = await provider.run({ capability: "text-to-image", prompt: "A lighthouse at dusk", images: [PNG, PNG], passthrough: { aspect_ratio: "16:9", resolution: "2K" } });
  assert.deepEqual(result.assets, [{ url: "/api/local/haggs-renders/p.png", kind: "image" }]);
  const body = JSON.parse(String(calls.find((c) => c.url.endsWith("/api/prompt"))!.init?.body));
  assert.equal(body.prompt["1"].class_type, "GeminiNanoBanana2V2");
  assert.deepEqual(body.prompt["1"].inputs["model.images.image_2"], ["3", 0]);
  assert.equal(calls.filter((c) => c.url.endsWith("/api/upload/image")).length, 2);
});

test("a bad request stops before anything is uploaded or spent", async () => {
  const { calls, fake } = fakeComfy("video");
  const provider = createCloudModelProvider({ apiKey: "ck", fetch: fake, pollMs: 0, modelId: "kling/kling-v3", keep: async () => "x" });
  await assert.rejects(provider.run({ capability: "text-to-video", prompt: "x", passthrough: {} }), /describe/i);
  assert.equal(calls.length, 0);
});

test("the provider quotes the price and answers only for its own kind of output", () => {
  const video = createCloudModelProvider({ apiKey: "ck", modelId: "kling/kling-v3", keep: async () => "x" });
  assert.equal(video.supports("text-to-video"), true);
  assert.equal(video.supports("image-to-video"), true);
  assert.equal(video.supports("text-to-image"), false);
  const image = createCloudModelProvider({ apiKey: "ck", modelId: "bfl/flux-kontext-pro", keep: async () => "x" });
  assert.equal(image.supports("image-edit"), true);
  assert.equal(image.supports("text-to-video"), false);
});
