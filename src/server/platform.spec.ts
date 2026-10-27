import assert from "node:assert/strict";
import test from "node:test";
import { decide, type Deps } from "./platform";

function deps(over: Partial<Deps> = {}) {
  const log: string[] = [];
  const d: Deps = {
    own: undefined,
    user: { id: "u1", email: "a@b.c" },
    platformKey: "platform-key",
    subscribed: async () => true,
    spend: async (c, m, r) => (log.push(`spend ${c} ${r}`), true),
    refund: async (r) => void log.push(`refund ${r}`),
    ref: () => "ref1",
    ...over,
  };
  return { d, log };
}
const NEED = "Add a Comfy key.";

test("your own key always wins, and nothing is charged", async () => {
  const { d, log } = deps({ own: "mine" });
  const a = await decide(d, 0.52, "clip", NEED);
  assert.deepEqual([a.ok && a.key, a.ok && a.platform], ["mine", false]);
  assert.deepEqual(log, []);
});

test("with the platform off, no key means asking for one", async () => {
  const a = await decide(deps({ platformKey: undefined }).d, 0.1, "x", NEED);
  assert.deepEqual(a, { ok: false, reason: NEED, needsKey: true });
});

test("the platform key is for people who are signed in and have credits, plan or not", async () => {
  const a = await decide(deps({ user: null }).d, 0.1, "x", NEED);
  assert.ok(!a.ok && /Sign in/.test(a.reason));
  const { d, log } = deps({ subscribed: async () => false });
  const b = await decide(d, 0.1, "x", NEED);
  assert.ok(b.ok && b.platform, "credits bought without a plan are enough");
  assert.deepEqual(log, ["spend 10 ref1"]);
});

test("a run on the platform is paid for in credits before it starts", async () => {
  const { d, log } = deps();
  const a = await decide(d, 0.0686, "picture", NEED);
  assert.ok(a.ok && a.platform && a.key === "platform-key");
  assert.deepEqual(log, ["spend 7 ref1"]);
});

test("not enough credits stops the run before the platform key is used", async () => {
  const { d } = deps({ spend: async () => false });
  const a = await decide(d, 0.52, "clip", NEED);
  assert.ok(!a.ok && /Not enough credits.*52/.test(a.reason) && /Buy credits/.test(a.reason));
});

test("a run that did not complete gets its credits back, once; one that did keeps them spent", async () => {
  const failed = deps();
  const a = await decide(failed.d, 0.52, "clip", NEED);
  assert.ok(a.ok);
  await a.settle(false);
  await a.settle(false);
  assert.deepEqual(failed.log, ["spend 52 ref1", "refund ref1"]);
  const fine = deps();
  const b = await decide(fine.d, 0.52, "clip", NEED);
  assert.ok(b.ok);
  await b.settle(true);
  assert.deepEqual(fine.log, ["spend 52 ref1"]);
});

test("when the studio is gated, your own key runs only on the Platform plan, and the owner's list runs free", async () => {
  const gate = (free: string[]): NonNullable<Deps["gate"]> => async (user) => (free.includes(user?.email ?? "") ? null : !user ? "Sign in." : "Pick the Platform plan.");
  const a = await decide(deps({ own: "mine", gate: gate([]) }).d, 0.1, "x", NEED);
  assert.ok(!a.ok && /Platform plan/.test(a.reason), "a key without the plan is turned away");
  const b = await decide(deps({ own: "mine", user: null, gate: gate([]) }).d, 0.1, "x", NEED);
  assert.deepEqual(b, { ok: false, reason: "Sign in.", needsKey: true });
  const c = await decide(deps({ own: "mine", gate: gate(["a@b.c"]) }).d, 0.1, "x", NEED);
  assert.ok(c.ok);
});

test('storage preflight happens before credits or submission, and failed funding releases the hold',async()=>{
 const blocked=deps({prepareStorage:async()=>{throw Error('Storage full');}});
 await assert.rejects(decide(blocked.d,.12,'clip',NEED),/Storage full/);assert.deepEqual(blocked.log,[]);
 const released:string[]=[];
 const poor=deps({prepareStorage:async()=>({id:'hold',userId:'u1',maxBytes:100,saved:false}),releaseStorage:async hold=>{released.push(hold.id);},spend:async()=>false});
 assert.equal((await decide(poor.d,.12,'clip',NEED)).ok,false);assert.deepEqual(released,['hold']);
});

test('a successful run releases a storage hold its output did not use, and keeps one it did',async()=>{
 const released:string[]=[];
 const hold=()=>({id:'hold',userId:'u1',maxBytes:100,saved:false});
 const unused=deps({prepareStorage:async()=>hold(),releaseStorage:async h=>{released.push(h.id);}});
 const a=await decide(unused.d,.12,'clip',NEED);assert.ok(a.ok);await a.settle(true);await a.settle(true);
 assert.deepEqual(released,['hold']);
 const used=deps({prepareStorage:async()=>hold(),releaseStorage:async h=>{released.push('again:'+h.id);}});
 const b=await decide(used.d,.12,'clip',NEED);assert.ok(b.ok);b.storage!.saved=true;await b.settle(true);
 assert.deepEqual(released,['hold']);
});
