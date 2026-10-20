import assert from "node:assert/strict";
import { test } from "node:test";

import { createComfyProvider } from "./comfy";
import { ProviderError, type GenerationRequest } from "./types";

type Call = { url: string; init: RequestInit | undefined };

/** A fetch that replays scripted responses and records what was asked for. */
function fakeFetch(script: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let at = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const step = script[Math.min(at++, script.length - 1)]!;
    return new Response(JSON.stringify(step.body ?? {}), {
      status: step.status ?? 200,
      headers: { "content-type": "application/json", ...(step.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const TEXT_TO_IMAGE: GenerationRequest = {
  capability: "text-to-image",
  prompt: "a wet neon alley",
};

test("submits to the model's own route with the API key", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://api.comfy.org/s", response_url: "https://api.comfy.org/r" } },
    { body: { status: "completed" } },
    { body: { images: [{ url: "https://cdn.test/a.png" }] } },
  ]);
  const comfy = createComfyProvider({
    apiKey: "comfyui-abc",
    fetch: impl,
    pollMs: 0,
    endpoints: { "text-to-image": "bfl/flux-3-image" },
  });

  await comfy.run(TEXT_TO_IMAGE);

  assert.match(calls[0]!.url, /api\.comfy\.org\/v2\/models\/bfl\/flux-3-image\/requests$/);
  const headers = new Headers(calls[0]!.init?.headers);
  assert.equal(headers.get("X-API-Key"), "comfyui-abc");
});

// Retrying a lost response must not produce a second charge, so every submit
// carries a key the server can replay against.
test("every submit carries an idempotency key", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { images: [{ url: "https://cdn.test/a.png" }] } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-image": "bfl/flux-3-image" } });
  await comfy.run(TEXT_TO_IMAGE);
  const key = new Headers(calls[0]!.init?.headers).get("Idempotency-Key");
  assert.ok(key && key.length > 8, "an idempotency key was sent");
});

test("polls until the run leaves the queue, then collects the result", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "running", queue_position: 2 } },
    { body: { status: "completed" } },
    { body: { video: { url: "https://cdn.test/a.mp4" } } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-video": "minimax/minimax-h3" } });
  const result = await comfy.run({ capability: "text-to-video", prompt: "a fox" });

  assert.equal(calls.length, 4);
  assert.deepEqual(result.assets, [{ url: "https://cdn.test/a.mp4", kind: "video" }]);
});

test("a failed run reports the status it ended on", async () => {
  const { impl } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "failed" } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-image": "bfl/flux-3-image" } });
  await assert.rejects(() => comfy.run(TEXT_TO_IMAGE), ProviderError);
});

test("an error body is surfaced rather than a bare status code", async () => {
  const { impl } = fakeFetch([{ status: 402, body: { detail: "insufficient_credits", error_type: "insufficient_credits" } }]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-image": "bfl/flux-3-image" } });
  await assert.rejects(() => comfy.run(TEXT_TO_IMAGE), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.match(error.message, /insufficient_credits/);
    return true;
  });
});

// The price before you press the button is the product's whole argument, and
// Router supports it directly rather than making us scrape a price page.
test("quote asks the estimate route and reports dollars", async () => {
  const { impl, calls } = fakeFetch([{ body: { estimated_cost_usd: 0.042 } }]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, endpoints: { "text-to-image": "bfl/flux-3-image" } });
  const quote = await comfy.quote(TEXT_TO_IMAGE);

  assert.match(calls[0]!.url, /\/v2\/models\/bfl\/flux-3-image\/estimate$/);
  assert.equal(quote.usd, 0.042);
  assert.equal(quote.provider, "comfy");
});

test("a model that will not quote reports an unknown price rather than guessing", async () => {
  const { impl } = fakeFetch([{ status: 404, body: {} }]);
  const comfy = createComfyProvider({ apiKey: "k", endpoints: { "text-to-image": "bfl/flux-3-image" }, fetch: impl });
  const quote = await comfy.quote(TEXT_TO_IMAGE);
  assert.equal(quote.usd, null);
  assert.match(quote.basis, /\S/);
});

