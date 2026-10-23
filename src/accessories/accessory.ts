import type { Kv } from "../story/kv";

/**
 * Accessories: the things a character wears or carries (a red scarf, round
 * glasses, a leather jacket, a vintage camera), kept once with a picture so
 * they can be put on anyone in any shot. Like characters and places they live
 * in your bank and are picked from wherever you are working.
 */

export type Accessory = { id: string; name: string; words: string; picture: string | null; createdAt: number; updatedAt: number };
export type NewAccessory = Omit<Accessory, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Accessory, "id" | "createdAt">>;

const INDEX = "accessories/index";
const key = (id: string) => `accessories/${id}`;

/** The words that put it on someone: its description, or its name when there is none. */
export const accessoryWords = (a: Pick<Accessory, "name" | "words">) => (a.words.trim() || a.name.trim()).replace(/[.\s]+$/, "");

/** Several accessories as one phrase for a prompt: "a red scarf, round glasses and a leather jacket". */
export function wearing(items: Pick<Accessory, "name" | "words">[]): string {
  const parts = items.map(accessoryWords).filter(Boolean);
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function createAccessoryStore(kv: Kv) {
  return {
    async list(): Promise<Accessory[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<Accessory>(key(id))))).filter((a): a is Accessory => Boolean(a)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    load: (id: string) => kv.get<Accessory>(key(id)),
    async save(input: NewAccessory): Promise<Accessory> {
      const name = input.name.trim();
      if (!name) throw new Error("Give it a name.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<Accessory>(key(i))))).map((x) => x?.updatedAt ?? 0));
      const now = Date.now();
      const saved: Accessory = { id: input.id ?? crypto.randomUUID(), name: name.slice(0, 60), words: input.words.trim().slice(0, 300), picture: input.picture, createdAt: input.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
      await kv.set(key(saved.id), saved);
      if (!ids.includes(saved.id)) await kv.set(INDEX, [...ids, saved.id]);
      return saved;
    },
    async remove(id: string) {
      await kv.remove(key(id));
      await kv.set(INDEX, ((await kv.get<string[]>(INDEX)) ?? []).filter((x) => x !== id));
    },
  };
}
