import { validSelection, type AreaSelection } from "./grey-selection";
/**
 * The set built around one shot in the Grey Room: where it takes place, the
 * props standing in it, the lights, the look of the picture and the air. All
 * positions are fractions of the frame, so the same scene fits a phone and a
 * monitor. Pure helpers only; the page draws it and the renderer reads it.
 */

export type Matte = { kind?: "image" | "video"; url: string; at: number; price: string };
/** A moment in the shot where some of an item's values are set. Between two keys a value moves in a straight line; before the first and after the last it holds. */
export type Key = { t: number; x?: number; y?: number; w?: number; rotate?: number; opacity?: number; intensity?: number; size?: number; scale?: number };
export type Prop = { role?: "actor" | "object"; id: string; name: string; url: string; x: number; y: number; w: number; rotate: number; behind: boolean; opacity: number; flip?: boolean; locked?: boolean; hidden?: boolean; /** How dark the contact shadow under it is, 0–1. Default 0.4. */ shadow?: number; keys?: Key[];
  /** A real 3D model for the Blender set (glb, gltf, obj or fbx). The picture above stays what the preview shows. */
  model?: { url: string; name: string } };
export type LightKind = "key" | "fill" | "glow" | "practical";
export type Light = { id: string; kind: LightKind; x: number; y: number; size: number; color: string; intensity: number; keys?: Key[];
  /** For the Blender set only: a spotlight rather than an area light, and its power in watts. Without `power` it follows strength and spread. */
  spot?: boolean; power?: number };

export const MODEL_EXT = /\.(glb|gltf|obj|fbx)(\?.*)?$/i;
export const MAX_POWER = 5000;
export type AtmosKind = "fog" | "rain" | "snow" | "dust" | "embers" | "beams";
export type Atmos = { kind: AtmosKind; amount: number };
/** A real surface in the footage (a wall, a floor) given a new texture. `mask` is that surface cut out of the footage; the texture is laid over it. */
export type Surface = { selection?: AreaSelection | undefined; mode?: "material" | "replace"; id: string; label: string; words?: string; mask?: Matte; texture?: { url: string; name: string; scale: number }; strength: number; hidden?: boolean };
export type Look = { exposure: number; contrast: number; warmth: number; saturation: number; vignette: number };
export type Backdrop = { url: string; name: string; scale: number; x: number; y: number; blur: number; keys?: Key[] };

export type RoomReference = { id: string; url: string; name: string };

export type GreyScene = {
  references?: RoomReference[];
  /** The uncomposited source, kept when a rendered draft becomes the active take. */
  source?: { url: string; kind: "video" | "image"; revision?: string; trimIn?: number };
  place?: string;
  matte?: Matte;
  backdrop?: Backdrop;
  surfaces?: Surface[];
  props?: Prop[];
  lights?: Light[];
  atmos?: Atmos[];
  look?: Look;
  /** A shadow thrown by the actor: how dark, and which way (degrees) it falls. */
  shadow?: { amount: number; angle: number };
};

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const unit = (n: number) => clamp(n, 0, 1);

export const NEUTRAL: Look = { exposure: 0, contrast: 0, warmth: 0, saturation: 0, vignette: 0 };

export const propShadow = (p: Pick<Prop, "shadow">) => p.shadow ?? 0.4;
export const actorShadow = (s: Pick<GreyScene, "shadow">) => ({ amount: s.shadow?.amount ?? 0, angle: s.shadow?.angle ?? 135 });
export function setShadow(s: GreyScene, change: Partial<{ amount: number; angle: number }>): GreyScene {
  const now = actorShadow(s);
  const next = { ...now, ...change };
  return { ...s, shadow: { amount: unit(next.amount), angle: ((Math.round(next.angle) % 360) + 360) % 360 } };
}

export const sceneIsEmpty = (s: GreyScene | undefined) => !s || !(s.references?.length || s.place || s.matte || s.backdrop || s.surfaces?.length || s.props?.length || s.lights?.length || s.atmos?.length || (s.look && JSON.stringify(s.look) !== JSON.stringify(NEUTRAL)));

/* ── props ── */

export function addProp(s: GreyScene, p: { name: string; url: string; behind?: boolean }): GreyScene {
  const prop: Prop = { id: uid(), name: p.name.slice(0, 60), url: p.url, x: 0.5, y: 0.5, w: 0.25, rotate: 0, behind: p.behind ?? false, opacity: 1 };
  return { ...s, props: [...(s.props ?? []), prop] };
}

