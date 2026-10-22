/**
 * Comfy workflows as people save them — the editor's graph, with widget
 * values in a list and wires as links — turned into the API prompt Comfy
 * runs, the way ComfyUI's own frontend does when you press Queue.
 *
 * Handles what Comfy's templates use: nested "dynamic combo" options and
 * autogrow inputs, seed controls, Reroute and Primitive nodes, bypassed and
 * muted nodes, and subgraphs (flattened, with their promoted widget values).
 * Every result is checked against the node catalog, so a workflow that
 * can't run here says why before anything is sent.
 */

export type Spec = [string | string[], Record<string, unknown>?];
export type NodeDef = {
  input: { required?: Record<string, Spec>; optional?: Record<string, Spec> };
  input_order?: { required?: string[]; optional?: string[] };
  output?: string[];
  output_node?: boolean;
  display_name?: string;
  api_node?: boolean;
  price_badge?: unknown;
};
export type Catalog = Record<string, NodeDef>;

type UiInput = { name: string; type?: string; link: number | null; widget?: { name: string } };
type UiOutput = { name: string; type?: string; links?: number[] | null };
export type UiNode = { id: number | string; type: string; mode?: number; inputs?: UiInput[]; outputs?: UiOutput[]; widgets_values?: unknown[] | Record<string, unknown>; title?: string };
type ArrayLink = [number, number | string, number, number | string, number, string];
type ObjectLink = { id: number; origin_id: number | string; origin_slot: number; target_id: number | string; target_slot: number; type?: string };
type Subgraph = { id: string; name?: string; nodes: UiNode[]; links: ObjectLink[]; inputs: { name: string; type?: string; linkIds?: number[] }[]; outputs: { name: string; type?: string; linkIds?: number[] }[] };
export type UiWorkflow = { nodes: UiNode[]; links: (ArrayLink | ObjectLink)[]; definitions?: { subgraphs?: Subgraph[] } };

export type ApiNode = { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } };
export type ApiPrompt = Record<string, ApiNode>;

/** Nodes that only exist in the editor. */
const EDITOR_ONLY = new Set(["Note", "MarkdownNote", "PrimitiveNode", "Reroute", "GroupNode"]);
/** Nodes that only show something inside the editor; a run has nothing to give them. */
const VIEW_ONLY = new Set(["ImageCompare"]);
const CONTROLS = new Set(["fixed", "increment", "decrement", "randomize", "increment-wrap"]);
const WIDGET_TYPES = new Set(["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO", "COMFY_DYNAMICCOMBO_V3"]);
const BYPASS = 4;
const MUTED = 2;

const options = (spec: Spec) => spec[1] ?? {};

/** Types that travel along wires: anything some node outputs. Everything else is a widget the editor stores a value for. */
const wired = new WeakMap<Catalog, Set<string>>();
let current: Set<string> = new Set(["IMAGE", "LATENT", "MODEL", "CLIP", "VAE", "CONDITIONING", "MASK", "VIDEO", "AUDIO"]);
export function useCatalog(catalog: Catalog) {
  let types = wired.get(catalog);
  if (!types) {
    types = new Set(Object.values(catalog).flatMap((d) => d.output ?? []).filter((t): t is string => typeof t === "string"));
    for (const t of WIDGET_TYPES) types.delete(t);
    wired.set(catalog, types);
  }
  current = types;
}
const isWidget = (spec: Spec) => {
  if (Array.isArray(spec[0]) || WIDGET_TYPES.has(spec[0] as string)) return true;
  if (spec[0] === "COMFY_AUTOGROW_V3") return false;
  return options(spec).socketless === true || !current.has(spec[0] as string);
};

function ordered(section: Record<string, Spec> | undefined, order: string[] | undefined): [string, Spec][] {
  if (!section) return [];
  const names = order?.filter((n) => n in section) ?? Object.keys(section);
  return names.map((n) => [n, section[n]!]);
}

/**
 * The widget values a node's definition asks for, in the order the editor
 * stores them: required then optional, a dynamic combo's chosen option's own
 * inputs straight after it, and a seed's control value after the seed.
 */
