import assert from "node:assert/strict";
import { test } from "node:test";

import { insertLine, kindOf, scopeClipOccurrences, slugName, uniqueName } from "./media";
import { layout, parseSheet } from "./beats";

test("a file name becomes a name a film can use", () => {
  assert.equal(slugName("My Great Shot (final).PNG"), "my-great-shot-final");
  assert.equal(slugName("kiln.jpg"), "kiln");
  assert.equal(slugName("???.png"), "media");
  assert.equal(slugName("a".repeat(60) + ".mp4").length, 24);
});

test("a taken name gets a number", () => {
  assert.equal(uniqueName("kiln", []), "kiln");
  assert.equal(uniqueName("kiln", ["kiln"]), "kiln-2");
  assert.equal(uniqueName("kiln", ["kiln", "kiln-2"]), "kiln-3");
});

test("pictures and clips are told apart by their type", () => {
  assert.equal(kindOf("image/png"), "image");
  assert.equal(kindOf("video/mp4"), "clip");
  assert.equal(kindOf("video/webm;codecs=vp9"), "clip");
  assert.equal(kindOf("audio/mpeg"), null);
  assert.equal(kindOf(""), null);
});

test("inserting a block adds a line at the end of the sheet, keeping a trailing newline", () => {
  assert.equal(insertLine("A | 2", "@image kiln | 2 | "), "A | 2\n@image kiln | 2 | \n");
  assert.equal(insertLine("A | 2\n", "@clip app | 3 | "), "A | 2\n@clip app | 3 | \n");
  assert.equal(insertLine("", "@image x | 2 | "), "@image x | 2 | \n");
});

test("only repeated clip occurrences receive scoped media and playback elements", () => {
  const original = { id: "original" }, clone = { id: "clone" };
  const timeline = layout(parseSheet("@clip app | 2\nWORDS | 2\n@clip app | 2"));
  const result = scopeClipOccurrences(timeline, {
    app: { el: original, width: 1280, height: 720 },
  }, { app: original }, () => clone);
  assert.equal(result.media.app?.el, original);
  assert.equal(result.clips.app, original);
  assert.equal(result.media["2:app"]?.el, clone);
  assert.equal(result.clips["2:app"], clone);
  assert.equal(result.media["0:app"], undefined);
  assert.equal(result.clips["0:app"], undefined);
  assert.equal(Object.keys(result.media).length, 2);
  assert.equal(Object.keys(result.clips).length, 2);
});