const tidyModel = (m: Prop["model"]): Prop["model"] => (m && typeof m.url === "string" && typeof m.name === "string" && MODEL_EXT.test(m.url) ? { url: m.url, name: m.name.slice(0, 60) } : undefined);
const tidyProp = (input: Prop): Prop => {
  const { model, ...p } = input;
  const kept = tidyModel(model);
  return { ...p, ...(kept ? { model: kept } : {}), ...(p.shadow === undefined ? {} : { shadow: unit(p.shadow) }), x: unit(p.x), y: unit(p.y), w: clamp(p.w, 0.03, 1.5), rotate: ((Math.round(p.rotate) % 360) + 360) % 360, opacity: unit(p.opacity) };
};

export function updateProp(s: GreyScene, id: string, change: Partial<Omit<Prop, "id">>): GreyScene {
  return { ...s, props: (s.props ?? []).map((p) => (p.id === id ? tidyProp({ ...p, ...change }) : p)) };
}

/** Gives a prop a real 3D model for the Blender set, or takes it away with null. Files that aren't glb, gltf, obj or fbx are ignored. */
export function setPropModel(s: GreyScene, id: string, model: { url: string; name: string } | null): GreyScene {
  return { ...s, props: (s.props ?? []).map((p) => { if (p.id !== id) return p; const { model: _drop, ...rest } = p; return tidyProp(model ? { ...rest, model } : rest); }) };
}

/** A locked prop stays where it is. */
export function moveProp(s: GreyScene, id: string, to: { x: number; y: number }): GreyScene {
  const p = s.props?.find((q) => q.id === id);
  return !p || p.locked ? s : updateProp(s, id, to);
}

export const removeProp = (s: GreyScene, id: string): GreyScene => ({ ...s, props: (s.props ?? []).filter((p) => p.id !== id) });

/** Moves a prop forward (+) or back (−) among the others, without leaving the stack. */
export function shiftLayer(s: GreyScene, id: string, by: number): GreyScene {
  const list = [...(s.props ?? [])];
  const at = list.findIndex((p) => p.id === id);
  if (at < 0) return s;
  const to = clamp(at + by, 0, list.length - 1);
  const [item] = list.splice(at, 1);
  list.splice(to, 0, item!);
  return { ...s, props: list };
}

/* ── surfaces ── */

export const addSurface = (s: GreyScene, label: string): GreyScene => ({ ...s, surfaces: [...(s.surfaces ?? []), { id: uid(), label: label.trim().slice(0, 30) || "Surface", strength: 0.85 }] });

export function updateSurface(s: GreyScene, id: string, change: Partial<Omit<Surface, "id">>): GreyScene {
  return {
    ...s,
    surfaces: (s.surfaces ?? []).map((x) => {
      if (x.id !== id) return x;
      const n = { ...x, ...change };
      return { ...n, strength: unit(n.strength), ...(n.texture ? { texture: { ...n.texture, scale: clamp(n.texture.scale, 0.1, 4) } } : {}) };
    }),
  };
}

export const removeSurface = (s: GreyScene, id: string): GreyScene => ({ ...s, surfaces: (s.surfaces ?? []).filter((x) => x.id !== id) });

/* ── lights ── */

const LIGHT_DEFAULT: Record<LightKind, Omit<Light, "id" | "kind">> = {
  key: { x: 0.2, y: 0.15, size: 0.5, color: "#ffd9a8", intensity: 0.7 },
  fill: { x: 0.85, y: 0.5, size: 0.7, color: "#a8c8ff", intensity: 0.35 },
  glow: { x: 0.5, y: 0.35, size: 0.35, color: "#ffb866", intensity: 0.6 },
  practical: { x: 0.7, y: 0.3, size: 0.18, color: "#ffe2a0", intensity: 0.8 },
};

export function addLight(s: GreyScene, kind: LightKind): GreyScene {
  return { ...s, lights: [...(s.lights ?? []), { id: uid(), kind, ...LIGHT_DEFAULT[kind] }] };
}

const tidyLightExtras = (l: Pick<Light, "spot" | "power">): Pick<Light, "spot" | "power"> => ({
  ...(l.spot === true ? { spot: true } : {}),
  ...(Number.isFinite(l.power) ? { power: clamp(Math.round(l.power!), 0, MAX_POWER) } : {}),
});

