import type { Kv } from "../story/kv";
import type { Product } from "./ads";

/** The products you make ads for: a name, the words that describe it, a picture, and an optional price line. */

export type NewProduct = Omit<Product, "id"> & { id?: string; createdAt?: number };
export type SavedProduct = Product & { createdAt: number; updatedAt: number };

const INDEX = "products/index";
const key = (id: string) => `products/${id}`;

export function createProductStore(kv: Kv) {
  return {
    async list(): Promise<SavedProduct[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<SavedProduct>(key(id))))).filter((p): p is SavedProduct => Boolean(p)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async save(input: NewProduct): Promise<SavedProduct> {
      const name = input.name.trim();
      if (!name) throw new Error("Give the product a name.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<SavedProduct>(key(i))))).map((x) => x?.updatedAt ?? 0));
      const now = Date.now();
      const saved: SavedProduct = { id: input.id ?? crypto.randomUUID(), name: name.slice(0, 60), words: input.words.trim().slice(0, 300), picture: input.picture, price: input.price.trim().slice(0, 40), createdAt: input.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
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
