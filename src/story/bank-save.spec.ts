import assert from "node:assert/strict";
import test from "node:test";
import { createAccessoryStore } from "../accessories/accessory";
import { createCharacterStore } from "../characters/character";
import { createPlaceStore } from "../locations/location";
import { saveToBank, suggestName } from "./bank-save";
import { memoryKv } from "./kv";

test("a picture becomes a character in the bank, with the words that made it standing in for traits", async () => {
  const kv = memoryKv();
  const item = await saveToBank(kv, "character", "Juno", { image: "/api/local/j.png", words: "a teenage girl with short curly black hair and a patched denim jacket" });
  assert.equal(item.kind, "character");
  assert.equal(item.image, "/api/local/j.png");
  assert.match(item.words, /^Juno: a teenage girl with short curly black hair/);
  const saved = (await createCharacterStore(kv).list())[0]!;
  assert.equal(saved.traits.name, "Juno");
  assert.equal(saved.sheet, "/api/local/j.png");
});

test("places and accessories save the same way", async () => {
  const kv = memoryKv();
  const place = await saveToBank(kv, "place", "Rooftop", { image: "/p.png", words: "a rainy city rooftop at night" });
  assert.match(place.words, /^Rooftop: a rainy city rooftop/);
  assert.equal((await createPlaceStore(kv).list())[0]!.plate, "/p.png");
  const acc = await saveToBank(kv, "accessory", "Red scarf", { image: "/a.png", words: "a long red scarf" });
  assert.equal(acc.words, "a long red scarf");
  assert.equal((await createAccessoryStore(kv).list())[0]!.picture, "/a.png");
});

test("it needs a name and a picture", async () => {
  await assert.rejects(saveToBank(memoryKv(), "character", " ", { image: "/x.png", words: "" }), /name/);
  await assert.rejects(saveToBank(memoryKv(), "place", "Rooftop", { image: "", words: "" }), /no picture/);
});

test("a name is offered from the start of the prompt", () => {
  assert.equal(suggestName("A weathered fisherman in his sixties, grey beard, yellow oilskin"), "A weathered fisherman");
  assert.equal(suggestName("Rooftop at night in the rain"), "Rooftop at night");
  assert.equal(suggestName(""), "");
});
