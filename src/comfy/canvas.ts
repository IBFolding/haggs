import type { ApiPrompt } from "./convert";
import { addSave, addStep, STEPS, type Inputs, type Recipe, type Step, type StepKind } from "./recipe";

/**
 * Build your own workflow on an open canvas: steps and library workflows
 * placed anywhere, linked by what feeds what. A canvas compiles to one
 * ordinary Comfy workflow, so it tries, prices, runs and saves like any app.
 */

type Kind = "image" | "video";
export type CNode = { id: string; kind: StepKind | "library"; x: number; y: number; prompt?: string; seconds?: number; resolution?: string; voice?: string; template?: string };
export type Link = { from: string; to: string };
export type Canvas = { name: string; nodes: CNode[]; links: Link[] };
/** Library workflows by template name, already converted to API prompts. */
export type Library = Record<string, ApiPrompt>;

const LOADERS: Record<string, Kind> = { LoadImage: "image", LoadVideo: "video" };
const SAVERS: Record<string, { kind: Kind; input: string }> = { SaveImage: { kind: "image", input: "images" }, SaveImageAdvanced: { kind: "image", input: "images" }, PreviewImage: { kind: "image", input: "images" }, SaveVideo: { kind: "video", input: "video" } };
const stepInfo = (k: StepKind) => STEPS.find((s) => s.kind === k)!;
const word = (k: Kind) => (k === "image" ? "picture" : "video");

/** What a node takes and what it makes. A library workflow reads these off its own loaders and saver. */
export function portsOf(node: CNode, library: Library): { needs: Kind[]; makes: Kind } {
  if (node.kind !== "library") {
    const s = stepInfo(node.kind);
    return { needs: s.needs, makes: s.makes };
  }
  const tpl = library[node.template ?? ""];
  if (!tpl) throw new Error(`The workflow “${node.template ?? ""}” isn't loaded.`);
  const needs = [...new Set(Object.values(tpl).flatMap((n) => (LOADERS[n.class_type] ? [LOADERS[n.class_type]!] : [])))];
  const save = Object.values(tpl).find((n) => SAVERS[n.class_type]);
  if (!save) throw new Error(`The workflow “${node.template}” doesn't end in a picture or video haggs can stack.`);
  return { needs, makes: SAVERS[save.class_type]!.kind };
}

/** A recipe's chain as nodes in a row, each linked from what it needs. */
export function fromRecipe(recipe: Recipe): Canvas {
  const nodes: CNode[] = recipe.steps.map((s, i) => ({ id: `n${i + 1}`, kind: s.kind, x: i * 280, y: 0, ...(s.prompt !== undefined ? { prompt: s.prompt } : {}), ...(s.seconds !== undefined ? { seconds: s.seconds } : {}), ...(s.resolution !== undefined ? { resolution: s.resolution } : {}), ...(s.voice !== undefined ? { voice: s.voice } : {}) }));
  const links: Link[] = [];
  const last: Partial<Record<Kind, string>> = {};
  nodes.forEach((n) => {
    for (const need of stepInfo(n.kind as StepKind).needs) if (last[need]) links.push({ from: last[need]!, to: n.id });
    last[stepInfo(n.kind as StepKind).makes] = n.id;
  });
  return { name: recipe.name, nodes, links };
}

/** Copies a library workflow's nodes in, wiring its first picture/video loaders to what is linked and dropping its saver. */
function addLibrary(w: ApiPrompt, id: () => string, tpl: ApiPrompt, inp: Inputs): Inputs {
  const map = new Map<string, string>();
  const swap = new Map<string, [string, number]>();
  const used = new Set<Kind>();
  for (const [old, n] of Object.entries(tpl)) {
    const kind = LOADERS[n.class_type];
    if (kind && inp[kind] && !used.has(kind)) {
      used.add(kind);
      swap.set(old, inp[kind]!);
      continue;
    }
    if (SAVERS[n.class_type]) continue;
    map.set(old, id());
  }
  const fix = (v: unknown): unknown => (Array.isArray(v) && typeof v[0] === "string" && v.length === 2 ? (swap.get(v[0]) ? [swap.get(v[0])![0], swap.get(v[0])![1]] : map.has(v[0]) ? [map.get(v[0])!, v[1]] : v) : v);
  for (const [old, n] of Object.entries(tpl)) {
    const to = map.get(old);
    if (!to) continue;
    w[to] = { ...n, inputs: Object.fromEntries(Object.entries(n.inputs).map(([k, v]) => [k, fix(v)])) as never };
  }
  const save = Object.values(tpl).find((n) => SAVERS[n.class_type])!;
  const spec = SAVERS[save.class_type]!;
  const out = fix(save.inputs[spec.input]) as [string, number];
  return spec.kind === "image" ? { image: out } : { video: out };
}

