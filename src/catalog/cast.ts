/**
 * Casting a prompt: a saved character, a saved place and what the character
 * wears, added to whatever you type, in words and, where the model takes
 * pictures, as references.
 */

export type Cast = { characterLock?: string | undefined; placeLock?: string | undefined; outfit?: string[] };

export const OUTFIT_IDEAS = ["sunglasses", "round glasses", "a leather jacket", "a trench coat", "a red scarf", "a baseball cap", "a beanie", "a suit and tie", "a hoodie", "a backpack", "headphones", "gold chains", "a wedding ring", "a raincoat"];

const list = (items: string[]) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** Your words, then who is in it, what they wear, and where. Nothing is added when nothing is picked. */
export function castWords(prompt: string, { characterLock, placeLock, outfit = [] }: Cast): string {
  const worn = outfit.map((o) => o.trim()).filter(Boolean);
  const parts = [prompt.trim(), characterLock?.trim(), worn.length ? `The character is wearing ${list(worn)}.` : "", placeLock?.trim()].filter(Boolean);
  return parts.join(" ");
}

/** The sheets to send as references. A picture you attached is the opening frame, so then only words are used; and never more than the model takes. */
export function castReferences({ attached, character, place, max }: { attached: string[]; character: string | null; place: string | null; max: number }): string[] {
  if (attached.length || max <= 0) return [];
  return [character, place].filter((x): x is string => Boolean(x)).slice(0, max);
}
