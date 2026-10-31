"use server";
import { checkGenerationStorage } from "../server/generation-storage";

import { isBlobUrl } from "../server/blob";
import { charged, comfyAccess, readKey as platformReadKey } from "../server/platform";
import { readMedia } from "../server/media";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { cookies } from "next/headers";

import { fill, leaveOut, type App, type Values } from "../comfy/apps";
import { validate } from "../comfy/convert";
import { prepare, type UiWorkflow, type Catalog } from "../comfy/convert";
import { modelRequirements } from "../comfy/preflight";
import { boundedWorkflowCost } from "../comfy/bounded-price";
import { priceOf } from "../comfy/price";
import { createCloudRunner, type Kept } from "../providers/cloud";
import { appOf } from "../comfy/apps";
import { templateOf, catalogOf, checked, indexOf, openTemplate, opens, type Entry, type Opened } from "../server/comfy-library";
import { keepResult } from "../server/keep";
import { partnerNodes } from "../comfy/partner";
import { openOnlyIn, workflowRefusal } from "../comfy/open-only";
import { workflowRuntime } from "../comfy/runtime";
import { createLocalRunner, localBase } from "../providers/local";
import { CLAUDE_COOKIE, claudeWorkspaceIn, COMFY_COOKIE, keyIn, localIn } from "../server/keys";
import { contestVariant } from "../comfy/contest-lab";
import { addContestMasks, isContestMaskField } from "../comfy/contest-masks";
import { assertAlignedVideos } from "../server/contest-mask-timing";
import { openContest, openContestForDisplay, savedContestName } from "../server/contest-workflows";
import { haggsPreview } from "../comfy/haggs-preview";
import { isSavedHaggsPreview, savedHaggsPreviewName, openHaggsPreview, openHaggsPreviewForDisplay, previewInputProblem, previewValues } from "../server/haggs-preview-workflows";
import { ltxWorkflow } from "../comfy/ltx";
import { openLtx, openLtxForDisplay } from "../server/ltx-workflows";
import { STEPS } from "../comfy/recipe";
import { localFile, localUrl } from "../server/local-media";

/**
 * Comfy workflows as apps: list Comfy's templates, open one as a simple form,
 * price it, run it on Comfy Cloud with your files. Your own workflow files
 * open the same way.
 */

const root = () => process.cwd();
async function comfyKey() {
  // Your own key, or, on a plan, the platform's (reading Comfy's catalog costs nothing).
  return keyIn(await cookies(), COMFY_COOKIE) ?? (await platformReadKey());
}

/** A workflow by Comfy template name, or one you opened from a file (the editor's format, or the API format). */
export type Source = ({ template: string } | { file: string }) & { destination?: "local" | "cloud" };

