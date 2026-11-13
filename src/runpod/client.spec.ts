import test from "node:test";
import assert from "node:assert/strict";
import {
  createRunpodClient,
  SubmissionUnknown,
  renderSchema,
  type RenderInput,
} from "./client";
const input: RenderInput = {
  schema: "haggs.runpod/1",
  workflow: { "1": { class_type: "FixtureSave", inputs: {} } },
  files: [],
  outputNode: "1",
  executionSeconds: 60,
};
const id = "a117ed67-9355-40f1-998c-13a0d9e6a628";
test("RunPod health is authenticated, read-only and restricted to the fixed API host", async () => {
  const calls: string[] = [];
  const client = createRunpodClient({
    endpoint: "fixture-endpoint",
    key: "fixture-key-only",
    fetch: (async (url, init) => {
      calls.push(String(url));
      assert.equal(init?.method, "GET");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer fixture-key-only",
      );
      assert.equal(init?.redirect, "error");
      return Response.json({
        workers: { idle: 0, running: 0 },
        jobs: { inQueue: 0 },
      });
    }) as typeof fetch,
  });
  await client.health();
  assert.deepEqual(calls, ["https://api.runpod.ai/v2/fixture-endpoint/health"]);
  assert.throws(() =>
    createRunpodClient({
      endpoint: "https://evil.test",
      key: "fixture-key-only",
    }),
  );
});
test("one submission carries the logical request ID and bounded execution policy", async () => {
  let sent = 0;
  const client = createRunpodClient({
    endpoint: "fixture-endpoint",
    key: "fixture-key-only",
    fetch: (async (url, init) => {
      sent++;
      assert.ok(String(url).endsWith("/run"));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.input.requestId, id);
      assert.equal(body.policy.executionTimeout, 60000);
      assert.equal(body.policy.ttl, 3660000);
      assert.equal(body.input.outputNode, "1");
      return Response.json({ id: "fixture-job", status: "IN_QUEUE" });
    }) as typeof fetch,
  });
  assert.equal((await client.submit(input, id)).status, "IN_QUEUE");
  assert.equal(sent, 1);
});
test("network, 5xx and malformed acknowledgments are held, never automatically retried", async () => {
  for (const reply of [
    async () => {
      throw Error("network");
    },
    async () => new Response(null, { status: 503 }),
    async () => Response.json({ accepted: true }),
  ]) {
    let count = 0;
    const client = createRunpodClient({
      endpoint: "fixture-endpoint",
      key: "fixture-key-only",
      fetch: (async () => {
        count++;
        return reply();
      }) as typeof fetch,
    });
    await assert.rejects(client.submit(input, id), SubmissionUnknown);
    assert.equal(count, 1);
  }
});
test("failed, canceled and timed-out requests do not produce successful artifacts", async () => {
  for (const status of ["FAILED", "CANCELLED", "TIMED_OUT"]) {
    const client = createRunpodClient({
      endpoint: "fixture-endpoint",
      key: "fixture-key-only",
      fetch: (async () =>
        Response.json({
          id: "fixture-job",
          status,
          error: "upstream secret-looking detail must not echo",
        })) as typeof fetch,
    });
    const job = await client.status("fixture-job");
    assert.equal(job.status, status);
    assert.equal(job.output, undefined);
    assert.doesNotMatch(JSON.stringify(job), /secret-looking/);
  }
});
test("completed requests require a valid supported artifact contract and matching job ID", async () => {
  const good = {
    schema: "haggs.runpod-result/1",
    artifacts: [
      {
        url: "https://storage.example.test/private/video.mp4?fixture=1",
        name: "video.mp4",
        kind: "video",
        bytes: 8,
        expiresAt: Date.now() + 1000,
      },
    ],
  };
  const client = (output: unknown, jobId = "fixture-job") =>
    createRunpodClient({
      endpoint: "fixture-endpoint",
      key: "fixture-key-only",
      fetch: (async () =>
        Response.json({
          id: jobId,
          status: "COMPLETED",
          output,
        })) as typeof fetch,
    });
  assert.equal(
    (await client(good).status("fixture-job")).output?.artifacts[0]?.kind,
    "video",
  );
  await assert.rejects(client({ artifacts: [] }).status("fixture-job"));
  await assert.rejects(
    client(good, "other-job").status("fixture-job"),
    /different job ID/,
  );
});
test("API workflows, filenames, unique uploads and output-node presence validate before submission", () => {
  assert.equal(renderSchema.parse(input).outputNode, "1");
  assert.throws(() => renderSchema.parse({ ...input, outputNode: "absent" }));
  assert.throws(() =>
    renderSchema.parse({
      ...input,
      files: [{ name: "../secret", data: "AAAA" }],
    }),
  );
  assert.throws(() =>
    renderSchema.parse({
      ...input,
      files: [{ name: "plugin.py", data: "AAAA" }],
    }),
  );
  assert.throws(() => renderSchema.parse({ ...input, executionSeconds: 0 }));
});