export function readWidgets(def: NodeDef, values: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let i = 0;
  const walk = (inputs: NodeDef["input"], order: NodeDef["input_order"] | undefined, prefix: string) => {
    for (const [name, spec] of [...ordered(inputs.required, order?.required), ...ordered(inputs.optional, order?.optional)]) {
      if (!isWidget(spec)) continue;
      if (i >= values.length) return;
      const key = prefix + name;
      let value = values[i++];
      // A stray control value where a real one belongs is skipped, not taken as the value.
      while (typeof value === "string" && CONTROLS.has(value) && (spec[0] === "INT" || spec[0] === "FLOAT") && i < values.length) value = values[i++];
      out[key] = value;
      if ((spec[0] === "INT" || spec[0] === "FLOAT") && (options(spec).control_after_generate || /seed/i.test(name)) && typeof values[i] === "string" && CONTROLS.has(values[i] as string)) i++;
      if (spec[0] === "COMFY_DYNAMICCOMBO_V3") {
        const chosen = (options(spec).options as { key: string; inputs: NodeDef["input"] }[] | undefined)?.find((o) => o.key === value);
        if (chosen) walk(chosen.inputs, undefined, `${key}.`);
      }
    }
  };
  walk(def.input, def.input_order, "");
  return out;
}

/** Every input name a node accepts, nested options and autogrow slots included, with its spec. */
export function acceptedInputs(def: NodeDef, chosen: Record<string, unknown>): Map<string, Spec> {
  const out = new Map<string, Spec>();
  const walk = (inputs: NodeDef["input"], prefix: string) => {
    for (const [name, spec] of [...Object.entries(inputs.required ?? {}), ...Object.entries(inputs.optional ?? {})]) {
      const key = prefix + name;
      out.set(key, spec);
      if (spec[0] === "COMFY_DYNAMICCOMBO_V3") {
        const pick = (options(spec).options as { key: string; inputs: NodeDef["input"] }[] | undefined)?.find((o) => o.key === chosen[key]);
        if (pick) walk(pick.inputs, `${key}.`);
      }
      if (spec[0] === "COMFY_AUTOGROW_V3") {
        const t = options(spec).template as { input?: NodeDef["input"]; names?: string[] } | undefined;
        const inner = Object.values({ ...(t?.input?.required ?? {}), ...(t?.input?.optional ?? {}) })[0];
        for (const slot of t?.names ?? []) if (inner) out.set(`${key}.${slot}`, inner);
      }
    }
  };
  walk(def.input, "");
  return out;
}

type Link = { origin: string; slot: number; target: string; targetSlot: number };

/** Flattens subgraphs into one graph whose node ids are "instance:inner". */
function flatten(ui: UiWorkflow): { nodes: Map<string, UiNode>; links: Map<number | string, Link>; promoted: Map<string, Record<number, unknown>>; ports: Map<string, string[]> } {
  const subgraphs = new Map((ui.definitions?.subgraphs ?? []).map((s) => [s.id, s]));
  const nodes = new Map<string, UiNode>();
  const links = new Map<number | string, Link>();
  // For an inner input fed by a subgraph input that nothing outside wires: the instance's widget value.
  const promoted = new Map<string, Record<number, unknown>>();
  // Each instance's subgraph input names by index; the instance itself may list only some of them, in its own order.
  const ports = new Map<string, string[]>();

  const asLink = (l: ArrayLink | ObjectLink): ObjectLink => (Array.isArray(l) ? { id: l[0], origin_id: l[1], origin_slot: l[2], target_id: l[3], target_slot: l[4], type: l[5] } : l);

  const expand = (graphNodes: UiNode[], graphLinks: ObjectLink[], scope: string, depth: number) => {
    if (depth > 8) throw new Error("The workflow's subgraphs nest too deeply to run here.");
    const id = (n: number | string) => (scope ? `${scope}:${n}` : String(n));
    for (const node of graphNodes) {
      const sg = subgraphs.get(node.type);
      if (!sg) {
        nodes.set(id(node.id), { ...node, id: id(node.id) });
        continue;
      }
      // A subgraph instance: its inner nodes join the graph, and its edges are rewired at the end.
      nodes.set(id(node.id), { ...node, id: id(node.id), type: `subgraph:${sg.id}` });
      expand(sg.nodes, sg.links, id(node.id), depth + 1);
      const values = Array.isArray(node.widgets_values) ? node.widgets_values : [];
      const widgetInputs = sg.inputs.map((input, index) => ({ input, index })).filter(({ input }) => WIDGET_TYPES.has(input.type ?? "") );
      const byIndex: Record<number, unknown> = {};
      widgetInputs.forEach(({ index }, k) => {
        if (k < values.length) byIndex[index] = values[k];
      });
      promoted.set(id(node.id), byIndex);
      ports.set(id(node.id), sg.inputs.map((input) => input.name));
    }
    for (const raw of graphLinks) {
      const l = raw;
      links.set(scope ? `${scope}:${l.id}` : l.id, { origin: id(l.origin_id), slot: l.origin_slot, target: id(l.target_id), targetSlot: l.target_slot });
    }
  };
  expand(ui.nodes, ui.links.map(asLink), "", 0);
  return { nodes, links, promoted, ports };
}

