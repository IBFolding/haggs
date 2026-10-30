import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { appOf, type App } from "../comfy/apps";
import { prepare, type Catalog, type UiWorkflow } from "../comfy/convert";
import { contestEntries, contestTemplate } from "./contest-workflows";
import { ltxEntries, ltxTemplate } from "./ltx-workflows";
import { partnerNodes } from "../comfy/partner";

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
  /** True when the workflow calls no partner API: it runs on open weights alone. Known once the library has been checked. */
  open?: boolean;
};

const dirOf = (root: string) => join(root, ".haggs", "comfy");

/** Warm copies kept in memory, so a host with a read-only disk still fetches each file once an hour of use, not on every request. */
const warm = new Map<string, { at: number; value: unknown }>();

async function cached<T>(root: string, file: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const path = join(dirOf(root), file);
  const held = warm.get(path);
  if (held && Date.now() - held.at < ttl) return held.value as T;
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { at: number; value: T };
    if (Date.now() - raw.at < ttl) return raw.value;
  } catch {
    // Not cached yet.
  }
  try {
    const value = await fetcher();
    warm.set(path, { at: Date.now(), value });
    // Keeping a copy on disk is a convenience. A read-only disk must not make a good answer fail.
    try {
      await mkdir(join(dirOf(root), "templates"), { recursive: true });
      await writeFile(path, JSON.stringify({ at: Date.now(), value }));
    } catch {
      // Hosted functions can't write here; the memory copy above still serves.
    }
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

/** Keeps a computed answer in memory and, where the disk allows, on disk too. */
async function keepAnswer<T>(root: string, file: string, value: T): Promise<void> {
  const at = Date.now();
  warm.set(join(dirOf(root), file), { at, value });
  try {
    await mkdir(dirOf(root), { recursive: true });
    await writeFile(join(dirOf(root), file), JSON.stringify({ at, value }));
  } catch {
    // A read-only disk is fine; the memory copy serves.
  }
}

/** The answer kept by keepAnswer, from memory or disk, while it is still fresh. */
async function recallAnswer<T>(root: string, file: string): Promise<T | null> {
  const path = join(dirOf(root), file);
  const held = warm.get(path);
  if (held && Date.now() - held.at < DAY) return held.value as T;
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { at: number; value: T };
    if (Date.now() - raw.at < DAY) return raw.value;
  } catch {
    // Not kept yet.
  }
  return null;
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
  const bundled = ltxTemplate(name) ?? contestTemplate(name);
  if (bundled) return Promise.resolve(bundled);
  return cached(root, `templates/${name}.json`, 7 * DAY, () => getJson(`${TEMPLATES}/${encodeURIComponent(name)}.json`) as Promise<UiWorkflow>);
}

type IndexCategory = { title: string; type?: string; templates: { name: string; title?: string; description?: string; tags?: string[]; models?: string[]; mediaSubtype?: string; usage?: number; io?: { inputs?: { file: string; mediaType: string }[] } }[] };

export async function indexOf(root: string): Promise<Entry[]> {
  const raw = await cached(root, "index.json", DAY, () => getJson(`${TEMPLATES}/index.json`) as Promise<IndexCategory[]>).catch(() => []);
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
  return [...ltxEntries(), ...contestEntries(), ...[...seen.values()].filter(e => !ltxTemplate(e.name) && !contestTemplate(e.name))];
}

/** The example input files a template ships with, so it can be tried in one click. */
export const exampleUrl = (file: string) => `${INPUTS}/${encodeURIComponent(file)}`;

export type Opened = { entry: Entry | null; ui: UiWorkflow; app: App; problems: string[]; catalog: Catalog };

export async function openTemplate(root: string, apiKey: string, name: string): Promise<Opened> {
  const [ui, catalog, index] = await Promise.all([templateOf(root, name), catalogOf(root, apiKey), indexOf(root)]);
  const entry = index.find((e) => e.name === name) ?? null;
  const { prompt, problems } = prepare(ui, catalog);
  const samples = Object.fromEntries((entry?.inputs ?? []).map((i) => [i.file, exampleUrl(i.file)]));
  return { entry, ui, app: appOf(ui, prompt, catalog, samples), problems, catalog };
}

/**
 * Which templates run here. Checking needs every template's graph, so it is
 * done once in the background and kept; until then the list shows them all.
 */
let checking: Promise<void> | null = null;
export async function checked(root: string, apiKey: string): Promise<Record<string, string | true> | null> {
  const known = await recallAnswer<Record<string, string | true>>(root, "runnable.json");
  if (known) return known;
  checking ??= (async () => {
    const [index, catalog] = await Promise.all([indexOf(root), catalogOf(root, apiKey)]);
    const out: Record<string, string | true> = {};
    const queue = [...index];
    await Promise.all(
      Array.from({ length: 12 }, async () => {
        for (let e = queue.shift(); e; e = queue.shift()) {
          try {
            const { problems } = prepare(await templateOf(root, e.name), catalog);
            out[e.name] = problems.length ? problems[0]! : true;
          } catch (caught) {
            out[e.name] = caught instanceof Error ? caught.message : "Couldn't be read.";
          }
        }
      }),
    );
    await keepAnswer(root, "runnable.json", out);
  })().finally(() => {
    checking = null;
  });
  return null;
}

/**
 * Which templates run on open weights alone: no node that calls a partner's
 * paid API. Computed once in the background from the node catalog and kept.
 */
let opening: Promise<void> | null = null;
export async function opens(root: string, apiKey: string): Promise<Record<string, boolean> | null> {
  const known = await recallAnswer<Record<string, boolean>>(root, "open.json");
  if (known) return known;
  opening ??= (async () => {
    const [index, catalog] = await Promise.all([indexOf(root), catalogOf(root, apiKey)]);
    const out: Record<string, boolean> = {};
    const queue = [...index];
    await Promise.all(
      Array.from({ length: 12 }, async () => {
        for (let e = queue.shift(); e; e = queue.shift()) {
          try {
            out[e.name] = partnerNodes(prepare(await templateOf(root, e.name), catalog).prompt, catalog).length === 0;
          } catch {
            // Unreadable templates are simply not marked.
          }
        }
      }),
    );
    await keepAnswer(root, "open.json", out);
  })().finally(() => {
    opening = null;
  });
  return null;
}
