"use server";

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { cookies } from "next/headers";

import { fill, type App, type Values } from "../comfy/apps";
import { toApiPrompt, type UiWorkflow } from "../comfy/convert";
import { priceOf } from "../comfy/price";
import { createCloudRunner, type Kept } from "../providers/cloud";
import { appOf } from "../comfy/apps";
import { catalogOf, checked, indexOf, openTemplate, type Entry, type Opened } from "../server/comfy-library";
import { COMFY_COOKIE, keyIn } from "../server/keys";
import { localFile, localUrl } from "../server/local-media";

/**
 * Comfy workflows as apps: list Comfy's templates, open one as a simple form,
 * price it, run it on Comfy Cloud with your files. Your own workflow files
 * open the same way.
 */

const root = () => process.cwd();
async function comfyKey() {
  return keyIn(await cookies(), COMFY_COOKIE);
}

/** A workflow by Comfy template name, or one you opened from a file (the editor's format, or the API format). */
export type Source = { template: string } | { file: string };

async function open(key: string, source: Source): Promise<Opened> {
  if ("template" in source) return openTemplate(root(), key, source.template);
  if (source.file.length > 5_000_000) throw new Error("Keep workflow files under 5 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(source.file);
  } catch {
    throw new Error("That isn't a Comfy workflow file.");
  }
  const catalog = await catalogOf(root(), key);
  // An API-format file is already a prompt: wrap each node so the editor-format path can read it unchanged.
  const ui = (raw as { nodes?: unknown }).nodes ? (raw as UiWorkflow) : apiToUi(raw as Record<string, { class_type: string; inputs: Record<string, unknown> }>);
  const { prompt, problems } = toApiPrompt(ui, catalog);
  return { entry: null, ui, app: appOf(ui, prompt, catalog), problems, catalog };
}

/** An API-format prompt as a minimal editor graph: values become a dict, wires become links. */
function apiToUi(api: Record<string, { class_type: string; inputs: Record<string, unknown> }>): UiWorkflow {
  if (!api || typeof api !== "object" || !Object.values(api).every((n) => n && typeof n.class_type === "string")) throw new Error("That isn't a Comfy workflow file.");
  const links: [number, string, number, string, number, string][] = [];
  const nodes = Object.entries(api).map(([id, n], i) => {
    const values: Record<string, unknown> = {};
    const inputs: { name: string; link: number | null }[] = [];
    for (const [name, v] of Object.entries(n.inputs ?? {})) {
      if (Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number")) {
        links.push([links.length + 1, String(v[0]), Number(v[1]), id, inputs.length, "*"]);
        inputs.push({ name, link: links.length });
      } else values[name] = v;
    }
    return { id, type: n.class_type, inputs, widgets_values: values, pos: [(i % 4) * 360, Math.floor(i / 4) * 260], size: [300, 160] };
  });
  return { nodes, links } as unknown as UiWorkflow;
}

export type Listing = { entries: Entry[]; checked: boolean; needsKey: boolean };

export async function listWorkflows(): Promise<Listing> {
  const key = await comfyKey();
  const entries = await indexOf(root());
  if (!key) return { entries, checked: false, needsKey: true };
  const runs = await checked(root(), key);
  if (runs) for (const e of entries) {
    const r = runs[e.name];
    e.runnable = r === true;
    if (r && r !== true) e.problem = r;
  }
  return { entries: runs ? entries.filter((e) => e.runnable) : entries, checked: Boolean(runs), needsKey: false };
}

export type GraphNode = { id: string; title: string; type: string; x: number; y: number; w: number; h: number; media?: string; note?: string };
export type Graph = { nodes: GraphNode[]; links: { from: string; to: string; type: string }[] };

