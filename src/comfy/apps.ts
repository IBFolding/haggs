import type { ApiPrompt, Catalog, UiWorkflow } from "./convert";

/**
 * A Comfy workflow as a simple app: the files it needs dropped in, the words
 * it needs typed, and the few settings worth choosing. Everything else in
 * the graph stays as its author set it. This is what lets someone run a
 * Comfy workflow without opening the node editor, and still see the nodes.
 */

export type MediaKind = "image" | "video" | "audio";
export type Field =
  | { kind: "media"; node: string; input: string; media: MediaKind; label: string; sample?: string }
  | { kind: "text"; node: string; input: string; label: string; value: string }
  | { kind: "choice"; node: string; input: string; label: string; value: string; options: string[] }
  | { kind: "number"; node: string; input: string; label: string; value: number; min?: number; max?: number; step?: number };

export type App = { fields: Field[]; output: string | null; produces: MediaKind | "3d" | "text" | null };

/** Loaders and the input that names their file. */
const LOADERS: Record<string, { input: string; media: MediaKind }> = {
  LoadImage: { input: "image", media: "image" },
  LoadImageMask: { input: "image", media: "image" },
  LoadVideo: { input: "file", media: "video" },
  VHS_LoadVideo: { input: "video", media: "video" },
  LoadAudio: { input: "audio", media: "audio" },
  VHS_LoadAudioUpload: { input: "audio", media: "audio" },
};

/** Settings people actually change, by the last part of the input's name. */
const SETTINGS = /(^|\.)(resolution|aspect_ratio|ratio|duration|seconds|size|quality|mode|style)$/;
const SAVERS: Record<string, App["produces"]> = { SaveImage: "image", SaveImageAdvanced: "image", SaveVideo: "video", VHS_VideoCombine: "video", SaveAnimatedWEBP: "image", SaveAudio: "audio", SaveAudioMP3: "audio", SaveAudioOpus: "audio", SaveGLB: "3d", Save3D: "3d", SaveText: "text", PreviewAny: "text" };

const pretty = (s: string) => s.replace(/^model\./, "").replace(/_/g, " ").replace(/\b\w/, (c) => c.toUpperCase());

type Spec = [string | string[], Record<string, unknown>?];
type Inputs = { required?: Record<string, Spec>; optional?: Record<string, Spec> };

/** The spec of one input on a node, walking into the chosen option of nested inputs. */
export function specOfInput(catalog: Catalog, type: string, input: string, chosen: Record<string, unknown>): Spec | undefined {
  const def = catalog[type];
  if (!def) return undefined;
  const find = (inputs: Inputs, prefix: string): Spec | undefined => {
    for (const [name, spec] of [...Object.entries(inputs.required ?? {}), ...Object.entries(inputs.optional ?? {})]) {
      const key = prefix + name;
      if (key === input) return spec;
      if (spec[0] === "COMFY_DYNAMICCOMBO_V3" && input.startsWith(`${key}.`)) {
        const opt = ((spec[1]?.options as { key: string; inputs: Inputs }[]) ?? []).find((o) => o.key === chosen[key]);
        if (opt) return find(opt.inputs, `${key}.`);
      }
    }
    return undefined;
  };
  return find(def.input as Inputs, "");
}

export function appOf(ui: UiWorkflow, prompt: ApiPrompt, catalog: Catalog, samples: Record<string, string> = {}): App {
  const fields: Field[] = [];
  const titles = new Map<string, string>();
  for (const n of ui.nodes ?? []) if (n.title) titles.set(String(n.id), n.title);
  let output: string | null = null;
  let produces: App["produces"] = null;

  for (const [id, node] of Object.entries(prompt)) {
    const loader = LOADERS[node.class_type];
    if (loader) {
      const file = String(node.inputs[loader.input] ?? "");
      fields.push({ kind: "media", node: id, input: loader.input, media: loader.media, label: titles.get(id) ?? (loader.media === "image" ? "Picture" : loader.media === "video" ? "Video" : "Sound"), ...(samples[file] ? { sample: samples[file] } : {}) });
      continue;
    }
    if (SAVERS[node.class_type] && !output) {
      output = id;
      produces = SAVERS[node.class_type]!;
    }
    for (const [key, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value)) continue;
      const spec = specOfInput(catalog, node.class_type, key, node.inputs);
      if (!spec) continue;
      const opts = spec[1] ?? {};
      if (spec[0] === "STRING" && opts.multiline && typeof value === "string") {
        fields.push({ kind: "text", node: id, input: key, label: titles.get(id) ? `${titles.get(id)}` : pretty(key), value });
      } else if (SETTINGS.test(key)) {
        const choices = Array.isArray(spec[0]) ? spec[0] : spec[0] === "COMBO" ? ((opts.options as unknown[]) ?? []) : null;
        if (choices && choices.length > 1 && choices.length <= 40) fields.push({ kind: "choice", node: id, input: key, label: pretty(key), value: String(value), options: choices.map(String) });
        else if ((spec[0] === "INT" || spec[0] === "FLOAT") && typeof value === "number") fields.push({ kind: "number", node: id, input: key, label: pretty(key), value, ...(typeof opts.min === "number" ? { min: opts.min } : {}), ...(typeof opts.max === "number" ? { max: opts.max } : {}), ...(typeof opts.step === "number" ? { step: opts.step } : {}) });
      }
    }
  }
  // Media first, then words, then settings: the order you'd fill them in.
  const rank = { media: 0, text: 1, choice: 2, number: 2 } as const;
  fields.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return { fields, output, produces };
}

export type Values = Record<string, string | number | boolean>;

/** The prompt with the person's words, choices and uploaded file names put in. Only fields the app offers can change. */
export function fill(prompt: ApiPrompt, app: App, values: Values): ApiPrompt {
  const next = structuredClone(prompt);
  for (const f of app.fields) {
    const key = `${f.node}/${f.input}`;
    if (!(key in values)) continue;
    const v = values[key]!;
    if (f.kind === "choice" && !f.options.includes(String(v))) throw new Error(`${f.label} can't be “${v}”.`);
    if (f.kind === "number" && (typeof v !== "number" || !Number.isFinite(v) || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) throw new Error(`${f.label} is out of range.`);
    if (f.kind === "text" && (typeof v !== "string" || v.length > 8000)) throw new Error(`${f.label} is too long.`);
    if (f.kind === "media" && (typeof v !== "string" || !/^[-\w.]{1,200}$/.test(v))) throw new Error(`${f.label} didn't upload properly.`);
    next[f.node]!.inputs[f.input] = v;
  }
  return next;
}
