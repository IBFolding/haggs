import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { clearFinished, dismiss, jobs, reset, runningCount, track, unseenCount, markSeen } from "./activity";

describe("activity", () => {
  beforeEach(() => reset());

  it("shows a job while it runs and keeps it when it finishes", async () => {
    let finish!: (v: string) => void;
    const done = track({ label: "Rendering Marlow" }, new Promise<string>((r) => (finish = r)));
    assert.equal(runningCount(), 1);
    assert.equal(jobs()[0]?.state, "running");
    finish("ok");
    assert.equal(await done, "ok");
    assert.equal(runningCount(), 0);
    assert.equal(jobs()[0]?.state, "done");
    assert.equal(unseenCount(), 1);
  });

  it("hands back the file a job made so the header can offer it", async () => {
    await track({ label: "Render", result: (v: { url: string }) => ({ url: v.url }) }, Promise.resolve({ url: "/film.mp4" }));
    assert.equal(jobs()[0]?.url, "/film.mp4");
  });

  it("marks a job failed when it throws, or when the result says it did not work", async () => {
    await assert.rejects(track({ label: "A" }, Promise.reject(new Error("no key"))), /no key/);
    await track({ label: "B", failure: (v: { ok: boolean; reason?: string }) => (v.ok ? null : (v.reason ?? "Failed")) }, Promise.resolve({ ok: false, reason: "Out of credits" }));
    const [b, a] = jobs();
    assert.equal(b?.state, "failed");
    assert.equal(b?.note, "Out of credits");
    assert.equal(a?.state, "failed");
    assert.equal(a?.note, "no key");
  });

  it("keeps the newest first, dismisses one, and clears the finished but never the running", async () => {
    await track({ label: "one" }, Promise.resolve(1));
    await track({ label: "two" }, Promise.resolve(2));
    assert.deepEqual(jobs().map((j) => j.label), ["two", "one"]);
    let finish!: () => void;
    const slow = track({ label: "slow" }, new Promise<void>((r) => (finish = r)));
    dismiss(jobs()[1]!.id);
    assert.equal(jobs().length, 2);
    clearFinished();
    assert.deepEqual(jobs().map((j) => j.label), ["slow"]);
    finish();
    await slow;
  });

  it("counts only what you haven't looked at, and keeps at most twelve", async () => {
    await track({ label: "x" }, Promise.resolve());
    markSeen();
    assert.equal(unseenCount(), 0);
    for (let i = 0; i < 20; i++) await track({ label: `j${i}` }, Promise.resolve());
    assert.equal(jobs().length, 12);
  });

  it("runs the after hook once on success, never on failure, and a throwing hook doesn't fail the run", async () => {
    let kept = 0;
    await track({ label: "ok", after: () => void (kept += 1) }, Promise.resolve(1));
    await track({ label: "bad hook", after: () => { throw new Error("disk full"); } }, Promise.resolve(1));
    await track({ label: "reported", failure: () => "no", after: () => void (kept += 10) }, Promise.resolve(1));
    assert.equal(kept, 1);
    assert.equal(jobs().find((j) => j.label === "bad hook")?.state, "done");
  });
});