export function updateLight(s: GreyScene, id: string, change: Partial<Omit<Light, "id" | "kind">>): GreyScene {
  return { ...s, lights: (s.lights ?? []).map((l) => { if (l.id !== id) return l; const { spot: _s, power: _p, ...base } = { ...l, ...change }; return { ...base, x: unit(change.x ?? l.x), y: unit(change.y ?? l.y), size: clamp(change.size ?? l.size, 0.05, 1.5), intensity: unit(change.intensity ?? l.intensity), ...tidyLightExtras({ ...l, ...change }) }; }) };
}

export const removeLight = (s: GreyScene, id: string): GreyScene => ({ ...s, lights: (s.lights ?? []).filter((l) => l.id !== id) });

/* ── look and air ── */

export function setLook(s: GreyScene, change: Partial<Look>): GreyScene {
  const next = { ...NEUTRAL, ...s.look, ...change };
  return { ...s, look: { exposure: clamp(next.exposure, -1, 1), contrast: clamp(next.contrast, -1, 1), warmth: clamp(next.warmth, -1, 1), saturation: clamp(next.saturation, -1, 1), vignette: unit(next.vignette) } };
}

/** The look as a CSS filter for the preview; the renderer reads the same numbers. */
export function lookFilter(look: Look | undefined): string {
  if (!look) return "none";
  const parts: string[] = [];
  if (look.exposure) parts.push(`brightness(${+(1 + look.exposure).toFixed(2)})`);
  if (look.contrast) parts.push(`contrast(${+(1 + look.contrast).toFixed(2)})`);
  if (look.saturation) parts.push(`saturate(${+(1 + look.saturation).toFixed(2)})`);
  // Warm leans amber, cool leans blue.
  if (look.warmth > 0) parts.push(`sepia(${+(look.warmth * 0.5).toFixed(2)})`);
  if (look.warmth < 0) parts.push(`hue-rotate(${Math.round(look.warmth * 25)}deg)`);
  return parts.length ? parts.join(" ") : "none";
}

export function atmosphere(s: Pick<GreyScene, "atmos">): Atmos[] {
  return (s.atmos ?? []).map((a) => ({ ...a, amount: unit(a.amount) })).filter((a) => a.amount > 0);
}

export function setAtmos(s: GreyScene, kind: AtmosKind, amount: number): GreyScene {
  const rest = (s.atmos ?? []).filter((a) => a.kind !== kind);
  return { ...s, atmos: amount > 0 ? [...rest, { kind, amount: unit(amount) }] : rest };
}

/* ── the whole scene ── */

/** A scene from an older save or a damaged import: only well-formed parts survive, all inside the frame. */
export function normalizeScene(raw: GreyScene | undefined): GreyScene {
  if (!raw || typeof raw !== "object") return {};
  const isProp = (p: unknown): p is Prop => !!p && typeof p === "object" && typeof (p as Prop).id === "string" && typeof (p as Prop).url === "string" && Number.isFinite((p as Prop).x) && Number.isFinite((p as Prop).y);
  const isLight = (l: unknown): l is Light => !!l && typeof l === "object" && typeof (l as Light).id === "string" && typeof (l as Light).kind === "string";
  return {
    ...(raw.source && typeof raw.source.url === "string" && (raw.source.kind === "video" || raw.source.kind === "image") ? { source: { url: raw.source.url, kind: raw.source.kind, ...(Number.isFinite(raw.source.trimIn) && raw.source.trimIn! > 0 ? {trimIn:raw.source.trimIn} : {}), ...(typeof raw.source.revision === "string" ? {revision:raw.source.revision} : {}) } } : {}),
    ...(Array.isArray(raw.references) ? { references: raw.references.filter(r => r && typeof r.id === "string" && typeof r.url === "string" && typeof r.name === "string").slice(0, 60) } : {}),
    ...(raw.place ? { place: raw.place } : {}),
    ...(raw.matte ? { matte: raw.matte } : {}),
    ...(Array.isArray(raw.surfaces) ? { surfaces: raw.surfaces.filter((x) => x && typeof x.id === "string").map((x) => ({ ...x, selection: validSelection(x.selection) ? x.selection : undefined, mode: x.mode === "replace" ? "replace" as const : "material" as const, strength: unit(x.strength ?? 0.85) })) } : {}),
    ...(raw.backdrop ? { backdrop: raw.backdrop } : {}),
    props: Array.isArray(raw.props) ? raw.props.filter(isProp).map((p) => tidyProp({ ...p, w: p.w ?? 0.25, rotate: p.rotate ?? 0, behind: p.behind ?? false, opacity: p.opacity ?? 1, name: p.name ?? "Prop" })) : [],
    lights: Array.isArray(raw.lights) ? raw.lights.filter(isLight).map((l) => { const { spot: _s, power: _p, ...rest } = l; return { ...rest, ...tidyLightExtras(l) }; }) : [],
    ...(Array.isArray(raw.atmos) ? { atmos: raw.atmos } : {}),
    ...(raw.look ? { look: setLook({}, raw.look).look! } : {}),
    ...(raw.shadow ? { shadow: setShadow({}, raw.shadow).shadow! } : {}),
  };
}

