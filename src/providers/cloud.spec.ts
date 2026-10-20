import assert from "node:assert/strict";
import { test } from "node:test";

import { cloudEstimate, createCloudProvider, minimaxWorkflow } from "./cloud";

test("text to video uses MiniMax H3's text node with the settings inside the model option", () => {
  const w = minimaxWorkflow({ prompt: "A hill at night", seconds: 6, resolution: "768P", ratio: "16:9", seed: 7 });
  assert.equal(w["1"]!.class_type, "MinimaxHailuo03TextToVideoNode");
  assert.deepEqual(w["1"]!.inputs, { model: "MiniMax H3", "model.prompt": "A hill at night", "model.resolution": "768P", "model.ratio": "16:9", "model.duration": 6, seed: 7, watermark: false });
  assert.deepEqual(w["20"], { class_type: "SaveVideo", inputs: { video: ["1", 0], filename_prefix: "haggs/minimax", format: "mp4", "format.codec": "h264" } });
});

test("a first frame animates from the picture; references go to the reference node; never both", () => {
  const first = minimaxWorkflow({ prompt: "She turns", seconds: 5, firstFrame: "still.png", seed: 1 });
  assert.equal(first["1"]!.class_type, "MinimaxHailuo03FirstLastFrameNode");
  assert.deepEqual(first["1"]!.inputs.first_frame, ["2", 0]);
  assert.deepEqual(first["2"], { class_type: "LoadImage", inputs: { image: "still.png" } });
  assert.equal("model.ratio" in first["1"]!.inputs, false, "the frame decides the shape");

  const refs = minimaxWorkflow({ prompt: "Maya at the dock", seconds: 5, references: ["maya.png", "dock.png"], seed: 1 });
  assert.equal(refs["1"]!.class_type, "MinimaxHailuo03ReferenceNode");
  assert.deepEqual(refs["1"]!.inputs["model.reference_images.image_1"], ["2", 0]);
  assert.deepEqual(refs["1"]!.inputs["model.reference_images.image_2"], ["3", 0]);
  assert.deepEqual(refs["3"], { class_type: "LoadImage", inputs: { image: "dock.png" } });

  assert.throws(() => minimaxWorkflow({ prompt: "x x x x", seconds: 5, firstFrame: "a.png", references: ["b.png"], seed: 1 }), /not both/);
  assert.throws(() => minimaxWorkflow({ prompt: "ok ok", seconds: 3, seed: 1 }), /4–15/);
  assert.throws(() => minimaxWorkflow({ prompt: "ok ok", seconds: 5, references: Array(10).fill("a.png"), seed: 1 }), /nine/);
});

test("the estimate follows Comfy's published MiniMax H3 rates", () => {
  assert.equal(cloudEstimate({ seconds: 6, resolution: "768P", references: 0 }), Math.round(0.1287 * 6 * 1000) / 1000);
  assert.equal(cloudEstimate({ seconds: 5, resolution: "2K", references: 0 }), Math.round(0.1859 * 5 * 1000) / 1000);
  assert.equal(cloudEstimate({ seconds: 5, resolution: "768P", references: 7 }), Math.round((0.1287 * 5 + 2 * 0.0572) * 1000) / 1000);
});

test("a run uploads pictures, submits with the partner credential, waits, downloads and keeps the video", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let polls = 0;
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (url.endsWith("/api/upload/image")) return Response.json({ name: "up_still.png" });
    if (url.endsWith("/api/prompt")) return Response.json({ prompt_id: "job-1", node_errors: {} });
    if (url.includes("/api/jobs/job-1")) {
      polls++;
      return Response.json(polls < 2 ? { status: "in_progress" } : { status: "completed", outputs: { "20": { video: [{ filename: "haggs_minimax_0001.mp4", subfolder: "", type: "output" }] } } });
    }
    if (url.includes("/api/view")) return new Response(null, { status: 302, headers: { location: "https://storage.googleapis.com/bucket/out.mp4?sig=1" } });
    if (url.startsWith("https://storage.googleapis.com/")) return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), { headers: { "content-type": "video/mp4" } });
    return new Response("unexpected", { status: 500 });
  }) as unknown as typeof fetch;
  let kept: Uint8Array | undefined;
  const cloud = createCloudProvider({ apiKey: "ck", fetch: fake, pollMs: 0, keep: async (bytes) => { kept = bytes; return "/api/local/haggs-renders/a.mp4"; } });
  const result = await cloud.run({ capability: "image-to-video", prompt: "She turns to the window", images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="], passthrough: { duration: 5, resolution: "768P" } });

  assert.deepEqual(result.assets, [{ url: "/api/local/haggs-renders/a.mp4", kind: "video" }]);
  assert.equal(kept?.length, 12);
  const submit = calls.find((c) => c.url.endsWith("/api/prompt"))!;
  const body = JSON.parse(String(submit.init?.body));
  assert.equal(body.extra_data.api_key_comfy_org, "ck", "partner nodes get the key out of band, never in the graph");
  assert.equal(body.prompt["1"].class_type, "MinimaxHailuo03FirstLastFrameNode");
  assert.equal(body.prompt["2"].inputs.image, "up_still.png");
  assert.ok(!JSON.stringify(body.prompt).includes("ck"), "the key is not in the workflow");
  const storage = calls.find((c) => c.url.startsWith("https://storage.googleapis.com/"))!;
  assert.equal(new Headers(storage.init?.headers).get("x-api-key"), null, "the key is never sent to storage");
  assert.ok(result.usd !== null && result.usd > 0);
});

test("a failed job and an untrusted redirect both stop with a reason", async () => {
  const failing = (async (url: string) => {
    if (url.endsWith("/api/prompt")) return Response.json({ prompt_id: "j", node_errors: {} });
    if (url.includes("/api/jobs/")) return Response.json({ status: "failed", execution_error: { exception_message: "nope" } });
    return new Response("{}");
  }) as unknown as typeof fetch;
  await assert.rejects(createCloudProvider({ apiKey: "k", fetch: failing, pollMs: 0, keep: async () => "x" }).run({ capability: "text-to-video", prompt: "a hill at night" }), /failed/);

  const sneaky = (async (url: string) => {
    if (url.endsWith("/api/prompt")) return Response.json({ prompt_id: "j", node_errors: {} });
    if (url.includes("/api/jobs/")) return Response.json({ status: "completed", outputs: { "20": { video: [{ filename: "a.mp4", subfolder: "", type: "output" }] } } });
    if (url.includes("/api/view")) return new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } });
    return new Response("{}");
  }) as unknown as typeof fetch;
  await assert.rejects(createCloudProvider({ apiKey: "k", fetch: sneaky, pollMs: 0, keep: async () => "x" }).run({ capability: "text-to-video", prompt: "a hill at night" }), /redirect/);
});
