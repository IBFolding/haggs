import assert from "node:assert/strict";
import test from "node:test";
import { plan, syncProjects, type Portable, type Remote } from "./cloud-sync";
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

function projectWithFiles(name: string, files: string[]): Project {
  return { ...createProject(name), shots: files.map((f, i) => ({ id: `s${i}`, picture: f })) } as unknown as Project;
}

test("files on this machine go to the account and the account copy points at them; the local copy is left alone", async () => {
  const { rows, remote } = fakeRemote();
  const kv = memoryKv();
  const s = createProjectStore(kv);
  const p = projectWithFiles("Waylight", ["/api/local/a.png", "/api/local/b.mp4"]);
  await s.save(p);
  await kv.set(`sheets/${p.id}`, JSON.stringify({ look: "/api/local/a.png" }));
  const kept: string[] = [];
  const portable: Portable = { keep: async (url) => (kept.push(url), `https://store.test/${url.split("/").pop()}`) };
  await syncProjects(kv, s, remote, portable);
  const sent = JSON.stringify(rows.get(p.id)!.project);
  assert.ok(sent.includes("https://store.test/a.png") && sent.includes("https://store.test/b.mp4") && !sent.includes("/api/local/"));
  assert.equal(rows.get(p.id)!.sheets, JSON.stringify({ look: "https://store.test/a.png" }));
  assert.ok(JSON.stringify(await s.load(p.id)).includes("/api/local/a.png"), "this machine still plays its own files");
  await syncProjects(kv, s, remote, portable);
  assert.deepEqual(kept.sort(), ["/api/local/a.png", "/api/local/b.mp4"], "each file is uploaded once");
});

test("a big project finishes over several rounds, and what is not copied yet is re-sent until it is", async () => {
  const { rows, remote } = fakeRemote();
  const kv = memoryKv();
  const s = createProjectStore(kv);
  const p = projectWithFiles("Big", ["/api/local/1.png", "/api/local/2.png", "/api/local/3.png"]);
  await s.save(p);
  const portable: Portable = { perRound: 2, keep: async (url) => `https://store.test/${url.split("/").pop()}` };
  await syncProjects(kv, s, remote, portable);
  assert.equal(JSON.stringify(rows.get(p.id)!.project).match(/\/api\/local\//g)?.length, 1, "one file still to go");
  await syncProjects(kv, s, remote, portable);
  assert.ok(!JSON.stringify(rows.get(p.id)!.project).includes("/api/local/"), "finished on the next round");
});

test("a file that can never be kept is left as it is and does not hold the project back for ever", async () => {
  const { rows, remote } = fakeRemote();
  const kv = memoryKv();
  const s = createProjectStore(kv);
  const p = projectWithFiles("Odd", ["/api/local/ok.png", "/api/local/missing.png"]);
  await s.save(p);
  const portable: Portable = { keep: async (url) => (url.includes("missing") ? "never" : "https://store.test/ok.png") };
  await syncProjects(kv, s, remote, portable);
  const again = await syncProjects(kv, s, remote, portable);
  assert.equal(again.pushed, 0, "nothing keeps being re-sent");
  assert.ok(JSON.stringify(rows.get(p.id)!.project).includes("/api/local/missing.png"));
});

test("a project already in the account without its files is sent once more when file copying first starts", async () => {
  const { rows, remote } = fakeRemote();
  const kv = memoryKv();
  const s = createProjectStore(kv);
  const p = projectWithFiles("Earlier", ["/api/local/a.png"]);
  await s.save(p);
  await syncProjects(kv, s, remote);
  assert.ok(JSON.stringify(rows.get(p.id)!.project).includes("/api/local/a.png"), "sent without files, as before");
  const portable: Portable = { keep: async () => "https://store.test/a.png" };
  await syncProjects(kv, s, remote, portable);
  assert.ok(JSON.stringify(rows.get(p.id)!.project).includes("https://store.test/a.png"));
  const again = await syncProjects(kv, s, remote, portable);
  assert.equal(again.pushed, 0, "only the one time");
});