async function open(key: string | undefined, source: Source): Promise<Opened> {
  const address = source.destination === "local" || (!key && source.destination !== "cloud") ? localIn(await cookies()) : undefined;
  if (source.destination === "local" && !address) throw new Error("Connect Your GPU in settings first. ComfyUI must be reachable from the Haggs server; a hosted server cannot reach your laptop's localhost.");
  if ("template" in source && (ltxWorkflow(source.template) || contestVariant(source.template) || haggsPreview(source.template))) {
    if ((contestVariant(source.template) || haggsPreview(source.template)) && !address) throw new Error("This Haggs preview requires a connected local ComfyUI with the relevant Haggs custom nodes installed. A cloud key alone cannot run it.");
    let catalog: Catalog;
    if (address) {
      const response = await fetch(`${localBase(address)}/object_info`, { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("Your local ComfyUI node catalog could not be loaded. No cloud fallback was attempted.");
      catalog = await response.json() as Catalog;
    } else {
      if (!key) throw new Error("Connect your local ComfyUI or add a Comfy key first.");
      catalog = await catalogOf(root(), key);
    }
    return contestVariant(source.template) ? openContest(source.template, catalog) : haggsPreview(source.template) ? openHaggsPreview(source.template, catalog) : openLtx(source.template, catalog);
  }
  if ("template" in source && address) {
    const ui = await templateOf(root(), source.template);
    const response = await fetch(`${localBase(address)}/object_info`, {redirect:"error", signal:AbortSignal.timeout(10000), cache:"no-store"});
    if (!response.ok) throw new Error("Your GPU: node catalog unavailable. Start ComfyUI and check its address in settings.");
    const catalog = await response.json() as Catalog;
    const {prompt, problems} = prepare(ui, catalog);
    return {entry:null,ui,app:appOf(ui,prompt,catalog),problems,catalog};
  }
  if ("template" in source) { if (!key) throw new Error("The cloud template library needs a Comfy key. Import your own workflow file to use your local ComfyUI without a cloud key."); return openTemplate(root(), key, source.template); }
  if (source.file.length > 5_000_000) throw new Error("Keep workflow files under 5 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(source.file);
  } catch {
    throw new Error("That isn't a Comfy workflow file.");
  }
  let catalog: Catalog;
  if (address) {
    const response = await fetch(`${localBase(address)}/object_info`, {redirect:"error",signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error("Your local ComfyUI node catalog could not be loaded.");
    catalog = await response.json() as Catalog;
  } else { if (!key) throw new Error("Connect your local ComfyUI or add a Comfy key first."); catalog = await catalogOf(root(), key); }
  const savedPreview = savedHaggsPreviewName(source.file);
  if (savedPreview) {
    if (!address) throw new Error("This Haggs preview requires a connected local ComfyUI with the matching custom nodes installed.");
    return openHaggsPreview(savedPreview, catalog);
  }
  const savedContest = savedContestName(source.file);
  if (savedContest) {
    if (!address) throw new Error("This Haggs effect requires a connected local ComfyUI with the matching custom nodes installed.");
    return openContest(savedContest, catalog);
  }
  // An API-format file is already a prompt: wrap each node so the editor-format path can read it unchanged.
  const ui = (raw as { nodes?: unknown }).nodes ? (raw as UiWorkflow) : apiToUi(raw as Record<string, { class_type: string; inputs: Record<string, unknown> }>);
  const { prompt, problems } = prepare(ui, catalog);
  return { entry: null, ui, app: appOf(ui, prompt, catalog), problems, catalog };
}

/** An API-format prompt as a minimal editor graph: values become a dict, wires become links. */
function apiToUi(api: Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }>): UiWorkflow {
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
    return { id, type: n.class_type, inputs, widgets_values: values, pos: [(i % 4) * 360, Math.floor(i / 4) * 260], size: [300, 160], ...(n._meta?.title ? { title: n._meta.title } : {}) };
  });
  return { nodes, links } as unknown as UiWorkflow;
}

export type Listing = { entries: Entry[]; checked: boolean; needsKey: boolean };

export async function listWorkflows(): Promise<Listing> {
  const key = await comfyKey();
  const entries = await indexOf(root());
  if (!key) return { entries, checked: false, needsKey: true };
  const runs = await checked(root(), key);
  const open = await opens(root(), key);
  if (open) for (const e of entries) if (e.name in open) e.open = open[e.name]!;
  if (runs) for (const e of entries) {
    const r = runs[e.name];
    e.runnable = r === true;
    if (r && r !== true) e.problem = r;
  }
  return { entries: runs ? entries.filter((e) => e.runnable || ltxWorkflow(e.name) || contestVariant(e.name)) : entries, checked: Boolean(runs), needsKey: false };
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

export type OpenedApp = { ok: true; name: string; title: string; description: string; thumb: string | null; app: App; problems: string[]; price: string; graph: Graph; workflow: string } | { ok: false; reason: string; needsKey?: boolean };

export async function openWorkflow(source: Source): Promise<OpenedApp> {
  const key = await comfyKey();
  const isHaggsEffect = "template" in source && Boolean(contestVariant(source.template));
  const isHaggsPreview = "template" in source && Boolean(haggsPreview(source.template));
  const isLtx = "template" in source && Boolean(ltxWorkflow(source.template));
  if (!isHaggsEffect && !isHaggsPreview && !isLtx && !key && !localIn(await cookies())) return { ok: false, reason: "Connect your local ComfyUI or add a Comfy key to open workflows.", needsKey: true };
  const name = "template" in source ? source.template : "your workflow";
  try {
    const opened = isHaggsEffect && "template" in source ? openContestForDisplay(source.template) : isHaggsPreview && "template" in source ? openHaggsPreviewForDisplay(source.template) : isLtx && "template" in source ? openLtxForDisplay(source.template) : await open(key, source);
    const { prompt } = prepare(opened.ui, opened.catalog);
    const samples = Object.fromEntries(opened.app.fields.flatMap((f) => (f.kind === "media" && f.sample ? [[String(prompt[f.node]?.inputs[f.input] ?? ""), f.sample]] : [])));
    return {
      ok: true,
      name,
      title: opened.entry?.title ?? name,
      description: opened.entry?.description ?? "",
      thumb: opened.entry?.thumb ?? null,
      app: opened.app,
      problems: opened.problems,
      price: isHaggsEffect || isHaggsPreview || isLtx ? "Check connection before running" : !partnerNodes(prompt, opened.catalog).length && (source.destination !== "cloud" && localIn(await cookies())) ? "Your GPU · no provider charge" : (await priceOf(prompt, opened.catalog)).label,
      graph: graphOf(opened.ui, samples),
      workflow: JSON.stringify(opened.ui),
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
    if (file.type.startsWith("video/")) return { bytes: await (await import("../server/video-fit")).fittedVideo(file.path), mime: file.type };
    return { bytes: new Uint8Array(await readFile(file.path)), mime: file.type };
  }
  if (isBlobUrl(source)) return readMedia(source);
  if (source.startsWith("https://raw.githubusercontent.com/Comfy-Org/workflow_templates/")) {
    const got = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!got.ok) throw new Error("Comfy's example file couldn't be fetched.");
    const mime = MIME[extname(new URL(source).pathname).toLowerCase()];
    if (!mime) throw new Error("That example file isn't a picture, video or sound.");
    return { bytes: new Uint8Array(await got.arrayBuffer()), mime };
  }
  throw new Error("Add the file from your computer or your media.");
}

export type Quote = { label: string; min: number; max: number; perSecond: boolean };

export async function quoteWorkflow(source: Source, values: Values): Promise<Quote> {
  const key = await comfyKey();
  if (!key && !localIn(await cookies())) return { label: "connect Comfy", min: 0, max: 0, perSecond: false };
  try {
    const opened = await open(key, source);
    const { prompt } = prepare(opened.ui, opened.catalog);
    if (source.destination !== "cloud" && localIn(await cookies()) && !partnerNodes(prompt,opened.catalog).length) return {label:"Your GPU · no provider charge",min:0,max:0,perSecond:false};
    const media = Object.fromEntries(Object.entries(values).filter(([k]) => opened.app.fields.some((f) => f.kind === "media" && `${f.node}/${f.input}` === k)));
    const words = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in media)));
    const previewName = 'template' in source ? source.template : savedHaggsPreviewName(source.file);
    const p = await priceOf(fill(prompt, opened.app, previewValues(previewName, words)), opened.catalog);
    return { label: p.label, min: p.min, max: p.max, perSecond: p.perSecond };
  } catch {
    return { label: "priced by Comfy at run", min: 0, max: 0, perSecond: false };
  }
}

