import assert from "node:assert/strict";
import { test } from "node:test";

import { cardSize, cardSvg } from "./card";

test("a title card is a frame-sized picture with the words centred, escaped", () => {
  const svg = cardSvg("Tom & Jerry <live>", "a film", cardSize("16:9"));
  assert.match(svg, /width="1920" height="1080"/);
  assert.match(svg, /Tom &amp; Jerry &lt;live&gt;/);
  assert.match(svg, /a film/);
  assert.doesNotMatch(svg, /<live>/);
  assert.match(cardSvg("x", "", cardSize("9:16")), /width="1080" height="1920"/);
});

test("a long title is set smaller so it still fits", () => {
  const size = (t: string) => Number(/font-size="(\d+)"/.exec(cardSvg(t, "", cardSize("16:9")))![1]);
  assert.ok(size("A".repeat(60)) < size("Waylight"));
});
