import assert from "node:assert/strict";
import test from "node:test";
import { plan, syncProjects, type Remote } from "./cloud-sync";
import { memoryKv } from "./kv";
import { createProject, type Project } from "./model";
import { createProjectStore } from "./store";

test("the newer copy wins, and a new project goes to the other side", () => {
  const p = plan([{ id: "a", updatedAt: 5 }, { id: "b", updatedAt: 9 }, { id: "n", updatedAt: 1 }], [{ id: "a", updatedAt: 7 }, { id: "b", updatedAt: 2 }, { id: "r", updatedAt: 3 }], []);
  assert.deepEqual(p.pull.sort(), ["a", "r"]);
  assert.deepEqual(p.push.sort(), ["b", "n"]);
  assert.deepEqual(p.removeRemote, []);
});

test("a project deleted here is deleted from the account; one missing from the account is uploaded again, never deleted here", () => {
  const p = plan([{ id: "x", updatedAt: 1 }], [{ id: "y", updatedAt: 1 }], ["x", "y"]);
  assert.deepEqual(p.removeRemote, ["y"]);
  assert.deepEqual(p.push, ["x"]);
  assert.deepEqual(p.pull, []);
});

function fakeRemote() {
  const rows = new Map<string, { project: Project; sheets: string | null }>();
  const remote: Remote = {
    list: async () => [...rows.values()].map((r) => ({ id: r.project.id, updatedAt: r.project.updatedAt })),
    get: async (id) => rows.get(id) ?? null,
    put: async (project, sheets) => void rows.set(project.id, { project, sheets }),
    remove: async (id) => void rows.delete(id),
  };
  return { rows, remote };
}

test("two devices end up with the same projects, keeping each project's own time", async () => {
  const { rows, remote } = fakeRemote();
  const kv1 = memoryKv(), kv2 = memoryKv();
  const a = createProjectStore(kv1), b = createProjectStore(kv2);
  const p = createProject("Waylight");
  await a.save(p);
  await kv1.set(`sheets/${p.id}`, "{\"scenes\":1}");
  const r1 = await syncProjects(kv1, a, remote);
  assert.equal(r1.pushed, 1);
  const r2 = await syncProjects(kv2, b, remote);
  assert.equal(r2.pulled, 1);
  const got = (await b.list())[0]!;
  assert.equal(got.name, "Waylight");
  assert.equal(got.updatedAt, rows.get(p.id)!.project.updatedAt, "pulled, not re-stamped");
  assert.equal(await kv2.get(`sheets/${p.id}`), "{\"scenes\":1}");
  const again = await syncProjects(kv2, b, remote);
  assert.deepEqual([again.pushed, again.pulled], [0, 0], "nothing left to do");
});

test("deleting on one device removes it from the account, and the other device keeps its copy", async () => {
  const { rows, remote } = fakeRemote();
  const kv1 = memoryKv(), kv2 = memoryKv();
  const a = createProjectStore(kv1), b = createProjectStore(kv2);
  const p = createProject("Gone");
  await a.save(p);
  await syncProjects(kv1, a, remote);
  await syncProjects(kv2, b, remote);
  await a.remove(p.id);
  await syncProjects(kv1, a, remote);
  assert.equal(rows.size, 0);
  await syncProjects(kv2, b, remote);
  assert.equal((await b.list()).length, 1, "the other device is never emptied by a sync");
});

test("a project too big for the account is skipped and reported, not lost", async () => {
  const { rows, remote } = fakeRemote();
  const kv = memoryKv();
  const s = createProjectStore(kv);
  const big = { ...createProject("Huge"), media: [{ blob: "x".repeat(5 * 1024 * 1024) }] } as unknown as Project;
  await s.save(big);
  const r = await syncProjects(kv, s, remote);
  assert.deepEqual(r.skipped, ["Huge"]);
  assert.equal(rows.size, 0);
  assert.equal((await s.list()).length, 1);
});