/** The workflow's nodes as the editor laid them out, for looking at. Notes and reroutes are left out. */
function graphOf(ui: UiWorkflow, samples: Record<string, string>): Graph {
  const skip = new Set(["MarkdownNote", "Note", "Reroute", "PrimitiveNode"]);
  const subgraphs = new Map((ui.definitions?.subgraphs ?? []).map((s) => [s.id, s.name ?? "Group"]));
  const nodes: GraphNode[] = [];
  for (const n of ui.nodes as (UiWorkflow["nodes"][number] & { pos?: [number, number] | { 0: number; 1: number }; size?: [number, number] | { 0: number; 1: number } })[]) {
    if (skip.has(n.type)) continue;
    const pos = n.pos ? [Number(n.pos[0]), Number(n.pos[1])] : [0, 0];
    const size = n.size ? [Number(n.size[0]), Number(n.size[1])] : [300, 120];
    const file = Array.isArray(n.widgets_values) && typeof n.widgets_values[0] === "string" ? n.widgets_values[0] : "";
    const words = (Array.isArray(n.widgets_values) ? n.widgets_values : Object.values(n.widgets_values ?? {})).find((v): v is string => typeof v === "string" && v.length > 24 && !/\.(png|jpe?g|webp|mp4|mov|webm|wav|mp3|safetensors|gguf|ckpt)$/i.test(v));
    nodes.push({ ...(words ? { note: words.slice(0, 220) } : {}), id: String(n.id), title: n.title ?? subgraphs.get(n.type) ?? n.type.replace(/([a-z])([A-Z])/g, "$1 $2"), type: n.type, x: pos[0]!, y: pos[1]!, w: size[0]!, h: Math.min(size[1]!, 400), ...(samples[file] ? { media: samples[file] } : {}) });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const links = (ui.links as unknown[]).map((l) => (Array.isArray(l) ? { from: String(l[1]), to: String(l[3]), type: String(l[5]) } : { from: String((l as { origin_id: number }).origin_id), to: String((l as { target_id: number }).target_id), type: String((l as { type?: string }).type ?? "") })).filter((l) => ids.has(l.from) && ids.has(l.to));
  return { nodes, links };
}

export type OpenedApp = { ok: true; name: string; title: string; description: string; thumb: string | null; app: App; problems: string[]; price: string; graph: Graph } | { ok: false; reason: string; needsKey?: boolean };

export async function openWorkflow(source: Source): Promise<OpenedApp> {
  const key = await comfyKey();
  if (!key) return { ok: false, reason: "Add a Comfy key to open Comfy workflows.", needsKey: true };
  const name = "template" in source ? source.template : "your workflow";
  try {
    const opened = await open(key, source);
    const { prompt } = toApiPrompt(opened.ui, opened.catalog);
    const samples = Object.fromEntries(opened.app.fields.flatMap((f) => (f.kind === "media" && f.sample ? [[String(prompt[f.node]?.inputs[f.input] ?? ""), f.sample]] : [])));
    return {
      ok: true,
      name,
      title: opened.entry?.title ?? name,
      description: opened.entry?.description ?? "",
      thumb: opened.entry?.thumb ?? null,
      app: opened.app,
      problems: opened.problems,
      price: (await priceOf(prompt, opened.catalog)).label,
      graph: graphOf(opened.ui, samples),
    };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That workflow couldn't be opened." };
  }
}

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac", ".m4a": "audio/mp4", ".ogg": "audio/ogg" };

/** A file for a workflow: something you dropped (a data URI), your local media, or one of Comfy's own example inputs. Nothing else is fetched. */
async function mediaBytes(source: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const data = /^data:([\w/+.-]+);base64,(.+)$/.exec(source);
  if (data) return { bytes: Uint8Array.from(Buffer.from(data[2]!, "base64")), mime: data[1]! };
  if (source.startsWith("/api/local/")) {
    const file = localFile(process.env.HAGGS_LOCAL_MEDIA, source.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
    if (!file) throw new Error("That file isn't in the local media folder.");
    return { bytes: new Uint8Array(await readFile(file.path)), mime: file.type };
  }
  if (source.startsWith("https://raw.githubusercontent.com/Comfy-Org/workflow_templates/")) {
    const got = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!got.ok) throw new Error("Comfy's example file couldn't be fetched.");
    const mime = MIME[extname(new URL(source).pathname).toLowerCase()];
    if (!mime) throw new Error("That example file isn't a picture, video or sound.");
    return { bytes: new Uint8Array(await got.arrayBuffer()), mime };
  }
  throw new Error("Add the file from your computer or your media.");
}

async function keep(bytes: Uint8Array, extension: Kept): Promise<string> {
  const rootDir = process.env.HAGGS_LOCAL_MEDIA;
  if (!rootDir || process.env.NODE_ENV === "production") throw new Error("Set HAGGS_LOCAL_MEDIA so results have somewhere to be kept.");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  await mkdir(join(rootDir, "haggs-renders"), { recursive: true });
  await writeFile(join(rootDir, "haggs-renders", name), bytes);
  return localUrl("haggs-renders", name);
}

export type Quote = { label: string; min: number; max: number; perSecond: boolean };

export async function quoteWorkflow(source: Source, values: Values): Promise<Quote> {
  const key = await comfyKey();
  if (!key) return { label: "add a Comfy key", min: 0, max: 0, perSecond: false };
  try {
    const opened = await open(key, source);
    const { prompt } = toApiPrompt(opened.ui, opened.catalog);
    const media = Object.fromEntries(Object.entries(values).filter(([k]) => opened.app.fields.some((f) => f.kind === "media" && `${f.node}/${f.input}` === k)));
    const words = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in media)));
    const p = await priceOf(fill(prompt, opened.app, words), opened.catalog);
    return { label: p.label, min: p.min, max: p.max, perSecond: p.perSecond };
  } catch {
    return { label: "priced by Comfy at run", min: 0, max: 0, perSecond: false };
  }
}

export type WorkflowResult = { ok: true; url: string; kind: "image" | "video" | "audio"; price: string } | { ok: false; reason: string; needsKey?: boolean };

/** Runs a Comfy workflow with your files and words. Never retried automatically. */
export async function runWorkflow(source: Source, values: Values, files: Record<string, string>): Promise<WorkflowResult> {
  const key = await comfyKey();
  if (!key) return { ok: false, reason: "Add a Comfy key to run Comfy workflows.", needsKey: true };
  try {
    const opened = await open(key, source);
    if (opened.problems.length) return { ok: false, reason: opened.problems[0]! };
    if (!opened.app.output) return { ok: false, reason: "This workflow doesn't save a result haggs can show." };
    if (opened.app.produces === "3d" || opened.app.produces === "text") return { ok: false, reason: `This workflow makes ${opened.app.produces === "3d" ? "a 3D model" : "text"}; open it in ComfyUI. haggs shows pictures, video and sound.` };
    const { prompt } = toApiPrompt(opened.ui, opened.catalog);
    const cloud = createCloudRunner({ apiKey: key, keep });
    const uploaded: Values = {};
    for (const field of opened.app.fields) {
      if (field.kind !== "media") continue;
      const k = `${field.node}/${field.input}`;
      const source = files[k] ?? field.sample;
      if (!source) return { ok: false, reason: `Add ${field.label.toLowerCase()} first.` };
      const { bytes, mime } = await mediaBytes(source);
      uploaded[k] = await cloud.uploadBytes(bytes, mime);
    }
    const ready = fill(prompt, opened.app, { ...values, ...uploaded });
    const price = (await priceOf(ready, opened.catalog)).label;
    const result = await cloud.run(ready, opened.app.output);
    return { ok: true, url: result.url, kind: result.kind, price };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The workflow didn't run." };
  }
}