const LIGHT_WORDS: Record<LightKind, string> = { key: "a strong key light", fill: "soft fill light", glow: "a warm glow", practical: "a practical lamp in the scene" };
const AIR_WORDS: Record<AtmosKind, string> = { fog: "fog", rain: "rain", snow: "snow", dust: "floating dust", embers: "drifting embers", beams: "beams of light through haze" };

/** The scene in plain words, for the pass that makes the composite look like one filmed picture. */
export function describeScene(s: GreyScene, place?: string): string {
  const bits: string[] = [];
  if (place) bits.push(`set in ${place}`);
  const done = (s.surfaces ?? []).filter((x) => x.mask && x.texture && !x.hidden).map((x) => `the ${x.label.toLowerCase()} in ${x.texture!.name}`);
  if (done.length) bits.push(`with ${done.join(" and ")}`);
  const props = (s.props ?? []).filter((p) => !p.hidden).map((p) => p.name);
  if (props.length) bits.push(`with ${props.join(", ")}`);
  const lights = [...new Set((s.lights ?? []).map((l) => LIGHT_WORDS[l.kind]))];
  if (lights.length) bits.push(`lit by ${lights.join(" and ")}`);
  const w = s.look?.warmth ?? 0;
  if (w > 0.15) bits.push("warm colour");
  else if (w < -0.15) bits.push("cool colour");
  const air = atmosphere(s).map((a) => AIR_WORDS[a.kind]);
  if (air.length) bits.push(`with ${air.join(" and ")} in the air`);
  return bits.join(", ");
}

/* ── undo and redo ── */

