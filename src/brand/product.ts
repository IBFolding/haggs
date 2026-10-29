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

/** The ready-made photo for one of the Ads samples, matched by name, for a sample saved before it had one. */
export function samplePhotoFor(product: { name: string }, samples: { product: { name: string; picture?: string } }[]): string | null {
  const name = product.name.trim().toLowerCase();
  return samples.find((s) => s.product.name.toLowerCase() === name)?.product.picture ?? null;
}

/** The words that make a product photo from what the product looks like: a plain studio shot, nothing else in it. */
export function productPhotoPrompt(product: { name: string; words: string }): string {
  const what = (product.words.trim() || product.name.trim()).replace(/[.\s]+$/, "");
  return `Studio product photograph of ${what}, the product alone and centred, on a plain light background, soft even studio light, true colours, sharp detail. No text, no logos, no watermark, no other objects.`;
}
