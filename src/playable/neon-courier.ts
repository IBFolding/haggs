import type { Kv } from "../story/kv";
import { readSpec } from "./spec";
import { createGameStore } from "./store";

export const NEON_COURIER_ID = "4a898290-4d3";

/** Keep the original identity and never replace an existing record or its history. */
export async function saveNeonCourier(kv: Kv, load: () => Promise<unknown>) {
  const store = createGameStore(kv, Date.now, () => NEON_COURIER_ID);
  const key = `playable/${NEON_COURIER_ID}`;
  const existing = await kv.get(key);
  if (existing !== undefined) {
    const game = await store.get(NEON_COURIER_ID);
    if (!game) throw new Error("An existing save could not be read. It has been preserved.");
    return game;
  }
  const spec = readSpec(await load());
  if (spec.template !== "code" || spec.title !== "Neon Courier") throw new Error("The Neon Courier export could not be verified.");
  // Recheck after downloading, before the write, to preserve edits made meanwhile.
  if (await kv.get(key) !== undefined) {
    const game = await store.get(NEON_COURIER_ID);
    if (!game) throw new Error("An existing save could not be read. It has been preserved.");
    return game;
  }
  return store.create(spec);
}
