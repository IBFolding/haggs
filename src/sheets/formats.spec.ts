import assert from "node:assert/strict";
import { test } from "node:test";

import { FORMATS } from "./formats";

test("every format tiles its runtime with beats, in order, with no gaps or overlaps", () => {
  for (const f of FORMATS) {
    assert.ok(f.beats.length >= 5, f.id);
    assert.equal(f.beats[0]!.at, 0, f.id);
    assert.equal(f.beats.at(-1)!.until, f.seconds, f.id);
    f.beats.forEach((b, i) => {
      assert.ok(b.until > b.at, `${f.id} ${b.title}`);
      if (i) assert.equal(b.at, f.beats[i - 1]!.until, `${f.id} ${b.title} starts where the last ends`);
      assert.ok(b.job.length > 15, `${f.id} ${b.title} says what the beat is for`);
    });
  }
});

test("the formats asked for are all there, verticals in 9:16", () => {
  const ids = FORMATS.map((f) => f.id);
  for (const id of ["comedy-30", "animation-30", "dramedy-30", "romance-30", "drama-60", "dramedy-60", "romance-60", "vertical-drama", "vertical-comedy", "vertical-animation"]) assert.ok(ids.includes(id), id);
  assert.ok(FORMATS.filter((f) => f.group === "Vertical").every((f) => f.aspect === "9:16"));
  assert.equal(new Set(ids).size, ids.length);
  const hook = FORMATS.find((f) => f.id === "vertical-drama")!.beats[0]!;
  assert.ok(hook.until <= 3, "a vertical hook lands in the first three seconds");
});

test("laying out a format without AI gives one beat per format beat, each saying its job, timed to the format", async () => {
  const { layoutFormat } = await import("./formats");
  const { qaSheet, runtime } = await import("./sheets");
  const vertical = layoutFormat(FORMATS.find((f) => f.id === "vertical-drama")!, "A proposal on a rooftop", "Ring Tone");
  assert.equal(vertical.title, "Ring Tone");
  assert.equal(vertical.format, "9:16");
  assert.deepEqual(vertical.story.map((b) => b.title), ["Hook", "Situation", "Conflict", "Twist", "Escalation", "Cliffhanger"]);
  assert.match(vertical.story[0]!.feeling, /shocking line/);
  assert.equal(runtime(vertical), 90, "a short format's windows are filled with shots exactly");
  assert.ok(vertical.shots.every((s) => s.seconds <= 15));
  assert.match(vertical.shots[0]!.action, /A proposal on a rooftop/);
  assert.ok(!qaSheet(vertical).some((q) => /runs/.test(q.message)));

  const hour = layoutFormat(FORMATS.find((f) => f.id === "drama-60")!, "idea", "");
  assert.equal(hour.shots.length, hour.story.length, "a long format gets one placeholder shot per beat");
  assert.equal(hour.locations.length, 0, "placeholder scenes add no fake places");
});
