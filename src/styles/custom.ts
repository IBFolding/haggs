import type { Kv } from "../story/kv";
import { STYLES, type Style } from "./style";

/**
 * Your own looks. A style is a few words about how it should be drawn plus,
 * ideally, a style sheet: a picture of the look that goes to Comfy beside
 * your footage so it is copied, not guessed. They live in this browser and
 * work anywhere a built-in style does.
 */

export type CustomStyle = { id: string; name: string; words: string; sheet: string | null; createdAt: number; updatedAt: number };
export const MY_PREFIX = "my-";

const INDEX = "styles/index";
const key = (id: string) => `styles/${id}`;

/** A built-in style, or one of yours with the picture of its look attached. */
export type AnyStyle = Style & { sheet?: string | null };

export const customToStyle = (c: CustomStyle): AnyStyle => ({ id: `${MY_PREFIX}${c.id}`, name: c.name, says: "Your own style.", words: c.words, sheet: c.sheet });
export const allStyles = (custom: CustomStyle[]): AnyStyle[] => [...STYLES, ...custom.map(customToStyle)];

export function createStyleStore(kv: Kv) {
  return {
    async list(): Promise<CustomStyle[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<CustomStyle>(key(id))))).filter((s): s is CustomStyle => Boolean(s)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async save(input: { id?: string; name: string; words: string; sheet: string | null }): Promise<CustomStyle> {
      const name = input.name.trim();
      const words = input.words.trim();
      if (!name) throw new Error("Give the style a name.");
      if (!words) throw new Error("Describe the look in a few words so it can be drawn.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const id = input.id ?? globalThis.crypto.randomUUID();
      const before = input.id ? await kv.get<CustomStyle>(key(id)) : undefined;
      const now = Date.now();
      const saved: CustomStyle = { id, name: name.slice(0, 40), words: words.slice(0, 400), sheet: input.sheet, createdAt: before?.createdAt ?? now, updatedAt: now };
      await kv.set(key(id), saved);
      if (!ids.includes(id)) await kv.set(INDEX, [...ids, id]);
      return saved;
    },
    async remove(id: string) {
      await kv.remove(key(id));
      await kv.set(INDEX, ((await kv.get<string[]>(INDEX)) ?? []).filter((x) => x !== id));
    },
  };
}
