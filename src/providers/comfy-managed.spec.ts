import test from "node:test";
import assert from "node:assert/strict";
import { createComfyManaged } from "./comfy-managed";

const keep = async (_bytes: Uint8Array, ext: string) => `kept.${ext}`;

test("managed calls remain disabled before network access when no enforceable spend limit exists", async () => {
  let calls = 0;
  const api = createComfyManaged({ base: "https://example.run.comfy.app", apiKey: "secret", keep, fetch: async () => { calls++; throw Error("unexpected"); } });
  await assert.rejects(api.upload(new Uint8Array([1]), "image/png"), /spending limit/);
  await assert.rejects(api.submit({}), /spending limit/);
  assert.equal(calls, 0);
});

test("rejects unsafe endpoints and external job links before sending a credential", async () => {
  assert.throws(() => createComfyManaged({ base: "https://run.comfy.app.evil.test", apiKey: "secret", keep }), /Unsupported/);
  const api = createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, apiKey: "secret", keep, fetch: async () => Response.json({ id: "job-1", urls: { self: "https://evil.test/job" } }, { status: 201 }) });
  await assert.rejects(api.submit({}), /unsafe URL/);
});

test("an uncertain submission carries its reference and is never retried automatically", async () => {
  let calls = 0;
  const api = createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, keep, fetch: async () => { calls++; throw new Error("timeout"); } });
  await assert.rejects(api.submit({}, "submission-1"), /outcome unknown.*submission-1/);
  assert.equal(calls, 1);
});

test("upload, poll and save use same-origin URLs and preserve the output", async () => {
  let checks = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/assets") && init?.method === "POST") return Response.json({ id: "asset-1" });
    if (url.endsWith("/jobs") && init?.method === "POST") return Response.json({ id: "job-1", urls: { self: "/api/v2/jobs/job-1" } }, { status: 201 });
    if (url.endsWith("/jobs/job-1")) return Response.json({ id: "job-1", status: ++checks === 1 ? "running" : "succeeded", outputs: [{ node_id: "5", content_type: "video/mp4", url: "/api/v2/assets/out/content" }] });
    if (url.endsWith("/assets/out/content")) return new Response(new Uint8Array([1, 2, 3]));
    throw new Error("unexpected URL");
  };
  const api = createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, keep, fetch: fetcher, pollMs: 1 });
  const asset = await api.upload(new Uint8Array([7]), "video/mp4");
  assert.deepEqual(asset, { __type: "core/ASSET", info: { id: "asset-1" } });
  const job = await api.submit({ "1": { class_type: "LoadVideo", inputs: { file: asset } } });
  assert.deepEqual(await api.result(job, "5"), { url: "kept.mp4", kind: "video", jobId: "job-1" });
});

test("failed storage reports the completed job for recovery instead of rerunning", async () => {
  let calls = 0;
  const api = createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, keep: async () => { throw new Error("disk full"); }, fetch: async (input) => {
    calls++;
    return String(input).endsWith("/content") ? new Response(new Uint8Array([1])) : Response.json({ id: "job-1", status: "succeeded", outputs: [{ node_id: "5", content_type: "video/mp4", url: "/api/v2/assets/out/content" }] });
  } });
  await assert.rejects(api.result({ id: "job-1", urls: { self: "/api/v2/jobs/job-1" } }, "5"), /job job-1 succeeded.*Recover/);
  assert.equal(calls, 2);
});

test("signed output redirects are allowed only to configured HTTPS hosts and never receive the bearer token", async () => {
  let signedCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/jobs/job-1")) return Response.json({ id: "job-1", status: "succeeded", outputs: [{ node_id: "5", content_type: "video/mp4", url: "/api/v2/assets/out/content" }] });
    if (url.endsWith("/content")) { assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret"); return new Response(null, { status: 302, headers: { location: "https://storage.example/signed?signature=private" } }); }
    signedCalls++; assert.equal(new Headers(init?.headers).get("authorization"), null); assert.equal(init?.redirect, "error");
    return new Response(new Uint8Array([1, 2]));
  };
  const config = { base: "http://127.0.0.1:8198", localTest: true, apiKey: "secret", keep, fetch: fetcher };
  const job = { id: "job-1", urls: { self: "/api/v2/jobs/job-1" } };
  await assert.rejects(createComfyManaged(config).result(job, "5"), /Recover/);
  assert.equal(signedCalls, 0);
  const result = await createComfyManaged({ ...config, outputHosts: ["storage.example"] }).result(job, "5");
  assert.equal(result.url, "kept.mp4"); assert.equal(signedCalls, 1);
});

test("output streaming stops at the configured size limit", async () => {
  let saved = false;
  const api = createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, maxOutputBytes: 2, keep: async () => { saved = true; return "saved"; }, fetch: async (input) => String(input).endsWith("/content") ? new Response(new Uint8Array([1, 2, 3])) : Response.json({ id: "job-1", status: "succeeded", outputs: [{ node_id: "5", content_type: "video/mp4", url: "/api/v2/assets/out/content" }] }) });
  await assert.rejects(api.result({ id: "job-1", urls: { self: "/api/v2/jobs/job-1" } }, "5"), /Recover/);
  assert.equal(saved, false);
});

test("managed recovery uses a server-sent reference and refuses ambiguous matches", async () => {
  let calls = 0;
  const api = createComfyManaged({ base: "https://example.run.comfy.app", apiKey: "secret", keep, fetch: async (input, init) => {
    calls++; assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret");
    if (String(input).endsWith("/jobs/job-1")) return Response.json({ id: "job-1", metadata: { haggs_ref: "ref-1" }, urls: { self: "/api/v2/jobs/job-1" } });
    assert.match(String(input), /metadata%5Bhaggs_ref%5D=ref-1/);
    return Response.json({ jobs: [{ id: "job-1", metadata: { haggs_ref: "ref-1" } }], next_cursor: null });
  } });
  assert.equal((await api.findByReference("ref-1"))?.id, "job-1");
  assert.equal(calls, 2);
  const duplicate = createComfyManaged({ base: "https://example.run.comfy.app", apiKey: "secret", keep, fetch: async () => Response.json({ jobs: [{ metadata: { haggs_ref: "ref-1" } }, { metadata: { haggs_ref: "ref-1" } }] }) });
  await assert.rejects(duplicate.findByReference("ref-1"), /Multiple jobs/);
});

test("production cannot enable the loopback test path", () => {
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(() => createComfyManaged({ base: "http://127.0.0.1:8198", localTest: true, keep }), /Unsupported/);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
  }
});