export function createHistory<T>(start: T, cap = 60) {
  let past: T[] = [];
  let now = start;
  let future: T[] = [];
  return {
    push(next: T) {
      past = [...past, now].slice(-cap);
      now = next;
      future = [];
    },
    undo(): T | null {
      const prev = past.at(-1);
      if (prev === undefined) return null;
      past = past.slice(0, -1);
      future = [now, ...future];
      now = prev;
      return now;
    },
    redo(): T | null {
      const next = future[0];
      if (next === undefined) return null;
      future = future.slice(1);
      past = [...past, now];
      now = next;
      return now;
    },
    get current() { return now; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
  };
}

/* ── keyframes ── */

type Channel = keyof Omit<Key, "t">;
export const PROP_CHANNELS: Channel[] = ["x", "y", "w", "rotate", "opacity"];
export const LIGHT_CHANNELS: Channel[] = ["x", "y", "intensity", "size"];
export const BACKDROP_CHANNELS: Channel[] = ["x", "y", "scale"];

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The value of one channel at time `t`: the item's own value when it has no keys for it. */
export function valueAt(base: number, keys: Key[] | undefined, channel: Channel, t: number): number {
  const ks = (keys ?? []).filter((k) => typeof k[channel] === "number").sort((a, b) => a.t - b.t);
  if (!ks.length) return base;
  if (t <= ks[0]!.t) return ks[0]![channel]!;
  const last = ks.at(-1)!;
  if (t >= last.t) return last[channel]!;
  const i = ks.findIndex((k) => k.t > t);
  const a = ks[i - 1]!, b = ks[i]!;
  return a[channel]! + ((b[channel]! - a[channel]!) * (t - a.t)) / (b.t - a.t);
}

/** Sets values at a moment, joining a key that is already within a few hundredths of a second. */
export function withKey(keys: Key[] | undefined, t: number, values: Partial<Omit<Key, "t">>): Key[] {
  const list = [...(keys ?? [])];
  const at = list.findIndex((k) => Math.abs(k.t - t) < 0.05);
  if (at >= 0) list[at] = { ...list[at]!, ...values };
  else list.push({ t: round(Math.max(0, t)), ...values });
  return list.sort((a, b) => a.t - b.t);
}

export const dropKey = (keys: Key[] | undefined, t: number): Key[] | undefined => {
  const rest = (keys ?? []).filter((k) => Math.abs(k.t - t) >= 0.05);
  return rest.length ? rest : undefined;
};

const resolveItem = <T extends { keys?: Key[] }>(item: T, channels: Channel[], t: number): T => {
  if (!item.keys?.length) return item;
  const out: Record<string, unknown> = { ...item };
  for (const c of channels) if (typeof (item as Record<string, unknown>)[c] === "number") out[c] = valueAt((item as unknown as Record<string, number>)[c]!, item.keys, c, t);
  return out as T;
};

/** The scene as it stands at time `t`: every moving value set to where it is then. */
export function resolveScene(s: GreyScene, t: number): GreyScene {
  return {
    ...s,
    ...(s.props ? { props: s.props.map((p) => resolveItem(p, PROP_CHANNELS, t)) } : {}),
    ...(s.lights ? { lights: s.lights.map((l) => resolveItem(l, LIGHT_CHANNELS, t)) } : {}),
    ...(s.backdrop ? { backdrop: resolveItem(s.backdrop, BACKDROP_CHANNELS, t) } : {}),
  };
}

/** The same motion as an ffmpeg expression in `t` (seconds), for the renderer. */
export function exprAt(base: number, keys: Key[] | undefined, channel: Channel): string {
  const ks = (keys ?? []).filter((k) => typeof k[channel] === "number").sort((a, b) => a.t - b.t);
  if (!ks.length) return String(round(base));
  const v = (k: Key) => round(k[channel]!);
  if (ks.length === 1) return String(v(ks[0]!));
  let expr = String(v(ks.at(-1)!));
  for (let i = ks.length - 2; i >= 0; i--) {
    const a = ks[i]!, b = ks[i + 1]!;
    expr = `if(lt(t,${b.t}),${v(a)}+(${round(v(b) - v(a))})*(t-${a.t})/${round(b.t - a.t)},${expr})`;
  }
  return `if(lt(t,${ks[0]!.t}),${v(ks[0]!)},${expr})`;
}

function mergeOne<T extends { keys?: Key[] }>(base: T | undefined, before: T | undefined, after: T, channels: Channel[], t: number, animate: boolean): T {
  if (!base || !before) return after;
  const out: Record<string, unknown> = { ...after };
  let keys = base.keys;
  for (const c of channels) {
    const was = (before as Record<string, unknown>)[c], now = (after as Record<string, unknown>)[c];
    out[c] = (base as Record<string, unknown>)[c];
    if (now === was) continue;
    const keyed = keys?.some((k) => typeof k[c] === "number");
    if (animate || keyed) {
      // The first time something moves, its starting place is kept as a key at the start.
      if (!keyed && typeof was === "number") keys = withKey(keys, 0, { [c]: was });
      keys = withKey(keys, t, { [c]: now as number });
    } else out[c] = now;
  }
  if (keys) out.keys = keys;
  else delete out.keys;
  return out as T;
}

/**
 * Turns an edit made on the picture at time `t` into a change to the scene.
 * `before` is what was shown, `after` is what the edit produced. While animating, or when a value
 * already has keys, a changed value becomes a key at `t`; otherwise it changes the item itself.
 */
export function mergeEdit(base: GreyScene, before: GreyScene, after: GreyScene, t: number, animate: boolean): GreyScene {
  const out: GreyScene = { ...after };
  if (after.props) out.props = after.props.map((p) => mergeOne(base.props?.find((q) => q.id === p.id), before.props?.find((q) => q.id === p.id), p, PROP_CHANNELS, t, animate));
  if (after.lights) out.lights = after.lights.map((l) => mergeOne(base.lights?.find((q) => q.id === l.id), before.lights?.find((q) => q.id === l.id), l, LIGHT_CHANNELS, t, animate));
  if (after.backdrop) out.backdrop = mergeOne(base.backdrop, before.backdrop, after.backdrop, BACKDROP_CHANNELS, t, animate);
  return out;
}

/** Every moment where something has a key, in order, for the markers under the picture. */
export function keyTimes(s: GreyScene): number[] {
  const all = [...(s.props ?? []), ...(s.lights ?? []), ...(s.backdrop ? [s.backdrop] : [])].flatMap((i) => (i.keys ?? []).map((k) => k.t));
  return [...new Set(all.map(round))].sort((a, b) => a - b);
}

/** The lighting as an instruction for an AI relight: where each light is, how warm and how hard, then the overall mood. */
export function describeLighting(s: GreyScene): string {
  const side = (l: Light) => {
    const h = l.x < 0.35 ? "left" : l.x > 0.65 ? "right" : "";
    const v = l.y < 0.3 ? "upper" : l.y > 0.7 ? "low" : "";
    return h || v ? `from the ${[v, h].filter(Boolean).join(" ")}` : "from the front";
  };
  const warmth = (hex: string) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return "";
    const r = parseInt(m[1]!, 16), b = parseInt(m[3]!, 16);
    return r - b > 40 ? "warm" : b - r > 40 ? "cool" : "neutral";
  };
  const lights = (s.lights ?? []).map((l) => `${l.intensity > 0.6 ? "strong" : "soft"} ${warmth(l.color)} light ${side(l)}`.replace(/\s+/g, " "));
  const mood: string[] = [];
  const w = s.look?.warmth ?? 0, e = s.look?.exposure ?? 0;
  if (w > 0.2) mood.push("warm");
  else if (w < -0.2) mood.push("cool");
  if (e < -0.15) mood.push("dim");
  else if (e > 0.15) mood.push("bright");
  const parts = [...lights, ...(mood.length ? [`an overall ${mood.join(", ")} mood`] : [])];
  return parts.join("; ");
}