test("images are sent as content items with a role", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { video: { url: "https://cdn.test/a.mp4" } } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "image-to-video": "minimax/minimax-h3" } });
  await comfy.run({ capability: "image-to-video", prompt: "it moves", images: ["data:image/png;base64,AAA"] });

  const body = JSON.parse(String(calls[0]!.init?.body)) as { content: Array<Record<string, unknown>> };
  assert.equal(body.content[0]!.type, "text");
  assert.equal(body.content[1]!.type, "image_url");
  assert.equal(body.content[1]!.role, "first_frame");
});

test("references without a still are all sent as reference images, none as the first frame", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { video: { url: "https://cdn.test/a.mp4" } } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-video": "minimax/minimax-h3" } });
  await comfy.run({ capability: "text-to-video", prompt: "she waits", images: ["data:a", "data:b"], firstFrame: false });
  const body = JSON.parse(String(calls[0]!.init?.body)) as { content: Array<Record<string, unknown>> };
  assert.deepEqual(body.content.slice(1).map((c) => c.role), ["reference_image", "reference_image"]);
});

test("passthrough settings reach the request body", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { images: [{ url: "https://cdn.test/a.png" }] } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-video": "minimax/minimax-h3" } });
  await comfy.run({ capability: "text-to-video", prompt: "x", passthrough: { duration: 6, resolution: "1080p" } });

  const body = JSON.parse(String(calls[0]!.init?.body)) as Record<string, unknown>;
  assert.equal(body.duration, 6);
  assert.equal(body.resolution, "1080p");
});

// Router models do not share a request shape. MiniMax H3 takes a `content`
// array; FLUX 3 and LTX take a plain `prompt` string. Sending the wrong one is
// a 400, so the shape is declared per model rather than assumed.
test("a prompt-style model receives prompt, not content", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { images: [{ url: "https://cdn.test/a.png" }] } },
  ]);
  const comfy = createComfyProvider({
    apiKey: "k",
    fetch: impl,
    pollMs: 0,
    bodyStyle: "prompt",
    endpoints: { "text-to-image": "bfl/flux-3-image" },
  });
  await comfy.run({ capability: "text-to-image", prompt: "a teapot" });

  const body = JSON.parse(String(calls[0]!.init?.body)) as Record<string, unknown>;
  assert.equal(body.prompt, "a teapot");
  assert.equal("content" in body, false);
});

test("a prompt-style model takes its images in the images field", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { images: [{ url: "https://cdn.test/a.png" }] } },
  ]);
  const comfy = createComfyProvider({
    apiKey: "k", fetch: impl, pollMs: 0, bodyStyle: "prompt",
    endpoints: { "image-edit": "bfl/flux-3-image" },
  });
  await comfy.run({ capability: "image-edit", prompt: "make it night", images: ["https://in/a.png"] });

  const body = JSON.parse(String(calls[0]!.init?.body)) as Record<string, unknown>;
  assert.deepEqual(body.images, ["https://in/a.png"]);
});

test("content style stays the default, so MiniMax H3 is unaffected", async () => {
  const { impl, calls } = fakeFetch([
    { status: 201, body: { request_id: "r1", status_url: "https://x/s", response_url: "https://x/r" } },
    { body: { status: "completed" } },
    { body: { video: { url: "https://cdn.test/a.mp4" } } },
  ]);
  const comfy = createComfyProvider({ apiKey: "k", fetch: impl, pollMs: 0, endpoints: { "text-to-video": "minimax/minimax-h3" } });
  await comfy.run({ capability: "text-to-video", prompt: "a fox" });
  const body = JSON.parse(String(calls[0]!.init?.body)) as Record<string, unknown>;
  assert.ok(Array.isArray(body.content));
});
