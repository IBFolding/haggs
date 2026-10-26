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

test("a title is transparent text placed by where it sits", async () => {
  const { titleSvg } = await import("./card");
  const lower = titleSvg("Ellis & Co", "lower", { w: 1920, h: 1080 });
  assert.match(lower, /text-anchor="start"/);
  assert.match(lower, /Ellis &amp; Co/);
  assert.doesNotMatch(lower, /<rect/, "no background, so the picture shows through");
  assert.match(titleSvg("A\nB", "center", { w: 1080, h: 1920 }), /text-anchor="middle"[\s\S]*B/);
});


test("rendered wide title and subtitle keep safe horizontal margins", async () => {
  const sharp = (await import("sharp")).default;
  for (const aspect of ["16:9", "9:16"] as const) {
    const size = cardSize(aspect);
    const { data, info } = await sharp(Buffer.from(cardSvg("W".repeat(80), "W".repeat(100), size))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let left = info.width, right = -1;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      const at=(y*info.width+x)*info.channels;
      if(data[at]!>80) {left=Math.min(left,x);right=Math.max(right,x);}
    }
    assert.ok(right>left, "text is actually rendered");
    assert.ok(left>=size.w*0.06 && right<=size.w*0.94, `${aspect}: text stays inside safe margins`);
  }
});
