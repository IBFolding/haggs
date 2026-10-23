import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject } from "../story/model";
import { STYLES, styleById } from "./style";
import { addStyleReel } from "./reel";

test("the promo's looks are all there: anime, clay, scribble, mixed media, pixel art", () => {
  for (const id of ["cel-anime", "clay", "scribble", "mixed-media", "pixel-art"]) assert.ok(styleById(id), id);
  assert.equal(new Set(STYLES.map((s) => s.id)).size, STYLES.length);
});

test("a style reel is a new board with one labelled clip per style, in order, original board untouched", () => {
  const base = createProject("Waylight");
  const anime = styleById("cel-anime")!, clay = styleById("clay")!;
  const { project, board } = addStyleReel(base, "Style reel", [
    { style: anime, url: "/a.mp4", seconds: 4.5, usd: 0.57 },
    { style: clay, url: "/c.mp4", seconds: 4.5, usd: 0.57 },
  ]);
  assert.equal(project.boards!.length, base.boards ? base.boards.length + 1 : 2);
  assert.deepEqual(board.shots.map((s) => s.caption), ["Cel anime", "Claymation"]);
  assert.deepEqual(board.shots.map((s) => s.render?.url), ["/a.mp4", "/c.mp4"]);
  assert.equal(board.shots[0]!.seconds, 4.5);
  assert.equal(board.kind, "reel");
  assert.deepEqual(board.shots.map((s) => s.heading), ["Cel anime", "Claymation"], "each clip is named by its look");
  assert.ok(board.shots.every((s) => s.render?.kind === "video"));
});
