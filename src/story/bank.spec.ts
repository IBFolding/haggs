import assert from "node:assert/strict";
import test from "node:test";
import { KIND_NAME, fromAccessory, imagesOf, wordsOf, type BankItem } from "./bank";

const item = (kind: BankItem["kind"], id: string, words: string, image: string | null = null): BankItem => ({ kind, id, name: id, image, words });

test("an accessory reads as a bank item with its picture and words", () => {
  const b = fromAccessory({ id: "a1", name: "Red scarf", words: "a long red scarf", picture: "/p.png", createdAt: 1, updatedAt: 1 });
  assert.deepEqual(b, { kind: "accessory", id: "a1", name: "Red scarf", image: "/p.png", words: "a long red scarf" });
});

test("words come out as who, what they wear, then where", () => {
  const w = wordsOf([item("place", "p", "A wheat field at dusk."), item("accessory", "a", "a red scarf"), item("character", "c", "Ellis: grey hair."), item("accessory", "b", "round glasses")]);
  assert.equal(w, "Ellis: grey hair. Wearing and carrying: a red scarf; round glasses. A wheat field at dusk.");
  assert.equal(wordsOf([]), "");
});

test("pictures are taken in order, skipping the ones without, up to what the model takes", () => {
  const items = [item("character", "c", "", "/c.png"), item("accessory", "a", "", null), item("place", "p", "", "/p.png"), item("accessory", "b", "", "/b.png")];
  assert.deepEqual(imagesOf(items, 2), ["/c.png", "/p.png"]);
  assert.deepEqual(imagesOf(items, 0), []);
});

test("each kind knows where it is built", () => {
  assert.deepEqual(Object.values(KIND_NAME).map((k) => k.builder), ["/characters", "/locations", "/accessories"]);
});
