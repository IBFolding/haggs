import assert from "node:assert/strict";
import { test } from "node:test";

import { runTool, type ToolContext } from "./agent-tools";
import { createProject, newShot, type Project } from "./model";

function world() {
  const p: Project = { ...createProject("Waylight"), boards: [{ id: "b1", name: "Sizzle", kind: "reel", shots: [{ ...newShot(), id: "s1", beat: "Black", seconds: 2 }, { ...newShot(), id: "s2", beat: "Rowan laughs", seconds: 3 }], notes: [] }] };
  const saved: Project[] = [];
  const opened: string[] = [];
  let current = p;
  const ctx: ToolContext = {
    list: async () => [{ id: p.id, name: p.name, updatedAt: 1, shotCount: 2, boardCount: 1 }],
    load: async (id) => (id === p.id ? current : null),
    save: async (next) => void (saved.push(next), (current = next)),
    sheets: async () => null,
    workflows: async () => [{ name: "swap", title: "Swap", description: "" }],
    open: (path) => void opened.push(path),
  };
  return { p, ctx, saved, opened, now: () => current };
}

test("the producer reads a board as numbered shots with what each shows", async () => {
  const { p, ctx } = world();
  const out = await runTool("read_board", { project: p.id }, ctx);
  const r = out.result as { shots: { n: number; beat: string; shows: string }[] };
  assert.deepEqual(r.shots.map((s) => [s.n, s.beat, s.shows]), [[1, "Black", "nothing"], [2, "Rowan laughs", "nothing"]]);
});

test("edits, moves and voice lines save the project and hand back what it was, for Undo", async () => {
  const { p, ctx, now } = world();
  const edit = await runTool("edit_shots", { project: p.id, board: "b1", edits: [{ shot: "s2", seconds: 2.5, locked: true }] }, ctx);
  assert.equal(edit.change!.before.boards![0]!.shots[1]!.seconds, 3);
  assert.equal(now().boards![0]!.shots[1]!.seconds, 2.5);
  assert.equal(now().boards![0]!.shots[1]!.locked, true);
  await runTool("move_shot", { project: p.id, board: "b1", shot: "s2", to: 1 }, ctx);
  assert.deepEqual(now().boards![0]!.shots.map((s) => s.id), ["s2", "s1"]);
  const voice = await runTool("add_voice_line", { project: p.id, board: "b1", shot: "s1", speaker: "voice", text: "Be brave.", voice: "Laura (female, american)" }, ctx);
  assert.match(voice.change!.label, /Be brave/);
  assert.equal(now().boards![0]!.shots[1]!.voices![0]!.speaker, "VOICE");
  assert.equal(now().boards![0]!.shots[1]!.voices![0]!.url, undefined, "not spoken: speaking costs money, so the person presses Speak");
});

test("a new board is added beside the others", async () => {
  const { p, ctx, now } = world();
  const out = await runTool("add_board", { project: p.id, name: "Cutdown", shots: [{ beat: "Open", seconds: 2, from: "s2" }] }, ctx);
  assert.equal(out.error, undefined);
  assert.equal(now().boards!.length, 2);
});

test("mistakes come back as errors Claude can read, and only haggs pages can be opened", async () => {
  const { p, ctx, opened, saved } = world();
  assert.equal((await runTool("edit_shots", { project: p.id, board: "b1", edits: [{ shot: "nope", beat: "x" }] }, ctx)).error, true);
  assert.equal((await runTool("edit_shots", { project: p.id, board: "b1", edits: [{ shot: "s1", seconds: 900 }] }, ctx)).error, true);
  assert.equal((await runTool("read_board", { project: "nope" }, ctx)).error, true);
  assert.equal((await runTool("open_page", { path: "https://evil.test" }, ctx)).error, true);
  assert.equal((await runTool("open_page", { path: "javascript:alert(1)" }, ctx)).error, true);
  await runTool("open_page", { path: `/board/${p.id}/cut?b=b1` }, ctx);
  assert.deepEqual(opened, [`/board/${p.id}/cut?b=b1`]);
  assert.equal(saved.length, 0, "nothing was saved by a failed edit");
  assert.equal((await runTool("delete_board", {}, ctx)).error, true);
});
