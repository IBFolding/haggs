import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject, newShot, summarize, type Shot } from "./model";

const shot = (url?: string, kind: "image" | "video" = "image"): Shot => ({ ...newShot(), ...(url ? { render: { url, kind, usd: null, promptHash: "", at: 1 } } : {}) });
const withBoards = (...boards: Shot[][]) => ({ ...createProject("P"), boards: boards.map((shots, i) => ({ id: `b${i}`, name: `B${i}`, kind: "board" as const, shots, notes: [] })) });

test("a project's cover is the first finished picture in story order", () => {
  const p = withBoards([shot(), shot("/a.png")], [shot("/b.png")]);
  assert.deepEqual(summarize(p).cover, { url: "/a.png", kind: "image" });
});

test("a clip can be the cover, and says it is a clip", () => {
  assert.deepEqual(summarize(withBoards([shot("/c.mp4", "video")])).cover, { url: "/c.mp4", kind: "video" });
});

test("a project with nothing made yet has no cover", () => {
  assert.equal(summarize(withBoards([shot(), shot()])).cover, undefined);
});

test("an older project without boards still gets a cover from its shots", () => {
  const old = { ...createProject("Old"), shots: [shot(), shot("/old.png")] };
  assert.deepEqual(summarize(old).cover, { url: "/old.png", kind: "image" });
});