export type Converted = { prompt: ApiPrompt; problems: string[]; outputs: string[] };

export function toApiPrompt(ui: UiWorkflow, catalog: Catalog): Converted {
  useCatalog(catalog);
  const problems: string[] = [];
  if (!Array.isArray(ui?.nodes) || !Array.isArray(ui?.links)) return { prompt: {}, problems: ["That isn't a Comfy workflow file."], outputs: [] };
  const { nodes, links, promoted, ports } = flatten(ui);

  // Incoming link per (target node, input slot), and the inputs list of each node.
  const incoming = new Map<string, Link>();
  for (const l of links.values()) incoming.set(`${l.target}#${l.targetSlot}`, l);

  /**
   * Where a value on (node, slot) really comes from, walking through
   * Reroutes, bypassed nodes, subgraph boundaries and Primitive nodes.
   * Returns a link to a real node, a literal value, or null.
   */
  const resolve = (origin: string, slot: number, type: string | undefined, depth = 0): { node: string; slot: number } | { value: unknown } | null => {
    if (depth > 64) return null;
    const node = nodes.get(origin);
    if (!node) {
      // The inside face of a subgraph: -10 is its input node, -20 its output node.
      const m = /^(.*):(-10|-20)$/.exec(origin);
      if (m && m[2] === "-10") {
        const instance = m[1]!;
        const name = ports.get(instance)?.[slot];
        const at = (nodes.get(instance)?.inputs ?? []).findIndex((input) => input.name === name);
        const outer = at >= 0 ? incoming.get(`${instance}#${at}`) : undefined;
        if (outer) return resolve(outer.origin, outer.slot, type, depth + 1);
        const value = promoted.get(instance)?.[slot];
        return value === undefined ? null : { value };
      }
      return null;
    }
    if (node.type.startsWith("subgraph:")) {
      // An output of a subgraph instance: follow it to the inner node that feeds that output.
      const inner = [...links.values()].find((l) => l.target === `${origin}:-20` && l.targetSlot === slot);
      return inner ? resolve(inner.origin, inner.slot, type, depth + 1) : null;
    }
    if (node.type === "Reroute") {
      const up = incoming.get(`${origin}#0`);
      return up ? resolve(up.origin, up.slot, type, depth + 1) : null;
    }
    if (node.type === "PrimitiveNode") {
      const v = Array.isArray(node.widgets_values) ? node.widgets_values[0] : undefined;
      return v === undefined ? null : { value: v };
    }
    if (node.mode === MUTED) return null;
    if (node.mode === BYPASS) {
      // A bypassed node passes through its first input of the same type.
      const want = node.outputs?.[slot]?.type ?? type;
      const at = (node.inputs ?? []).findIndex((input) => input.type === want);
      const up = at >= 0 ? incoming.get(`${origin}#${at}`) : undefined;
      return up ? resolve(up.origin, up.slot, want, depth + 1) : null;
    }
    return { node: origin, slot };
  };

  const prompt: ApiPrompt = {};
  const outputs: string[] = [];
  for (const [id, node] of nodes) {
    if (EDITOR_ONLY.has(node.type) || VIEW_ONLY.has(node.type) || node.type.startsWith("subgraph:") || node.mode === MUTED || node.mode === BYPASS) continue;
    const def = catalog[node.type];
    if (!def) {
      problems.push(`It needs the node “${node.type}”, which Comfy Cloud doesn't have.`);
      continue;
    }
    const values = Array.isArray(node.widgets_values) ? node.widgets_values : [];
    const inputs: Record<string, unknown> = Array.isArray(node.widgets_values) ? readWidgets(def, values) : { ...(node.widgets_values ?? {}) };
    (node.inputs ?? []).forEach((input, slot) => {
      const l = incoming.get(`${id}#${slot}`);
      if (!l) return;
      const from = resolve(l.origin, l.slot, input.type);
      if (!from) return;
      inputs[input.name] = "value" in from ? from.value : [from.node, from.slot];
    });
    // A widget added to the node since the workflow was saved takes its default, as the editor does on load.
    const fill = (section: NodeDef["input"], prefix: string) => {
      for (const [name, spec] of Object.entries(section.required ?? {})) {
        const key = prefix + name;
        if (!(key in inputs) && isWidget(spec) && "default" in options(spec)) inputs[key] = options(spec).default;
        if (spec[0] === "COMFY_DYNAMICCOMBO_V3") {
          const pick = (options(spec).options as { key: string; inputs: NodeDef["input"] }[] | undefined)?.find((o) => o.key === inputs[key]);
          if (pick) fill(pick.inputs, `${key}.`);
        }
      }
    };
    fill(def.input, "");
    // Drop anything the definition doesn't take, so a stale widget can't confuse the run.
    const accepted = acceptedInputs(def, inputs);
    for (const key of Object.keys(inputs)) if (!accepted.has(key)) delete inputs[key];
    prompt[id] = { class_type: node.type, inputs, ...(node.title ? { _meta: { title: node.title } } : {}) };
    if (def.output_node) outputs.push(id);
  }

  // Links to nodes that were left out (editor-only, missing) are dropped.
  for (const node of Object.values(prompt)) {
    for (const [key, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && !prompt[value[0]]) delete node.inputs[key];
    }
  }
  problems.push(...validate(prompt, catalog));
  if (!outputs.length) problems.push("The workflow saves nothing, so there would be no result.");
  return { prompt, problems: [...new Set(problems)], outputs };
}

