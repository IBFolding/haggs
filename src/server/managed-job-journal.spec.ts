import test from "node:test";
import assert from "node:assert/strict";
import { recoverJournaled, submitJournaled, type Journal, type JournalEntry } from "./managed-job-journal";

function memoryJournal(): Journal {
  const entries = new Map<string, JournalEntry>();
  return {
    async begin(entry) { if (entries.has(entry.submissionId)) return false; entries.set(entry.submissionId, { ...entry }); return true; },
    async accept(user, ref, id, url) { const e = entries.get(ref); if (!e || e.userId !== user || e.state !== "dispatching") return false; entries.set(ref, { ...e, state: "accepted", jobId: id, jobUrl: url }); return true; },
    async read(user, ref) { const e = entries.get(ref); return e?.userId === user ? e : null; },
  };
}
const entry: JournalEntry = { submissionId: "a5a9b26a-2063-4548-994d-0c7eb076b766", userId: "owner", deployment: "https://my-deployment.run.comfy.app", outputNode: "5", state: "dispatching" };
const providerJob = { id: "job-1", urls: { self: "/api/v2/jobs/job-1" } };

test("concurrent duplicate submission reserves only once", async () => {
  const journal = memoryJournal(); let dispatched = 0;
  const send = async () => { dispatched++; return providerJob; };
  const results = await Promise.allSettled([submitJournaled(entry, journal, send), submitJournaled(entry, journal, send)]);
  assert.equal(dispatched, 1); assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const recovered = await recoverJournaled("owner", entry.submissionId, journal, async () => { throw Error("should not list"); });
  assert.equal(recovered.id, "job-1");
  await assert.rejects(recoverJournaled("other-user", entry.submissionId, journal, async () => providerJob), /not found/);
});

test("an uncertain submit remains recoverable and is never submitted again", async () => {
  const journal = memoryJournal(); let dispatched = 0;
  await assert.rejects(submitJournaled(entry, journal, async () => { dispatched++; throw Error("network timeout"); }));
  await assert.rejects(submitJournaled(entry, journal, async () => { dispatched++; return providerJob; }), /recover/);
  await assert.rejects(recoverJournaled("owner", entry.submissionId, journal, async () => null), /unknown.*do not resubmit/);
  const recovered = await recoverJournaled("owner", entry.submissionId, journal, async () => providerJob);
  assert.equal(recovered.id, "job-1"); assert.equal(dispatched, 1);
});

test("a provider cannot bind an external or mismatched job URL", async () => {
  const journal = memoryJournal();
  await assert.rejects(submitJournaled(entry, journal, async () => ({ id: "job-1", urls: { self: "https://evil.test/api/v2/jobs/job-1" } })), /invalid.*Do not resubmit/);
  await assert.rejects(recoverJournaled("owner", entry.submissionId, journal, async () => ({ id: "job-1", urls: { self: "/api/v2/jobs/job-2" } })), /invalid.*Do not resubmit/);
});

test('concurrent recovery accepts the same already-recorded job without another submission', async () => {
  const journal=memoryJournal();
  assert.equal(await journal.begin(entry),true);
  const results=await Promise.all([recoverJournaled('owner',entry.submissionId,journal,async()=>providerJob),recoverJournaled('owner',entry.submissionId,journal,async()=>providerJob)]);
  assert.deepEqual(results.map(result=>result.id),['job-1','job-1']);
});
