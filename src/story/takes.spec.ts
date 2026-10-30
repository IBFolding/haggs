import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCut, ffmpegScript } from "./cut";
import { createProject, newShot, type Shot } from "./model";
import { addTake, chooseTake, cycleTake, removeTake, splitShot, takesOf, toggleFavorite } from "./takes";

const render = (url: string) => ({ url, kind: "video" as const, usd: 0.4, promptHash: "h", at: 1 });
const base = (): Shot => ({ id: "s", heading: "INT. CABIN", beat: "", threadIds: [], seconds: 6, model: { id: "m", settings: {} }, render: render("a.mp4") });

test("a shot made before takes has its render as its only take", () => {
  const takes = takesOf(base());
  assert.equal(takes.length, 1);
  assert.equal(takes[0]?.url, "a.mp4");
});

test("a new generation is added as a take and goes on the shot; the old take is kept", () => {
  const shot = addTake(base(), render("b.mp4"), "MiniMax H3");
  assert.deepEqual(takesOf(shot).map((t) => t.url), ["a.mp4", "b.mp4"]);
  assert.equal(shot.render?.url, "b.mp4");
  assert.equal(takesOf(shot)[1]?.origin, "MiniMax H3");
});

test("choosing, starring, cycling and removing takes", () => {
  let shot = addTake(addTake(base(), render("b.mp4")), render("c.mp4"));
  const [a, b, c] = takesOf(shot);
  shot = chooseTake(shot, a!.id);
  assert.equal(shot.render?.url, "a.mp4");
  shot = toggleFavorite(shot, b!.id);
  assert.equal(takesOf(shot)[1]?.favorite, true);
  assert.equal(cycleTake(shot, 1).render?.url, "b.mp4");
  assert.equal(cycleTake(shot, -1).render?.url, "c.mp4", "cycling wraps around");
  shot = removeTake(shot, a!.id);
  assert.deepEqual(takesOf(shot).map((t) => t.url), ["b.mp4", "c.mp4"]);
  assert.equal(shot.render?.url, "b.mp4", "removing the take on the shot puts the next one on");
  shot = removeTake(removeTake(shot, b!.id), c!.id);
  assert.equal(shot.render, undefined);
  assert.throws(() => chooseTake(shot, "nope"), /take/);
});

test("splitting a shot at a time makes two shots of the same footage, the second starting where the first ends", () => {
  const p = { ...createProject("p"), shots: [{ ...base(), sheetShotId: "row1" }, { ...base(), id: "t" }] };
  const next = splitShot(p, "s", 2.5);
  assert.deepEqual(next.shots.map((s) => [s.seconds, s.trimIn ?? 0]), [[2.5, 0], [3.5, 2.5], [6, 0]]);
  assert.equal(next.shots[1]?.render?.url, "a.mp4");
  assert.equal(next.shots[0]?.sheetShotId, "row1");
  assert.equal(next.shots[1]?.sheetShotId, undefined, "only one half stays linked to the sheet row");
  assert.notEqual(next.shots[1]?.id, "s");
  assert.throws(() => splitShot(p, "s", 0), /inside/);
  assert.throws(() => splitShot(p, "s", 6), /inside/);
});

test("the cut starts a trimmed shot partway into its footage, and the export does too", () => {
  const p = { ...createProject("p"), shots: [{ ...base(), trimIn: 1.5, seconds: 2 }] };
  const cut = buildCut(p);
  assert.equal(cut.clips[0]?.from, 1.5);
  assert.match(ffmpegScript(cut, "x"), /-ss 1\.5 -i/);
  assert.equal(buildCut({ ...p, shots: [base()] }).clips[0]?.from, 0);
});

import { trimHead, trimTail } from "./takes";

test("trimming the head moves where the footage starts and shortens the shot; the tail just shortens it", () => {
  const base = { ...newShot(), id: "s", seconds: 5, trimIn: 1 } as Shot;
  const p = { ...createProject("x"), shots: [base] };
  const head = trimHead(p, "s", 2).shots[0]!;
  assert.equal(head.trimIn, 3);
  assert.equal(head.seconds, 3);
  const tail = trimTail(p, "s", 2).shots[0]!;
  assert.equal(tail.trimIn, 1);
  assert.equal(tail.seconds, 2);
  assert.throws(() => trimHead(p, "s", 4.95), /0\.2/);
  assert.throws(() => trimTail(p, "s", 0.1), /0\.2/);
  assert.throws(() => trimTail(p, "nope", 2), /not on the board/);
});


test("take switching restores independent Grey Room scenes and trim offsets", () => {
  const original = {...base(), trimIn:2, greyScene:{source:{url:"a.mp4",kind:"video" as const,trimIn:2},look:{warmth:.4,exposure:0,contrast:0,saturation:0,vignette:0}}};
  const fresh=addTake(original,render("fresh.mp4"));
  assert.equal(fresh.greyScene,undefined);
  assert.equal(fresh.trimIn,0);
  const restored=chooseTake(fresh,fresh.takes![0]!.id);
  assert.deepEqual(restored.greyScene,original.greyScene);
  assert.equal(restored.trimIn,2);
  const edited={...fresh,greyScene:{source:{url:"fresh.mp4",kind:"video" as const},look:{warmth:-.2,exposure:0,contrast:0,saturation:0,vignette:0}}};
  const back=chooseTake(chooseTake(edited,edited.takes![0]!.id),edited.takes![1]!.id);
  assert.deepEqual(back.greyScene,edited.greyScene);
});

test("Grey Room output retains editable source without inheriting other takes",()=>{
  const original={...base(),trimIn:2,greyScene:{source:{url:"a.mp4",kind:"video" as const,trimIn:2}}};
  const output=addTake(original,render("composite.mp4"),"Grey Room draft",original.greyScene);
  assert.deepEqual(output.greyScene,original.greyScene);
  assert.equal(output.trimIn,0);
  const restored=removeTake(output,output.takes!.at(-1)!.id);
  assert.equal(restored.trimIn,2);
  assert.deepEqual(restored.greyScene,original.greyScene);
});