/** What Comfy itself checks before running: required inputs present, choices valid. */
export function validate(prompt: ApiPrompt, catalog: Catalog): string[] {
  const problems: string[] = [];
  for (const [id, node] of Object.entries(prompt)) {
    const def = catalog[node.class_type];
    if (!def) continue;
    const accepted = acceptedInputs(def, node.inputs);
    const required = new Set<string>();
    const walk = (inputs: NodeDef["input"], prefix: string) => {
      for (const [name, spec] of Object.entries(inputs.required ?? {})) {
        const key = prefix + name;
        if (spec[0] === "COMFY_AUTOGROW_V3") {
          const t = options(spec).template as { names?: string[]; min?: number } | undefined;
          const min = Number(options(spec).min ?? t?.min ?? 0);
          const names = (t?.names ?? []).slice(0, min);
          names.forEach((n) => required.add(`${key}.${n}`));
          continue;
        }
        required.add(key);
        if (spec[0] === "COMFY_DYNAMICCOMBO_V3") {
          const pick = (options(spec).options as { key: string; inputs: NodeDef["input"] }[] | undefined)?.find((o) => o.key === node.inputs[key]);
          if (pick) walk(pick.inputs, `${key}.`);
        }
      }
    };
    walk(def.input, "");
    const label = `${def.display_name ?? node.class_type} (${id})`;
    for (const key of required) if (!(key in node.inputs)) problems.push(`${label} is missing “${key}”.`);
    for (const [key, value] of Object.entries(node.inputs)) {
      const spec = accepted.get(key);
      if (!spec || Array.isArray(value)) continue;
      const choices = Array.isArray(spec[0]) ? spec[0] : spec[0] === "COMBO" ? (options(spec).options as unknown[] | undefined) : undefined;
      // Upload pickers (LoadImage's file list) are filled in when the file is sent, so they aren't checked here.
      // A media file name is an upload the person supplies, whatever the picker lists today.
      const upload = typeof value === "string" && /\.(png|jpe?g|webp|gif|mp4|mov|webm|mkv|wav|mp3|flac|ogg|m4a|glb|obj|ply|splat)$/i.test(value);
      if (choices?.length && !upload && !options(spec).image_upload && !options(spec).video_upload && !options(spec).audio_upload && !choices.includes(value)) problems.push(`${label} has “${String(value).slice(0, 40)}” for ${key}, which isn't one of its choices.`);
    }
  }
  return problems;
}
