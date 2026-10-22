import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { appOf, type App } from "../comfy/apps";
import { toApiPrompt, type Catalog, type UiWorkflow } from "../comfy/convert";

/**
 * Comfy's public workflow templates (MIT, Comfy-Org/workflow_templates) and
 * Comfy Cloud's live node catalog, fetched once and kept on disk for a day,
 * so the Workflows page opens instantly and works offline after the first
 * look. A template is offered only when it converts to a prompt Cloud can
 * run; the rest are listed with the reason.
 */

const TEMPLATES = "https://cloud.comfy.org/templates";
const INPUTS = "https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/input";
const DAY = 24 * 60 * 60 * 1000;
const NAME = /^[\w.-]{1,120}$/;

export type Entry = {
  name: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  tags: string[];
  models: string[];
  thumb: string;
  /** The template's example output is a moving picture (an animated webp). */
  usage: number;
  inputs: { file: string; media: string }[];
  runnable: boolean | null;
  problem?: string;
};

const dirOf = (root: string) => join(root, ".haggs", "comfy");

async function cached<T>(root: string, file: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const path = join(dirOf(root), file);
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { at: number; value: T };
    if (Date.now() - raw.at < ttl) return raw.value;
  } catch {
    // Not cached yet.
  }
  try {
    const value = await fetcher();
    await mkdir(join(dirOf(root), "templates"), { recursive: true });
    await writeFile(path, JSON.stringify({ at: Date.now(), value }));
    return value;
  } catch (caught) {
    // Offline or refused: an old copy is better than nothing.
    try {
      return (JSON.parse(await readFile(path, "utf8")) as { value: T }).value;
    } catch {
      throw caught;
    }
  }
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url.split("/").pop()} answered ${res.status}.`);
  return res.json();
}

/** Comfy Cloud's node catalog, as your key sees it. */
export function catalogOf(root: string, apiKey: string): Promise<Catalog> {
  return cached(root, "object_info.json", DAY, () => getJson("https://cloud.comfy.org/api/object_info", { "X-API-Key": apiKey }) as Promise<Catalog>);
}

export function templateOf(root: string, name: string): Promise<UiWorkflow> {
  if (!NAME.test(name)) throw new Error("That isn't a template name.");
  return cached(root, `templates/${name}.json`, 7 * DAY, () => getJson(`${TEMPLATES}/${encodeURIComponent(name)}.json`) as Promise<UiWorkflow>);
}

type IndexCategory = { title: string; type?: string; templates: { name: string; title?: string; description?: string; tags?: string[]; models?: string[]; mediaSubtype?: string; usage?: number; io?: { inputs?: { file: string; mediaType: string }[] } }[] };

export async function indexOf(root: string): Promise<Entry[]> {
  const raw = await cached(root, "index.json", DAY, () => getJson(`${TEMPLATES}/index.json`) as Promise<IndexCategory[]>);
  const seen = new Map<string, Entry>();
  for (const cat of raw) {
    for (const t of cat.templates) {
      if (seen.has(t.name) || t.mediaSubtype === "mp3") continue;
      seen.set(t.name, {
        name: t.name,
        title: t.title ?? t.name,
        description: t.description ?? "",
        category: cat.title,
        kind: cat.type ?? "image",
        tags: t.tags ?? [],
        models: t.models ?? [],
        thumb: `${TEMPLATES}/${encodeURIComponent(t.name)}-1.${t.mediaSubtype ?? "webp"}`,
        usage: t.usage ?? 0,
        inputs: (t.io?.inputs ?? []).map((i) => ({ file: i.file, media: i.mediaType })),
        runnable: null,
      });
    }
  }
  return [...seen.values()];
}

/** The example input files a template ships with, so it can be tried in one click. */
export const exampleUrl = (file: string) => `${INPUTS}/${encodeURIComponent(file)}`;

export type Opened = { entry: Entry | null; ui: UiWorkflow; app: App; problems: string[]; catalog: Catalog };

export async function openTemplate(root: string, apiKey: string, name: string): Promise<Opened> {
  const [ui, catalog, index] = await Promise.all([templateOf(root, name), catalogOf(root, apiKey), indexOf(root)]);
  const entry = index.find((e) => e.name === name) ?? null;
  const { prompt, problems } = toApiPrompt(ui, catalog);
  const samples = Object.fromEntries((entry?.inputs ?? []).map((i) => [i.file, exampleUrl(i.file)]));
  return { entry, ui, app: appOf(ui, prompt, catalog, samples), problems, catalog };
}

/**
 * Which templates run here. Checking needs every template's graph, so it is
 * done once in the background and kept; until then the list shows them all.
 */
let checking: Promise<void> | null = null;
export async function checked(root: string, apiKey: string): Promise<Record<string, string | true> | null> {
  try {
    const raw = JSON.parse(await readFile(join(dirOf(root), "runnable.json"), "utf8")) as { at: number; value: Record<string, string | true> };
    if (Date.now() - raw.at < DAY) return raw.value;
  } catch {
    // Not checked yet.
  }
  checking ??= (async () => {
    const [index, catalog] = await Promise.all([indexOf(root), catalogOf(root, apiKey)]);
    const out: Record<string, string | true> = {};
    const queue = [...index];
    await Promise.all(
      Array.from({ length: 12 }, async () => {
        for (let e = queue.shift(); e; e = queue.shift()) {
          try {
            const { problems } = toApiPrompt(await templateOf(root, e.name), catalog);
            out[e.name] = problems.length ? problems[0]! : true;
          } catch (caught) {
            out[e.name] = caught instanceof Error ? caught.message : "Couldn't be read.";
          }
        }
      }),
    );
    await writeFile(join(dirOf(root), "runnable.json"), JSON.stringify({ at: Date.now(), value: out }));
  })().finally(() => {
    checking = null;
  });
  return null;
}
