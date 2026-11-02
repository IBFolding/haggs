import type { Canvas, CNode, Link } from "../comfy/canvas";
import { STEPS, type Recipe } from "../comfy/recipe";
import type { Kv } from "./kv";

/**
 * Your apps: workflows you built or opened, saved under a name with the
 * result they make as their cover, kept in this browser. An app travels as
 * one file (cover inside) that anyone can open in haggs.
 */

export type Cover = { url: string; kind: "image" | "video" };
export type SavedApp = { id: string; name: string; description: string; workflow: string; settings?: Record<string, string | number>; recipe?: Recipe; /** The canvas it was built on, to open and change again. */ canvas?: Canvas; cover?: Cover; /** Set when this copy came from the Community shelf: runs are charged to the creator's fee. */ community?: { id: string; feeCents: number; creatorName: string }; createdAt: number; updatedAt: number };
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

/** Validate an editable layout from an untrusted shared app before opening it. */
function readCanvas(raw:unknown):Canvas {
  const fail=():never=>{throw new Error("That app's editable layout is invalid.");};
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return fail();
  const canvas=raw as Record<string,unknown>;
  if(typeof canvas.name!=="string"||canvas.name.length>200||!Array.isArray(canvas.nodes)||canvas.nodes.length>500||!Array.isArray(canvas.links)||canvas.links.length>5000)return fail();
  const ids=new Set<string>(), kinds=new Set<string>(["library",...STEPS.map(step=>step.kind)]);
  const nodes:CNode[]=canvas.nodes.map((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return fail();
    const node=value as Record<string,unknown>;
    if(typeof node.id!=="string"||!node.id||node.id.length>120||ids.has(node.id)||typeof node.kind!=="string"||!kinds.has(node.kind)||typeof node.x!=="number"||!Number.isFinite(node.x)||typeof node.y!=="number"||!Number.isFinite(node.y))return fail();
    for(const field of ["prompt","resolution","voice","template"] as const)if(node[field]!==undefined&&(typeof node[field]!=="string"||(node[field] as string).length>4000))return fail();
    if(node.seconds!==undefined&&(typeof node.seconds!=="number"||!Number.isFinite(node.seconds)))return fail();
    if(node.kind==="library"&&(typeof node.template!=="string"||!node.template))return fail();
    ids.add(node.id);
    return {id:node.id,kind:node.kind as CNode["kind"],x:node.x,y:node.y,...(typeof node.prompt==="string"?{prompt:node.prompt}:{}),...(typeof node.seconds==="number"?{seconds:node.seconds}:{}),...(typeof node.resolution==="string"?{resolution:node.resolution}:{}),...(typeof node.voice==="string"?{voice:node.voice}:{}),...(typeof node.template==="string"?{template:node.template}:{})};
  });
  const links:Link[]=canvas.links.map((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return fail();const link=value as Record<string,unknown>;
    if(typeof link.from!=="string"||typeof link.to!=="string"||!ids.has(link.from)||!ids.has(link.to)||link.from===link.to)return fail();
    return {from:link.from,to:link.to};
  });
  return {name:canvas.name,nodes,links};
}

export function appFile(app: SavedApp): string {
  const { id: _id, createdAt: _c, updatedAt: _u, settings: _settings, ...rest } = app;
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
    ...(raw.canvas !== undefined ? { canvas: readCanvas(raw.canvas) } : {}),
    ...(safeCover ? { cover: safeCover } : {}),
  };
}