export type Preflight = { ok: boolean; destination: string; connection: string; cost: string; issues: string[]; notes: string[] };

/** Read-only checks, repeated server-side before any upload or queue submission. */
export async function preflightWorkflow(source: Source, values: Values): Promise<Preflight> {
  const report: Preflight = {ok:false,destination:source.destination === "local" ? "Your GPU" : "Comfy Cloud",connection:"Not checked",cost:"Unknown",issues:[],notes:[]};
  try {
    const key = await comfyKey();
    const opened = await open(key, source);
    let {prompt} = prepare(opened.ui, opened.catalog);
    const address = source.destination === "cloud" ? undefined : localIn(await cookies());
    const runtime = workflowRuntime(prompt, opened.catalog, address, Boolean(key), source.destination);
    if (source.destination === "local" && runtime.kind !== "local") throw new Error("This workflow needs partner services. Choose a different workflow; Your GPU was not replaced with cloud execution.");
    report.destination = runtime.kind === "local" ? "Your GPU" : "Comfy Cloud";
    const base = runtime.kind === "local" ? runtime.base : "https://cloud.comfy.org/api";
    const headers: Record<string,string> = runtime.kind === "cloud" ? {"X-API-Key":key!} : {};
    const response = await fetch(`${base}/object_info`,{headers,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error("Node catalog unavailable. Check your Comfy connection and credentials in settings.");
    const catalog = await response.json() as Catalog;
    report.connection = "Connected · catalog checked now";
    const prepared = prepare(opened.ui,catalog);
    const previewName = 'template' in source ? source.template : savedHaggsPreviewName(source.file);
    const inputProblem = previewInputProblem(previewName, values);
    if (inputProblem) report.issues.push(inputProblem);
    prompt = fill(prepared.prompt,opened.app,previewValues(previewName,values));
    report.issues.push(...prepared.swaps.map(s => `Model substitution requires an explicit workflow edit: ${s}. No generation started.`), ...prepared.problems, ...validate(prompt,catalog), ...modelRequirements(prompt,catalog));
    const refusal = workflowRefusal(openOnlyIn(await cookies()),partnerNodes(prompt,catalog));
    if (refusal) report.issues.push(refusal);
    if (runtime.kind === "local") {
      report.cost = "No provider charge · your hardware and electricity";
      const stats = await fetch(`${base}/system_stats`,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)});
      if (!stats.ok) throw new Error("GPU status unavailable. Check ComfyUI /system_stats before generating.");
      const data = await stats.json() as {devices?:{name?:string;type?:string;vram_free?:number}[]};
      const devices = data.devices?.filter(d => d.type && d.type !== "cpu") ?? [];
      const sam2Cpu = previewName === 'haggs_sam2_mask_preview' && prompt['3']?.inputs.device === 'cpu';
      if (previewName === 'haggs_sam2_mask_preview') report.notes.push(sam2Cpu ? "SAM2 runs on your CPU and may be slow; the model may download on first use." : "SAM2 uses a model that may download on first use.");
      if (!devices.length && !sam2Cpu) {
        const localPreview = previewName !== 'haggs_sam2_mask_preview' && (("template" in source && (haggsPreview(source.template) || contestVariant(source.template)?.kind === "reuse")) || ("file" in source && (isSavedHaggsPreview(source.file) || contestVariant(savedContestName(source.file) ?? "")?.kind === "reuse")));
        if (localPreview) report.notes.push("CPU compositing · no model generation. This can take longer than a GPU.");
        else report.issues.push("No GPU reported by ComfyUI. Start ComfyUI with GPU support before generating.");
      }
      report.notes.push(...devices.map(d => `${d.name ?? d.type}: ${typeof d.vram_free === "number" ? (d.vram_free/2**30).toFixed(1)+" GiB free" : "free memory unknown"}`));
      report.notes.push("Available memory does not guarantee this workflow will fit; model-specific peak memory is unknown.");
    } else {
      const price = await priceOf(prompt,catalog);
      report.cost = price.label;
      if (!partnerNodes(prompt,catalog).length) {
        report.cost = "GPU time is billed by Comfy Cloud · estimate unavailable";
        report.issues.push("Cloud GPU cost and capacity cannot be verified here. Use Your GPU, or open this workflow in Comfy Cloud to review its charge before running.");
      } else if (boundedWorkflowCost(prompt,catalog,price) === null) report.notes.push("Final charges depend on inputs and runtime; review the displayed rate.");
      report.notes.push("Cloud catalog support is not evidence of reserved GPU capacity or a successful render.");
    }
    report.issues = [...new Set(report.issues)];
    report.ok = report.issues.length === 0;
  } catch (error) { report.issues.push(`${error instanceof Error ? error.message : "Connection check failed."} Check the selected Comfy connection in settings and retry; no job was submitted.`); }
  return report;
}

