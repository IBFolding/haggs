import assert from "node:assert/strict";
import test from "node:test";
import { addCutdown, cutdown } from "./cutdown";
import { buildCut } from "./cut";
import { newShot, type Project } from "./model";
import { view } from "./boards";

function shot(seconds: number, extra: Record<string, unknown> = {}) {
  return { ...newShot(), seconds, render: { url: `/m/${seconds}.mp4`, kind: "video" as const, usd: 0, promptHash: "", at: 1 }, ...extra };
}
const project = (shots: ReturnType<typeof shot>[], extra: Record<string, unknown> = {}) => ({ id: "p", name: "Film", shots, notes: [], ...extra }) as unknown as Project;

test("a window trims the shots at its edges", () => {
  const p = project([shot(4), shot(4), shot(4)]);
  const out = cutdown(p, 2, 10);
  const cut = buildCut(out);
  assert.deepEqual(cut.clips.map((c) => c.seconds), [2, 4, 2]);
  assert.equal(cut.clips[0]!.from, 2);
  assert.equal(cut.total, 8);
});

test("lines, effects and markers move with the window; ones outside are dropped", () => {
  const line = (offset: number) => ({ id: `l${offset}`, text: "hi", speaker: "A", voice: "v", url: "/v.mp3", offset });
  const p = project([shot(4, { voices: [line(0.5), line(3)] }), shot(4)], {
    effects: [{ id: "e1", name: "door", url: "/e.mp3", start: 1, gain: 0, seconds: 1 }, { id: "e2", name: "late", url: "/e.mp3", start: 6, gain: 0, seconds: 1 }],
    markers: [{ id: "m1", at: 1, text: "early" }, { id: "m2", at: 6, text: "late" }],
  });
  const out = cutdown(p, 2, 8);
  assert.deepEqual(out.shots[0]!.voices!.map((v) => v.offset), [1]);
  assert.deepEqual(out.effects!.map((e) => e.start), [4]);
  assert.deepEqual(out.markers!.map((m) => m.at), [4]);
});

test("a fade survives only where its end of the clip does", () => {
  const p = project([shot(4, { fadeIn: 0.5, fadeOut: 0.5 })]);
  const mid = cutdown(p, 1, 3).shots[0]!;
  assert.equal(mid.fadeIn, undefined);
  assert.equal(mid.fadeOut, undefined);
  const head = cutdown(p, 0, 2).shots[0]!;
  assert.equal(head.fadeIn, 0.5);
  assert.equal(head.fadeOut, undefined);
});

test("an empty or tiny window is refused", () => {
  const p = project([shot(4)]);
  assert.throws(() => cutdown(p, 1, 1.1), /at least/);
  assert.throws(() => cutdown(p, 10, 12), /no footage/);
});

test("a cutdown lands on its own board and leaves the original alone", () => {
  const p = project([shot(4), shot(4)]);
  const made = addCutdown(p, undefined, p, "Teaser", 0, 5);
  assert.equal(made.project.boards!.length, 2);
  assert.equal(buildCut(view(made.project, made.board.id)).total, 5);
  assert.equal(buildCut(view(made.project, made.project.boards![0]!.id)).total, 8);
});
