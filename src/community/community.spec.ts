import assert from "node:assert/strict";
import { test } from "node:test";

import { chargeRun, listApps, publishApp, refundRun, type Db } from "./community";

function fake(over: Partial<Db> = {}) {
  const calls: { op: string; args: unknown[] }[] = [];
  const db: Db = {
    insert: async (table, row) => (calls.push({ op: "insert:" + table, args: [row] }), { data: { id: "app-1", ...row }, error: null }),
    select: async (table, opts) => (calls.push({ op: "select:" + table, args: [opts] }), { data: [{ id: "a", name: "Rooftop", description: "", creator_name: "Pat", fee_cents: 5, runs: 3, cover_url: null, cover_kind: null, workflow: "{}", recipe: null }], error: null }),
    rpc: async (fn, args) => (calls.push({ op: "rpc:" + fn, args: [args] }), { data: { run: "run-1", fee_cents: 5 }, error: null }),
    ...over,
  };
  return { db, calls };
}

const app = { id: "x", name: "Rooftop", description: "Dance swap", workflow: "{}", createdAt: 1, updatedAt: 1 };

test("publishing sends the app with a checked fee and the creator's name", async () => {
  const { db, calls } = fake();
  await publishApp(db, app, 8, "Pat");
  const row = calls[0]!.args[0] as Record<string, unknown>;
  assert.equal(row.fee_cents, 8);
  assert.equal(row.creator_name, "Pat");
  assert.equal(row.name, "Rooftop");
});

test("a fee above 12 cents is refused before anything is sent", async () => {
  const { db, calls } = fake();
  await assert.rejects(() => publishApp(db, app, 13, "Pat"), /up to 12¢/);
  assert.equal(calls.length, 0);
});

test("the shelf lists published apps with their fee and runs", async () => {
  const { db } = fake();
  const [one] = await listApps(db);
  assert.equal(one!.feeCents, 5);
  assert.equal(one!.runs, 3);
  assert.equal(one!.creatorName, "Pat");
});

test("charging a run returns the run id and fee; a database refusal becomes the reason", async () => {
  const { db } = fake();
  assert.deepEqual(await chargeRun(db, "a"), { run: "run-1", feeCents: 5 });
  const broke = fake({ rpc: async () => ({ data: null, error: { message: "Not enough haggs credits for this app's 5¢ fee." } }) });
  await assert.rejects(() => chargeRun(broke.db, "a"), /Not enough haggs credits/);
});

test("a failed run is refunded through the database", async () => {
  const { db, calls } = fake();
  await refundRun(db, "run-1");
  assert.equal(calls[0]!.op, "rpc:refund_app_run");
});
