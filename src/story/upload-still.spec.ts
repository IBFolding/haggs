import assert from "node:assert/strict";
import { test } from "node:test";
import { createProject, newShot } from "./model";
import { attachUploadedStill } from "./upload-still";
import { commit, normalize, view } from "./boards";

test("upload retains all 32 shot identities and descriptions, prior takes and board after persistence", () => {
  const shots = Array.from({ length: 32 }, (_, i) => ({ ...newShot(), heading: `Shot ${i}`, beat: `Beat ${i}` }));
  const project = { ...createProject("Wizards"), shots };
  const target = shots[2]!;
  const first = attachUploadedStill(project, target.id, "data:image/png;base64,first", "first.png");
  const second = attachUploadedStill(first, target.id, "data:image/png;base64,second", "second.png");
  const loaded = view(JSON.parse(JSON.stringify(commit(normalize(project), undefined, second))));
  assert.equal(loaded.id, project.id);
  assert.deepEqual(loaded.shots.map(s => [s.id, s.heading, s.beat]), shots.map(s => [s.id, s.heading, s.beat]));
  assert.equal(loaded.shots[2]?.takes?.length, 2);
  assert.equal(loaded.shots[2]?.render?.url, "data:image/png;base64,second");
  assert.equal(loaded.shots[1]?.render, undefined);
  assert.equal(attachUploadedStill(project, "deleted-shot", "data:image/png;base64,x", "x.png"), project);
});
