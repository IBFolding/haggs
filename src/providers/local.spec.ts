import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalRunner, localBase } from "./local";

test("a local ComfyUI address is a loopback or private-network origin, nothing else", () => {
  assert.equal(localBase("127.0.0.1:8188"), "http://127.0.0.1:8188");
  assert.equal(localBase("http://localhost:8188/"), "http://localhost:8188");
  assert.equal(localBase("http://192.168.1.20:8188"), "http://192.168.1.20:8188");
  assert.equal(localBase("http://10.0.0.5:8188/anything?x=1"), "http://10.0.0.5:8188");
  for (const bad of ["https://cloud.comfy.org", "http://example.com:8188", "http://169.254.169.254", "http://user:pw@127.0.0.1:8188", "file:///etc/passwd", "", "http://8.8.8.8:8188", "ftp://127.0.0.1"]) {
    assert.throws(() => localBase(bad), /ComfyUI|address/i, bad);
  }
});

function server() {
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    calls.push(`${init?.method ?? "GET"} ${u.pathname}`);
    if (u.pathname === "/upload/image") return Response.json({ name: "haggs_1.png" });
    if (u.pathname === "/prompt") return Response.json({ prompt_id: "p1", node_errors: {} });
    if (u.pathname === "/history/p1") return Response.json({ p1: { status: { completed: true, status_str: "success" }, outputs: { "20": { images: [{ filename: "out_0001.png", subfolder: "", type: "output" }] } } } });
    if (u.pathname === "/view") return new Response(new Uint8Array([1, 2, 3]));
    return new Response("no", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test("a workflow runs on your own ComfyUI: upload, queue, wait, keep, with no key sent", async () => {
  const { fetchImpl, calls } = server();
  let sentHeaders: unknown;
  const wrapped = ((url: string, init?: RequestInit) => ((sentHeaders = init?.headers), fetchImpl(url, init))) as typeof fetch;
  const kept: string[] = [];
  const runner = createLocalRunner({ base: "http://127.0.0.1:8188", fetch: wrapped, pollMs: 1, keep: async (b, ext) => (kept.push(`${b.length}.${ext}`), "/api/local/x.png") });
  assert.equal(await runner.uploadBytes(new Uint8Array([9]), "image/png"), "haggs_1.png");
  const out = await runner.run({ "20": { class_type: "SaveImage", inputs: {} } });
  assert.deepEqual(out, { url: "/api/local/x.png", kind: "image", jobId: "p1" });
  assert.deepEqual(kept, ["3.png"]);
  assert.ok(calls.includes("POST /prompt") && calls.includes("GET /history/p1"));
  assert.ok(!JSON.stringify(sentHeaders ?? {}).toLowerCase().includes("api-key"));
});

test("a workflow your ComfyUI rejects says what it rejected", async () => {
  const fetchImpl = (async (url: string) => (new URL(url).pathname === "/prompt" ? Response.json({ error: { message: "Prompt outputs failed validation" }, node_errors: { "3": { errors: [{ message: "Value not in list: unet_name" }] } } }, { status: 400 }) : new Response("", { status: 404 }))) as typeof fetch;
  const runner = createLocalRunner({ base: "http://127.0.0.1:8188", fetch: fetchImpl, pollMs: 1, keep: async () => "" });
  await assert.rejects(() => runner.run({}), /Value not in list: unet_name/);
});
