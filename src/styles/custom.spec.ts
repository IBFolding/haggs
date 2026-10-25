import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memoryKv } from "../story/kv";
import { STYLES } from "./style";
import { allStyles, createStyleStore, customToStyle, MY_PREFIX } from "./custom";

describe("your own styles", () => {
  it("saves a style with its words and its sheet, lists newest first, and removes it", async () => {
    const store = createStyleStore(memoryKv());
    const a = await store.save({ name: "Faded Polaroid", words: "faded 1970s polaroid, warm washed colours, soft flash", sheet: "data:image/png;base64,AAAA" });
    await new Promise((r) => setTimeout(r, 3));
    const b = await store.save({ name: "Noir pencil", words: "black and white pencil noir, heavy shadows", sheet: null });
    assert.deepEqual((await store.list()).map((x) => x.name), ["Noir pencil", "Faded Polaroid"]);
    await store.remove(a.id);
    assert.deepEqual((await store.list()).map((x) => x.id), [b.id]);
  });

  it("needs a name and some words about the look", async () => {
    const store = createStyleStore(memoryKv());
    await assert.rejects(store.save({ name: "  ", words: "something", sheet: null }), /name/i);
    await assert.rejects(store.save({ name: "Mine", words: "  ", sheet: null }), /describe|words/i);
  });

  it("works anywhere a built-in style does, under its own id, and its sheet travels with it", async () => {
    const store = createStyleStore(memoryKv());
    const c = await store.save({ name: "Faded Polaroid", words: "faded polaroid", sheet: "data:image/png;base64,AAAA" });
    const s = customToStyle(c);
    assert.equal(s.id, `${MY_PREFIX}${c.id}`);
    assert.equal(s.name, "Faded Polaroid");
    assert.equal(s.words, "faded polaroid");
    assert.equal(s.sheet, "data:image/png;base64,AAAA");
    const all = allStyles([c]);
    assert.equal(all.length, STYLES.length + 1);
    assert.equal(all.at(-1)!.id, s.id);
    assert.ok(all.slice(0, STYLES.length).every((x) => !x.id.startsWith(MY_PREFIX)));
  });
});
