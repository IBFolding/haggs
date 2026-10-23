import { createAccessoryStore } from "../accessories/accessory";
import { blank, createCharacterStore } from "../characters/character";
import { blankPlace, createPlaceStore } from "../locations/location";
import { fromAccessory, fromCharacter, fromPlace, type BankItem } from "./bank";
import type { PickKind } from "./handoff";
import type { Kv } from "./kv";

/**
 * Putting something into the bank from where it was made: a picture from
 * Photos or Video, or a row on a project's sheets. The picture becomes the
 * character's sheet, the place's plate or the accessory's picture, and the
 * words you give (or the prompt that made it) stand in for the builder's traits.
 */

export type Source = { image: string; words: string };

const clean = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

export async function saveToBank(kv: Kv, kind: PickKind, name: string, source: Source): Promise<BankItem> {
  const label = clean(name, 60);
  if (!label) throw new Error("Give it a name.");
  if (!source.image) throw new Error("There is no picture to keep.");
  const words = clean(source.words, 300);
  if (kind === "character") return fromCharacter(await createCharacterStore(kv).save({ traits: { ...blank(), name: label }, sheet: source.image, likeness: [], ...(words ? { words: `${label}: ${words}` } : {}) }));
  if (kind === "place") return fromPlace(await createPlaceStore(kv).save({ traits: { ...blankPlace(), name: label }, plate: source.image, views: [], reference: null, ...(words ? { words: `${label}: ${words}` } : {}) }));
  return fromAccessory(await createAccessoryStore(kv).save({ name: label, words, picture: source.image }));
}

/** A name to offer for a picture: the first few words of the prompt that made it. */
export function suggestName(prompt: string): string {
  const first = clean(prompt.split(/[,.;:\n]/)[0] ?? "", 60);
  const words = first.split(" ").slice(0, 4);
  // Not a name that ends on a joining word: "A weathered fisherman in" becomes "A weathered fisherman".
  while (words.length > 1 && /^(a|an|the|in|of|on|at|with|and|for|to|by)$/i.test(words[words.length - 1]!)) words.pop();
  return words.join(" ");
}