/** References do not become scene layers until explicitly assigned. */
export function addRoomReference(scene: GreyScene, input: { url: string; name: string }): GreyScene {
  if (scene.references?.some(r => r.url === input.url)) return scene;
  return { ...scene, references: [...(scene.references ?? []), { ...input, name: input.name.slice(0, 80), id: uid() }].slice(0, 60) };
}
export function referenceUses(scene: GreyScene, url: string): string[] {
  return [
    ...(scene.surfaces ?? []).filter(s => s.texture?.url === url).map(s => s.label + (s.mask ? "" : " · outline needed")),
    ...(scene.backdrop?.url === url ? ["Background" + (scene.matte ? "" : " · cut-out needed")] : []),
    ...(scene.props ?? []).filter(p => p.url === url).map(p => p.name),
  ];
}
export function assignSurfaceReference(scene: GreyScene, target: string, ref: RoomReference): GreyScene {
  const existing = scene.surfaces?.find(s => s.id === target) ?? scene.surfaces?.find(s => s.label.toLowerCase() === target.toLowerCase());
  const next = existing ? scene : addSurface(scene, target);
  const id = existing?.id ?? next.surfaces!.at(-1)!.id;
  return updateSurface(next, id, { texture: { url: ref.url, name: ref.name, scale: existing?.texture?.scale ?? 1 } });
}

/** Swap a prop image while preserving its placement, animation and layering. */
export function assignObjectReference(scene: GreyScene, target: string | null, ref: RoomReference): GreyScene {
  return target && scene.props?.some(p => p.id === target)
    ? updateProp(scene, target, { url: ref.url, name: ref.name })
    : addProp(scene, ref);
}
/** Removing inspiration from the board leaves already assigned scene assets intact. */
export const removeRoomReference = (scene: GreyScene, id: string): GreyScene => ({ ...scene, references: (scene.references ?? []).filter(r => r.id !== id) });

/** A new base invalidates old surface outlines, while references and placed layers remain editable. */
export function replaceRoomSource(scene: GreyScene, source: { url: string; kind: "image" | "video" }): GreyScene {
  const { matte: _matte, backdrop: _backdrop, place: _place, surfaces, ...rest } = scene;
  return { ...rest, source: {...source, revision: uid()}, ...(surfaces ? { surfaces: surfaces.map(({ mask: _mask, selection: _selection, ...surface }) => ({ ...surface, mode: "material" as const })) } : {}) };
}
