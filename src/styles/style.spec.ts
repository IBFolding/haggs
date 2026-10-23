import assert from "node:assert/strict";
import { test } from "node:test";

import { STYLES, restylePrompt, styleById, styleSheetPrompt } from "./style";

test("every style has a distinct id, a name and words", () => {
  assert.ok(STYLES.length >= 6);
  assert.equal(new Set(STYLES.map((s) => s.id)).size, STYLES.length);
  for (const s of STYLES) assert.ok(s.name && s.words.length > 20, s.id);
});

test("no style is named for a living studio or artist", () => {
  const banned = /ghibli|miyazaki|pixar|disney|dreamworks|spider-verse|shinkai/i;
  for (const s of STYLES) assert.doesNotMatch(`${s.name} ${s.words}`, banned, s.id);
});

test("restyling keeps the motion, camera and performance and names the new look", () => {
  const p = restylePrompt(styleById("cel-anime")!, "she keeps the green jacket");
  assert.match(p, /same motion/i);
  assert.match(p, /same camera/i);
  assert.match(p, /cel/i);
  assert.match(p, /green jacket/);
});

test("a style sheet is a picture of the look, not a scene", () => {
  const p = styleSheetPrompt(styleById("storybook")!);
  assert.match(p, /style sheet/i);
  assert.match(p, /palette/i);
  assert.match(p, /no text/i);
});
