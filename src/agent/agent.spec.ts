import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { makeAgentToken } from "./token";
import { proposalFromRow } from "./proposal";
import { agentMode, createAgentStore } from "../server/agent-remote";

test("agent tokens use 32 random bytes and only the SHA-256 digest is stored", async () => {
  const a = await makeAgentToken(), b = await makeAgentToken();
  assert.match(a.token, /^hgs_[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(a.token.slice(4), "base64url").length, 32);
  assert.notEqual(a.token, b.token);
  assert.equal(a.token_hash, createHash("sha256").update(a.token).digest("hex"));
});
test("inbox rows map optional board and format and reject invalid envelopes", () => {
  const row = { id: "p", kind: "breakdown", summary: "Review", payload: { beats: [] }, board: "b", format_id: "short", created_at: "2026-10-29T00:00:00Z" };
  assert.deepEqual(proposalFromRow(row), { id: "p", kind: "breakdown", summary: "Review", payload: row.payload, boardId: "b", formatId: "short", at: Date.parse(row.created_at) });
  assert.ok(!("boardId" in proposalFromRow({ ...row, board: null })));
  assert.throws(() => proposalFromRow({ ...row, kind: "execute" }));
  assert.throws(() => proposalFromRow({ ...row, created_at: "bad" }));
});
test("live RPCs carry the token in the body, map projects, and send addressed proposals", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return Response.json(String(url).endsWith("projects") ? [{ project_id: "p", project_name: "Film" }] : String(url).endsWith("project") ? [{ data: { id: "p" }, sheets: null }] : "proposal-id");
  }) as typeof fetch;
  const store = createAgentStore("/unused", { HAGGS_TOKEN: "test-token", HAGGS_SUPABASE_URL: "https://example.test", HAGGS_SUPABASE_KEY: "public" }, fake);
  assert.deepEqual(await store.list(), [{ id: "p", name: "Film" }]);
  assert.deepEqual(await store.load("p"), { project: { id: "p" }, sheets: null });
  const made = await store.propose("p", { kind: "breakdown", summary: "Review", payload: {}, boardId: "b" });
  assert.equal(made.id, "proposal-id");
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)), { project: "p", board: "b", kind: "breakdown", summary: "Review", payload: {}, format_id: null, token: "test-token" });
  assert.deepEqual(calls[0]!.init.headers, { apikey: "public", "Content-Type": "application/json" });
  assert.equal(calls[0]!.url, "https://example.test/rest/v1/rpc/agent_projects");
  await assert.rejects(store.inbox("p"), /cannot read the inbox/);
});
test("remote errors reach Claude unchanged and missing configuration does not fall back locally", async () => {
  const fake = (async () => Response.json({ message: "That agent token is not valid." }, { status: 401 })) as typeof fetch;
  const store = createAgentStore("/unused", { HAGGS_TOKEN: "x", NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public" }, fake);
  await assert.rejects(store.list(), { message: "That agent token is not valid." });
  assert.throws(() => createAgentStore("/unused", { HAGGS_TOKEN: "x" }), /Set HAGGS/);
  assert.equal(agentMode({}), "local"); assert.equal(agentMode({ HAGGS_TOKEN: "x" }), "live");
});

test("without HAGGS_TOKEN the filesystem bridge still lists, reads and proposes", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { writeSnapshot } = await import("../server/bridge");
  const { createProject } = await import("../story/model");
  const root = await mkdtemp(join(tmpdir(), "haggs-agent-test-"));
  try {
    const project = createProject("Local film");
    await writeSnapshot(root, { project, sheets: null });
    const store = createAgentStore(root, {}, (async () => { throw new Error("Local mode must not fetch"); }) as typeof fetch);
    assert.equal((await store.list())[0]!.id, project.id);
    assert.equal((await store.load(project.id))!.project.name, "Local film");
    const made = await store.propose(project.id, { kind: "breakdown", summary: "Review", payload: {} });
    assert.equal((await store.inbox(project.id))[0]!.id, made.id);
  } finally { await rm(root, { recursive: true, force: true }); }
});