export type WorkflowResult = { ok: true; url: string; kind: "image" | "video" | "audio"; price: string } | { ok: false; reason: string; needsKey?: boolean };

/** Runs a Comfy workflow with your files and words. Never retried automatically. */
export async function runWorkflow(source: Source, values: Values, files: Record<string, string>): Promise<WorkflowResult> {
  const key = await comfyKey();
  if (!key && !localIn(await cookies())) return { ok: false, reason: "Connect your local ComfyUI or add a Comfy key to run workflows.", needsKey: true };
  try {
    const preflight = await preflightWorkflow(source, values);
    if (!preflight.ok) return {ok:false,reason:preflight.issues.join(" ")};
    const opened = await open(key, source);
    if (opened.problems.length) return { ok: false, reason: opened.problems[0]! };
    if (!opened.app.output) return { ok: false, reason: "This workflow doesn't save a result haggs can show." };
    if (opened.app.produces === "3d" || opened.app.produces === "text") return { ok: false, reason: `This workflow makes ${opened.app.produces === "3d" ? "a 3D model" : "text"}; open it in ComfyUI. haggs shows pictures, video and sound.` };
    let { prompt } = prepare(opened.ui, opened.catalog);
    const refused = workflowRefusal(openOnlyIn(await cookies()), partnerNodes(prompt, opened.catalog));
    if (refused) return { ok: false, reason: refused };
    // Open weights only, and your own ComfyUI set: run there, free, on your own GPU.
    const address = source.destination === "cloud" ? undefined : localIn(await cookies());
    const runtime = workflowRuntime(prompt, opened.catalog, address, Boolean(key), source.destination);
    const mine = runtime.kind === "local" ? runtime.base : null;
    let catalog = opened.catalog;
    if (mine) {
      catalog = (await (await fetch(`${mine}/object_info`, { redirect: "error", signal: AbortSignal.timeout(30_000) })).json()) as typeof opened.catalog;
      const local = prepare(opened.ui, catalog);
      if (local.swaps.length) return {ok:false,reason:"The model inventory changed. Edit the workflow to choose an installed model explicitly; no generation started."};
      const requirements = modelRequirements(local.prompt,catalog);
      if (requirements.length) return {ok:false,reason:requirements.join(" ")};
      if (local.problems.length) return { ok: false, reason: `Your ComfyUI can't run this yet: ${local.problems[0]}` };
      prompt = local.prompt;
    }
    const cloud = mine ? createLocalRunner({ base: mine, keep: keepResult }) : createCloudRunner({ apiKey: key!, keep: keepResult, beforeRun: checkGenerationStorage, timeoutMs: 40 * 60_000 });
    const uploaded: Values = {};
    const optionalMasks = opened.app.fields.filter(f => f.kind === "media" && f.optional && isContestMaskField(f.node));
    const allowedMasks = new Set(optionalMasks.map(f => `${f.node}/${f.input}`));
    if (Object.entries(files).some(([key, value]) => value && isContestMaskField(key.split('/')[0] ?? '') && !allowedMasks.has(key))) return {ok:false,reason:"One of the selected masks is not supported by this effect. Reload the app and choose a supported control; no generation was started."};
    const hasMasks = optionalMasks.some(f => Boolean(files[`${f.node}/${f.input}`]));
    const trackedMask = files['haggs_subject_mask_video/video'];
    if (trackedMask && files['haggs_subject_mask/image']) return {ok:false,reason:'Choose either a still subject mask or a tracked subject mask video, not both. No generation was started.'};
    const hasStillMasks = optionalMasks.some(f => f.kind === 'media' && f.media === 'image' && Boolean(files[`${f.node}/${f.input}`]));
    if (hasMasks && (!catalog.ImageToMask || (hasStillMasks && !catalog.LoadImage) || (trackedMask && (!catalog.LoadVideo || !catalog.GetVideoComponents)))) return {ok:false,reason:"Install the standard ComfyUI image and video nodes before using masks; no generation was started."};
    const cached: Record<string, Awaited<ReturnType<typeof mediaBytes>>> = {};
    if (trackedMask) {
      for (const k of ['10001/file','1/file','haggs_subject_mask_video/video']) {
        const field = opened.app.fields.find(f => f.kind === 'media' && `${f.node}/${f.input}` === k);
        const source = files[k] || (field?.kind === 'media' ? field.sample : undefined);
        if (!source) return {ok:false,reason:'Add the source video, effect layer and tracked mask before running.'};
        cached[k] = await mediaBytes(source);
      }
      await assertAlignedVideos(['10001/file','1/file','haggs_subject_mask_video/video'].map(k => cached[k]!.bytes));
    }
    // An empty choice leaves that input out of the run, with the wire it fed.
    const skipped = Object.entries(files).filter(([, v]) => v === "").map(([k]) => k);
    for (const field of opened.app.fields) {
      if (field.kind !== "media") continue;
      const k = `${field.node}/${field.input}`;
      if (skipped.includes(k)) continue;
      const source = files[k] ?? field.sample;
      if (!source && field.optional) continue;
      if (!source) return { ok: false, reason: `Add ${field.label.toLowerCase()} first.` };
      const { bytes, mime } = cached[k] ?? await mediaBytes(source);
      uploaded[k] = await cloud.uploadBytes(bytes, mime);
    }
    const basicApp = { ...opened.app, fields: opened.app.fields.filter(f => !(f.kind === "media" && f.optional && isContestMaskField(f.node))) };
    const previewName = 'template' in source ? source.template : savedHaggsPreviewName(source.file);
    const base = leaveOut(fill(prompt, basicApp, previewValues(previewName, { ...values, ...uploaded })), basicApp, skipped.filter(k => basicApp.fields.some(f => `${f.node}/${f.input}` === k)));
    const ready = optionalMasks.length ? addContestMasks(base, uploaded) : base;
    const missing = validate(ready, catalog);
    if (missing.length) return { ok: false, reason: `That input can't be left out: ${missing[0]}` };
    const quoted = mine ? null : await priceOf(ready, opened.catalog);
    const price = quoted ? quoted.label : "Your GPU · no provider charge";
    // Unknown or runtime-only prices cannot use the platform balance.
    if (!mine && !keyIn(await cookies(), COMFY_COOKIE)) {
      const estimate = quoted ? boundedWorkflowCost(ready, opened.catalog, quoted) : null;
      if (estimate === null) return {ok:false, reason:"This workflow has no reliable maximum price yet. Use your own Comfy key or local GPU; no generation was started."};
      const a = await comfyAccess(estimate, "Workflow", "Add a Comfy key to run Comfy workflows.");
      if (!a.ok) return { ok: false, reason: a.reason, ...(a.needsKey ? { needsKey: true as const } : {}) };
      return charged(a, async () => {
        try {
          const result = await cloud.run(ready, opened.app.output ?? undefined);
          return { ok: true as const, url: result.url, kind: result.kind, price };
        } catch (caught) {
          return { ok: false as const, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The workflow didn't run." };
        }
      });
    }
    const result = await cloud.run(ready, opened.app.output);
    return { ok: true, url: result.url, kind: result.kind, price };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The workflow didn't run." };
  }
}

/** Library workflows as API prompts, ready to stack on the canvas. Each must convert for Comfy Cloud. */
export async function libraryPrompts(names: string[]): Promise<{ ok: true; prompts: Record<string, import("../comfy/convert").ApiPrompt> } | { ok: false; reason: string; needsKey?: boolean }> {
  const key = await comfyKey();
  if (!key) return { ok: false, reason: "Add a Comfy key to stack library workflows.", needsKey: true };
  const prompts: Record<string, import("../comfy/convert").ApiPrompt> = {};
  try {
    for (const name of names.slice(0, 12)) {
      const opened = await openTemplate(root(), key, name);
      if (opened.problems.length) return { ok: false, reason: `“${opened.entry?.title ?? name}” can't be stacked: ${opened.problems[0]}` };
      prompts[name] = prepare(opened.ui, opened.catalog).prompt;
    }
    return { ok: true, prompts };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That workflow couldn't be loaded." };
  }
}

export type Planned = { ok: true; plan: import("../comfy/canvas").Plan; offered: string[]; titles: Record<string, string> } | { ok: false; reason: string; needsKey?: boolean };

/** Haggy turns a description into a chain of steps and library workflows. Costs a few cents of your own Claude account. */
export async function planCanvas(goal: string): Promise<Planned> {
  const claude = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!claude) return { ok: false, reason: "Add a Claude key to let Haggy plan it.", needsKey: true };
  if (goal.trim().length < 6) return { ok: false, reason: "Say what the app should do, in a sentence." };
  const words = goal.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const index = await indexOf(root());
  const key = await comfyKey();
  const runs = key ? await checked(root(), key) : null;
  const pool = index.filter((e) => (e.kind === "image" || e.kind === "video") && (!runs || runs[e.name] === true));
  const score = (e: Entry) => words.reduce((n, w) => n + (`${e.title} ${e.description} ${e.tags.join(" ")} ${e.models.join(" ")}`.toLowerCase().includes(w) ? 1 : 0), 0);
  const offered = pool.map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s || b.e.usage - a.e.usage).slice(0, 30).map((x) => x.e);
  const STEP_LINES = STEPS.map((s) => `- ${s.kind}: ${s.label} (takes ${s.needs.join(" + ") || "nothing"}, makes ${s.makes})`).join("\n");
  const system = `You design small Comfy apps as a chain of steps. Use only these step kinds:\n${STEP_LINES}\nand, when one fits better than a plain step, these library workflows by name:\n${offered.map((e) => `- ${e.name}: ${e.title}${e.models.length ? ` [${e.models.slice(0, 2).join(", ")}]` : ""}`).join("\n")}\nEach step needs a picture or video that an earlier step makes. Keep it to 2-6 steps. Write each prompt as the person would want it. Prefer open-weights library workflows when quality is similar.`;
  const { askClaude } = await import("../writer/draft");
  const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
  const str = { type: "string" };
  const schema = obj({ name: str, steps: { type: "array", items: obj({ kind: str, template: str, prompt: str }) } });
  const r = await askClaude<import("../comfy/canvas").Plan>({
    key: claude, workspaceId: claudeWorkspaceIn(await cookies()),
    request: { system, user: goal.trim().slice(0, 1000), maxTokens: 1500 },
    schema,
    read: (v) => {
      const p = v as { name?: unknown; steps?: { kind?: unknown; template?: unknown; prompt?: unknown }[] };
      return { name: String(p.name ?? "My app"), steps: (p.steps ?? []).map((s) => ({ ...(s.kind ? { kind: String(s.kind) } : {}), ...(s.template ? { template: String(s.template) } : {}), ...(s.prompt ? { prompt: String(s.prompt) } : {}) })) };
    },
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, plan: r.draft, offered: offered.map((e) => e.name), titles: Object.fromEntries(offered.map((e) => [e.name, e.title])) };
}
