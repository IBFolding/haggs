import { accessoryWords, type Accessory } from "../accessories/accessory";
import { identityLock, type Character } from "../characters/character";
import { placeLock, type SavedPlace } from "../locations/location";
import type { PickKind } from "./handoff";

/**
 * Your bank: the characters, places and accessories you have made, seen the
 * same way wherever you choose from them. Each is a name, a picture and the
 * words that put it into a shot.
 */

export type BankItem = { kind: PickKind; id: string; name: string; image: string | null; words: string };

export const fromCharacter = (c: Character): BankItem => ({ kind: "character", id: c.id, name: c.traits.name, image: c.sheet || null, words: c.words?.trim() || identityLock(c.traits) });
export const fromPlace = (p: SavedPlace): BankItem => ({ kind: "place", id: p.id, name: p.traits.name, image: p.plate || null, words: p.words?.trim() || placeLock(p.traits) });
export const fromAccessory = (a: Accessory): BankItem => ({ kind: "accessory", id: a.id, name: a.name, image: a.picture, words: accessoryWords(a) });

export const KIND_NAME: Record<PickKind, { one: string; many: string; builder: string }> = {
  character: { one: "character", many: "Characters", builder: "/characters" },
  place: { one: "place", many: "Places", builder: "/locations" },
  accessory: { one: "accessory", many: "Accessories", builder: "/accessories" },
};

/** The pictures from a set of picks, for models that take reference images; never more than the model takes. */
export const imagesOf = (items: BankItem[], max: number): string[] => items.map((i) => i.image).filter((x): x is string => Boolean(x)).slice(0, Math.max(0, max));

/** The words of a set of picks, grouped the way a prompt reads: who, what they wear, where. */
export function wordsOf(items: BankItem[]): string {
  const by = (k: PickKind) => items.filter((i) => i.kind === k).map((i) => i.words).filter(Boolean);
  const worn = by("accessory");
  return [...by("character"), worn.length ? `Wearing and carrying: ${worn.join("; ")}.` : "", ...by("place")].filter(Boolean).join(" ");
}

/**
 * Which pictures go to a model that takes only a few. Characters first (up to
 * two, so they stay the same people), then the place, then the style sheet,
 * then what they wear. Anything past `max` is left to the words.
 */
export function allocateRefs(parts: { characters?: string[]; place?: string[]; style?: string[]; accessories?: string[] }, max: number): string[] {
  const order = [(parts.characters ?? []).slice(0, 2), (parts.place ?? []).slice(0, 1), (parts.style ?? []).slice(0, 1), parts.accessories ?? [], (parts.style ?? []).slice(1), (parts.characters ?? []).slice(2)];
  const out: string[] = [];
  for (const group of order) for (const url of group) if (url && !out.includes(url) && out.length < Math.max(0, max)) out.push(url);
  return out;
}