export function compileCanvas(canvas: Canvas, library: Library): ApiPrompt {
  if (!canvas.nodes.length) throw new Error("Add a step first.");
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  const into = new Map<string, string[]>();
  const out = new Set<string>();
  for (const l of canvas.links) {
    if (!byId.has(l.from) || !byId.has(l.to) || l.from === l.to) continue;
    into.set(l.to, [...(into.get(l.to) ?? []), l.from]);
    out.add(l.from);
  }
  // Topological order, so every node is built after what feeds it.
  const order: CNode[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (n: CNode) => {
    if (state.get(n.id) === "done") return;
    if (state.get(n.id) === "visiting") throw new Error("Those links make a loop. A step can't feed itself.");
    state.set(n.id, "visiting");
    for (const from of into.get(n.id) ?? []) visit(byId.get(from)!);
    state.set(n.id, "done");
    order.push(n);
  };
  [...canvas.nodes].sort((a, b) => a.x - b.x).forEach(visit);

  const w: ApiPrompt = {};
  let counter = 0;
  const id = () => String(++counter);
  const made = new Map<string, Inputs>();
  order.forEach((n, i) => {
    const ports = portsOf(n, library);
    const inp: Inputs = {};
    for (const from of into.get(n.id) ?? []) {
      const m = made.get(from)!;
      if (m.image && !inp.image) inp.image = m.image;
      if (m.video && !inp.video) inp.video = m.video;
    }
    const label = n.kind === "library" ? `“${n.template}”` : `“${stepInfo(n.kind).label}”`;
    // A library workflow keeps any loader nothing is linked to, as an input the person drops in.
    if (n.kind !== "library") for (const need of ports.needs) if (!inp[need]) throw new Error(`${label} needs a ${word(need)}: link one into it.`);
    made.set(n.id, n.kind === "library" ? addLibrary(w, id, library[n.template!]!, inp) : addStep(w, id, n as Step & { kind: StepKind }, inp, 1000 + i));
  });
  const sinks = canvas.nodes.filter((n) => !out.has(n.id)).sort((a, b) => b.x - a.x);
  const end = sinks[0]!;
  const ends = portsOf(end, library).makes;
  addSave(w, id, made.get(end.id)!, ends);
  return w;
}

export type PlanStep = { kind?: string; template?: string; prompt?: string; seconds?: number; resolution?: string; voice?: string };
export type Plan = { name: string; steps: PlanStep[] };

/** A plan as nodes in a row. Unknown steps and library workflows that weren't offered are dropped, never guessed at. */
export function planToCanvas(plan: Plan, offered: string[]): Canvas {
  const nodes: CNode[] = [];
  const links: Link[] = [];
  const last: Partial<Record<Kind, string>> = {};
  let previous: string | null = null;
  let previousLib = false;
  for (const s of plan.steps) {
    const id = `n${nodes.length + 1}`;
    const x = nodes.length * 290;
    if (s.template && offered.includes(s.template)) {
      nodes.push({ id, kind: "library", x, y: 80, template: s.template });
      if (previous) links.push({ from: previous, to: id });
      previous = id;
      previousLib = true;
      continue;
    }
    const info = STEPS.find((k) => k.kind === s.kind);
    if (!info) continue;
    nodes.push({ id, kind: info.kind, x, y: 80, ...(s.prompt ? { prompt: s.prompt.slice(0, 2000) } : {}), ...(s.seconds ? { seconds: s.seconds } : {}), ...(s.resolution ? { resolution: s.resolution } : {}), ...(s.voice ? { voice: s.voice } : {}) });
    // A step right after a library workflow takes that workflow's result; otherwise, the latest step that makes what it needs.
    if (previousLib && previous && info.needs.length) links.push({ from: previous, to: id });
    else for (const need of info.needs) if (last[need]) links.push({ from: last[need]!, to: id });
    last[info.makes] = id;
    previous = id;
    previousLib = false;
  }
  return { name: plan.name.slice(0, 80) || "My app", nodes, links };
}

/** A plan from outside (Claude over MCP), checked before anything of it is used. */
export function checkPlan(raw: unknown): Plan {
  const p = raw as { name?: unknown; steps?: unknown } | null;
  if (!p || typeof p !== "object" || !Array.isArray(p.steps) || !p.steps.length) throw new Error("A plan needs at least one step.");
  if (p.steps.length > 12) throw new Error("Keep a plan to 12 steps or fewer.");
  const steps: PlanStep[] = p.steps.map((s: Record<string, unknown>) => {
    if (typeof s?.template === "string") {
      if (!/^[\w.-]{1,120}$/.test(s.template)) throw new Error(`“${s.template.slice(0, 40)}” isn't a library workflow name.`);
      return { template: s.template };
    }
    const kind = String(s?.kind ?? "");
    if (!STEPS.some((k) => k.kind === kind)) throw new Error(`“${kind}” isn't a step. Use ${STEPS.map((k) => k.kind).join(", ")}.`);
    const seconds = typeof s.seconds === "number" && Number.isFinite(s.seconds) ? Math.min(15, Math.max(4, Math.round(s.seconds))) : undefined;
    return { kind, ...(typeof s.prompt === "string" && s.prompt.trim() ? { prompt: s.prompt.trim().slice(0, 2000) } : {}), ...(seconds ? { seconds } : {}), ...(typeof s.resolution === "string" ? { resolution: s.resolution.slice(0, 8) } : {}), ...(typeof s.voice === "string" ? { voice: s.voice.slice(0, 60) } : {}) };
  });
  return { name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 80) : "My app", steps };
}
