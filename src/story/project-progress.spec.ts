import assert from "node:assert/strict";
import { test } from "node:test";
import { createProject, newShot } from "./model";
import { projectProgress } from "./project-progress";

const made = (kind: "image" | "video") => ({ ...newShot(), render: { url: "/test-media", kind, usd: null, promptHash: "test", at: 0 } });
test("an empty project continues to script without claiming media progress", () => {
  const p = createProject("Empty"); const s = projectProgress(p);
  assert.equal(s.total, 0); assert.equal(s.stage, "Script & planning"); assert.equal(s.href, `/board/${p.id}/sheets`);
});
test("legacy shots count actual media and continue unfinished storyboard", () => {
  const p = { ...createProject("Legacy"), shots: [made("image"), newShot()] };
  const s = projectProgress(p); assert.equal(s.visuals, 1); assert.equal(s.total, 2); assert.equal(s.clips, 0); assert.match(s.href, /\?b=main$/);
});
test("multi-board projects target the first board with missing media", () => {
  const p = { ...createProject("Episodes"), boards: [{ id: "first", name: "one", kind: "episode" as const, notes: [], shots: [made("video")] }, { id: "second", name: "two", kind: "episode" as const, notes: [], shots: [newShot()] }] };
  const s = projectProgress(p); assert.equal(s.total, 2); assert.equal(s.clips, 1); assert.match(s.href, /\?b=second$/);
});
test("all-media projects offer editorial review, never claim final export", () => {
  const p = { ...createProject("Review"), shots: [made("image"), made("video")] };
  const s = projectProgress(p); assert.equal(s.stage, "Ready to review"); assert.match(s.href, /\/cut\?b=main$/);
});
