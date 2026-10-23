import type { Canvas } from "../comfy/canvas";
import type { Recipe } from "../comfy/recipe";
import type { Kv } from "./kv";

/**
 * Your apps: workflows you built or opened, saved under a name with the
 * result they make as their cover, kept in this browser. An app travels as
 * one file (cover inside) that anyone can open in haggs.
 */

export type Cover = { url: string; kind: "image" | "video" };
export type SavedApp = { id: string; name: string; description: string; workflow: string; recipe?: Recipe; /** The canvas it was built on, to open and change again. */ canvas?: Canvas; cover?: Cover; /** Set when this copy came from the Community shelf: runs are charged to the creator's fee. */ community?: { id: string; feeCents: number; creatorName: string }; createdAt: number; updatedAt: number };
export type NewApp = Omit<SavedApp, "id" | "createdAt" | "updatedAt"> & Partial<Pick<SavedApp, "id" | "createdAt">>;

const INDEX = "apps/index";
const key = (id: string) => `apps/${id}`;

export function createAppStore(kv: Kv) {
  return {
    async list(): Promise<SavedApp[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const all = await Promise.all(ids.map((id) => kv.get<SavedApp>(key(id))));
      return all.filter((a): a is SavedApp => Boolean(a)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    load: (id: string) => kv.get<SavedApp>(key(id)),
    async save(app: NewApp): Promise<SavedApp> {
      const now = Date.now();
      // A strictly later stamp, so the newest save always sorts first.
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<SavedApp>(key(i))))).map((a) => a?.updatedAt ?? 0));
      const saved: SavedApp = { ...app, id: app.id ?? crypto.randomUUID(), createdAt: app.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
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

const FORMAT = "haggs.app/1";

export function appFile(app: SavedApp): string {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = app;
  return JSON.stringify({ format: FORMAT, ...rest }, null, 1);
}

/** An app file as a new app to save. Only a picture or clip inside the file is kept as its cover. */
export function readAppFile(text: string): NewApp {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("That isn't a haggs app file.");
  }
  if (raw?.format !== FORMAT) throw new Error("That isn't a haggs app file.");
  if (typeof raw.workflow !== "string" || raw.workflow.length > 5_000_000) throw new Error("That app file has no workflow in it.");
  const cover = raw.cover as Cover | undefined;
  const safeCover = cover && typeof cover.url === "string" && /^data:(image|video)\/[\w.+-]+;base64,/.test(cover.url) && (cover.kind === "image" || cover.kind === "video") ? { url: cover.url, kind: cover.kind } : undefined;
  return {
    name: String(raw.name ?? "An app").slice(0, 80),
    description: String(raw.description ?? "").slice(0, 400),
    workflow: raw.workflow,
    ...(raw.recipe && typeof raw.recipe === "object" ? { recipe: raw.recipe as Recipe } : {}),
    ...(safeCover ? { cover: safeCover } : {}),
  };
}
