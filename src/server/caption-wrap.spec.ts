import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wrapCaption } from "./caption-wrap";

describe("wrapCaption", () => {
  it("keeps a short caption on one line", () => {
    assert.deepEqual(wrapCaption("Moss does not do change.", 40), ["Moss does not do change."]);
  });

  it("breaks between words so no line is longer than the limit", () => {
    const lines = wrapCaption("The prop room is locked from the inside, and the key is on her ring", 20);
    assert.ok(lines.length > 1);
    for (const l of lines) assert.ok(l.length <= 20, l);
    assert.equal(lines.join(" "), "The prop room is locked from the inside, and the key is on her ring");
  });

  it("never drops a word longer than the limit", () => {
    assert.deepEqual(wrapCaption("Supercalifragilistic go", 10), ["Supercalifragilistic", "go"]);
  });

  it("returns nothing for blank text", () => {
    assert.deepEqual(wrapCaption("   ", 20), []);
  });
});
