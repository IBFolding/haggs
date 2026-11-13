import test from "node:test";
import assert from "node:assert/strict";
import { submitOnce, type Intent, type Journal } from "./journal";
const record = (): Intent => ({
  id: crypto.randomUUID(),
  connection: "fixture-connection",
  owner: "fixture-owner",
  endpoint: "fixture-endpoint",
  hash: "fixture-input-hash",
  state: "SUBMITTING",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
function memoryJournal() {
  const values = new Map<string, Intent>();
  const journal: Journal = {
    async claim(intent) {
      const old = values.get(intent.id);
      if (old) return { created: false, intent: old };
      values.set(intent.id, structuredClone(intent));
      return { created: true, intent };
    },
    async get(id) {
      return values.get(id);
    },
    async put(intent) {
      values.set(intent.id, structuredClone(intent));
    },
  };
  return journal;
}
test("durable claim precedes submission; repeated/concurrent calls submit once", async () => {
  const journal = memoryJournal(),
    intent = record();
  let count = 0;
  const submit = async () => {
    count++;
    assert.equal((await journal.get(intent.id))?.state, "SUBMITTING");
    return { id: "fixture-job", status: "IN_QUEUE" as const };
  };
  await Promise.all([
    submitOnce(journal, intent, submit),
    submitOnce(journal, intent, submit),
  ]);
  assert.equal(count, 1);
  const restored = await submitOnce(journal, intent, submit);
  assert.equal(count, 1);
  assert.equal(restored.job?.id, "fixture-job");
});
test("ambiguous submission remains held across reload and is not resubmitted", async () => {
  const journal = memoryJournal(),
    intent = record();
  let count = 0;
  const result = await submitOnce(journal, intent, async () => {
    count++;
    throw Error("socket lost after acceptance");
  });
  assert.equal(result.state, "SUBMISSION_UNKNOWN");
  const again = await submitOnce(journal, intent, async () => {
    count++;
    return { id: "new-job", status: "IN_QUEUE" };
  });
  assert.equal(again.state, "SUBMISSION_UNKNOWN");
  assert.equal(count, 1);
});
test("a reservation failure sends no request and an ID cannot be reused for another workflow", async () => {
  const intent = record();
  let count = 0;
  const broken: Journal = {
    async claim() {
      throw Error("database unavailable");
    },
    async get() {
      return undefined;
    },
    async put() {},
  };
  await assert.rejects(
    submitOnce(broken, intent, async () => {
      count++;
      return { id: "job", status: "IN_QUEUE" };
    }),
  );
  assert.equal(count, 0);
  const journal = memoryJournal();
  await journal.claim(intent);
  await assert.rejects(
    submitOnce(journal, { ...intent, hash: "different" }, async () => {
      count++;
      return { id: "job", status: "IN_QUEUE" };
    }),
    /different connection or input/,
  );
  assert.equal(count, 0);
});

import { SubmissionRejected } from "./client";
test("a definite API rejection can be distinguished from unknown acceptance without retrying", async () => {
  const journal = memoryJournal(),
    intent = record();
  let calls = 0;
  const result = await submitOnce(journal, intent, async () => {
    calls++;
    throw new SubmissionRejected(401);
  });
  assert.equal(result.state, "REJECTED");
  assert.equal(calls, 1);
});
