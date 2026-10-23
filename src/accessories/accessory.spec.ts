import assert from "node:assert/strict";
import test from "node:test";
import { memoryKv } from "../story/kv";
import { accessoryWords, createAccessoryStore, wearing } from "./accessory";

test("accessories are saved, listed newest first, and removed", async () => {
  const s = createAccessoryStore(memoryKv());
  const a = await s.save({ name: "Red scarf", words: "a bright red wool scarf", picture: null });
  const b = await s.save({ name: "Round glasses", words: "", picture: "/api/local/x.png" });
  assert.deepEqual((await s.list()).map((x) => x.name), ["Round glasses", "Red scarf"]);
  await s.save({ ...a, id: a.id, createdAt: a.createdAt, name: "Red scarf", words: "a long red scarf", picture: null });
  assert.equal((await s.list())[0]!.words, "a long red scarf", "saving again updates, and brings it to the front");
  await s.remove(b.id);
  assert.equal((await s.list()).length, 1);
});

test("an accessory needs a name", async () => {
  await assert.rejects(createAccessoryStore(memoryKv()).save({ name: "  ", words: "x", picture: null }), /name/);
});

test("the words fall back to the name, and several read as one phrase", () => {
  assert.equal(accessoryWords({ name: "Round glasses", words: "" }), "Round glasses");
  assert.equal(accessoryWords({ name: "x", words: "a red scarf." }), "a red scarf");
  assert.equal(wearing([]), "");
  assert.equal(wearing([{ name: "a", words: "a red scarf" }]), "a red scarf");
  assert.equal(wearing([{ name: "a", words: "a red scarf" }, { name: "b", words: "round glasses" }, { name: "c", words: "a leather jacket" }]), "a red scarf, round glasses and a leather jacket");
});
