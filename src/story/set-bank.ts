import { normalizeScene, type GreyScene } from "./grey-scene";
import type { Kv } from "./kv";

/**
 * A set you built, kept so the next shot in the same place starts from it.
 * It holds the room, props, lights, look and air, but not the cut-out, which
 * belongs to one shot's footage.
 */

export type SavedSet = { id: string; name: string; createdAt: number; updatedAt: number; scene: GreyScene };

const INDEX = "sets/index";
const key = (id: string) => `sets/${id}`;
const uid = () => globalThis.crypto.randomUUID();

export function captureSet(scene: GreyScene, name: string): SavedSet {
  const { matte: _m, ...rest } = scene;
  const now = Date.now();
  return { id: uid(), name: name.trim().slice(0, 60), createdAt: now, updatedAt: now, scene: normalizeScene(rest) };
}

/** The set on a shot, in place of what it had; the shot keeps its own cut-out. Props and lights get new ids. */
export function applySet(shot: GreyScene, saved: SavedSet): GreyScene {
  const set = normalizeScene(saved.scene);
  return {
    ...set,
    ...(shot.matte ? { matte: shot.matte } : {}),
    props: (set.props ?? []).map((p) => ({ ...p, id: uid() })),
    lights: (set.lights ?? []).map((l) => ({ ...l, id: uid() })),
  };
}

export function createSetStore(kv: Kv) {
  return {
    async list(): Promise<SavedSet[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<SavedSet>(key(id))))).filter((s): s is SavedSet => Boolean(s)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async save(set: SavedSet): Promise<SavedSet> {
      const name = set.name.trim();
      if (!name) throw new Error("Give the set a name.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const saved = { ...set, name: name.slice(0, 60), updatedAt: Date.now() };
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
