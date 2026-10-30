import { readAtlas, pngSize, type SpriteAtlas } from "./atlas";

/**
 * A Playable game is a spec, never code: a template name, the art for each
 * slot, the numbers the template runs on, and the words on its cards. Claude
 * writes specs and chat edits rewrite them, so everything that comes in is
 * read through `readSpec`, which keeps the fields it knows, fills the ones it
 * doesn't with the template's defaults, and clamps every number into a range
 * the game can actually be played at. A spec that reads is always playable.
 */

export const TEMPLATES = ["runner", "collector", "match"] as const;
export type Template = (typeof TEMPLATES)[number];

export const SHAPES = ["circle", "square", "triangle", "diamond", "star"] as const;
export type Shape = (typeof SHAPES)[number];

/** A piece of art: a placeholder shape, what to make, the picture once made, and a picture to follow (a character, a place, an upload). */
export type Art = { prompt: string; color: string; shape: Shape; url?: string; ref?: string; atlas?: SpriteAtlas };

export type Palette = { sky: string; ground: string; accent: string; text: string };
export type Words = { intro: string; win: string; lose: string };

type Base = { version: 1; title: string; pitch: string; palette: Palette; text: Words };

export type RunnerRules = { speed: number; gravity: number; jump: number; spawnEvery: number; pickupEvery: number; lives: number; goal: "distance" | "score"; target: number };
export type CollectorRules = { speed: number; hazards: number; hazardSpeed: number; target: number; seconds: number; lives: number };
export type MatchRules = { cols: number; rows: number; kinds: number; moves: number; target: number };

export type RunnerSpec = Base & { template: "runner"; art: { player: Art; hazard: Art; pickup: Art; background: Art }; rules: RunnerRules };
export type CollectorSpec = Base & { template: "collector"; art: { player: Art; hazard: Art; pickup: Art; background: Art }; rules: CollectorRules };
export type MatchSpec = Base & { template: "match"; art: { background: Art; tiles: Art[] }; rules: MatchRules };

export type TemplateSpec = RunnerSpec | CollectorSpec | MatchSpec;

/**
 * A game Claude wrote as code: a manifest (what it is, how it's played, every
 * asset it draws) and the game script, which runs locked down in a frame
 * against the haggs game kit (`kit.ts`). Its assets are art slots like any
 * other, so they are priced, made and referenced the same way.
 */
export const ASPECTS = ["16:9", "9:16", "4:3", "1:1"] as const;
export type Aspect = (typeof ASPECTS)[number];
/** `emoji`: what the kit draws until the picture is made, far more readable than a shape. */
export type Asset = Art & { id: string; label: string; kind: "sprite" | "background"; emoji?: string };
export type CodeSpec = {
  version: 2;
  template: "code";
  title: string;
  pitch: string;
  genre: string;
  controls: string;
  aspect: Aspect;
  /** Three.js is loaded for the game: the 3D (beta) switch. */
  three: boolean;
  /** "pad": an on-screen stick and two buttons on touch screens. "tap": the game reads taps itself. */
  touch: "pad" | "tap";
  palette: Palette;
  art: { assets: Asset[] };
  code: string;
};

export type GameSpec = TemplateSpec | CodeSpec;

export const CODE_LIMITS = { assets: 24, code: 200_000 } as const;
const ASSET_ID = /^[a-z][a-z0-9_-]{0,31}$/;

/** [min, max] for every number, per template. Clamped into, never rejected. */
export const RANGES = {
  runner: { speed: [150, 700], gravity: [900, 3200], jump: [480, 1150], spawnEvery: [0.7, 4], pickupEvery: [0.6, 6], lives: [1, 5], target: [5, 2000] },
  collector: { speed: [120, 520], hazards: [0, 8], hazardSpeed: [40, 360], target: [3, 60], seconds: [15, 180], lives: [1, 5] },
  match: { cols: [5, 8], rows: [5, 9], kinds: [3, 6], moves: [5, 60], target: [100, 20000] },
} as const satisfies Record<Template, Record<string, readonly [number, number]>>;

/** Whole numbers stay whole: counts, lives, grid sizes. */
const WHOLE = new Set(["lives", "hazards", "target", "seconds", "cols", "rows", "kinds", "moves"]);

export const TEMPLATE_INFO: Record<Template, { name: string; genre: string; says: string; controls: string }> = {
  runner: { name: "Runner", genre: "Endless runner", says: "Keep running, jump what's in the way, grab what you can.", controls: "Space, ↑ or tap to jump" },
  collector: { name: "Collector", genre: "Top-down collector", says: "Gather enough before the clock runs out, and stay clear of what roams.", controls: "Arrows or WASD, or hold where to go" },
  match: { name: "Match", genre: "Match-three puzzle", says: "Swap neighbours to line up three or more, and reach the score in the moves you have.", controls: "Click a tile, then a neighbour" },
};

const art = (prompt: string, color: string, shape: Shape): Art => ({ prompt, color, shape });

export function defaultSpec(template: Template): TemplateSpec {
  if (template === "runner") {
    return {
      version: 1, template, title: "Rooftop Dash", pitch: "A courier sprints across the city's rooftops at dusk.",
      palette: { sky: "#1d2440", ground: "#2b2f3a", accent: "#35e48a", text: "#f5f5f4" },
      text: { intro: "Deliver the parcel. Jump the vents, grab the stamps.", win: "Delivered on time.", lose: "The parcel is late." },
      art: {
        player: art("a courier in a green jacket running, side view", "#35e48a", "square"),
        hazard: art("a rooftop air vent, side view", "#ff6b6b", "triangle"),
        pickup: art("a golden postage stamp", "#f5c451", "star"),
        background: art("city rooftops at dusk, purple sky, distant towers, side-scrolling game background", "#1d2440", "square"),
      },
      rules: { speed: 320, gravity: 1900, jump: 760, spawnEvery: 1.6, pickupEvery: 2.2, lives: 3, goal: "distance", target: 300 },
    };
  }
  if (template === "collector") {
    return {
      version: 1, template, title: "Firefly Field", pitch: "Catch fireflies in a meadow before the night ends, dodging the wasps.",
      palette: { sky: "#0f2a1f", ground: "#123323", accent: "#35e48a", text: "#f5f5f4" },
      text: { intro: "Catch the fireflies. Mind the wasps.", win: "A jar full of light.", lose: "The night got away." },
      art: {
        player: art("a child with a glass jar, top-down view", "#7dd3fc", "circle"),
        hazard: art("an angry wasp, top-down view", "#ff6b6b", "diamond"),
        pickup: art("a glowing firefly, top-down view", "#f5c451", "star"),
        background: art("a meadow at night seen from above, dark grass, soft moonlight, top-down game background", "#0f2a1f", "square"),
      },
      rules: { speed: 260, hazards: 3, hazardSpeed: 120, target: 12, seconds: 45, lives: 3 },
    };
  }
  return {
    version: 1, template, title: "Gem Garden", pitch: "Line up seeds to make a garden bloom.",
    palette: { sky: "#1a1430", ground: "#241c40", accent: "#35e48a", text: "#f5f5f4" },
    text: { intro: "Swap neighbours to line up three seeds.", win: "The garden is in bloom.", lose: "Out of moves." },
    art: {
      background: art("a soft overgrown garden wall, muted colours, puzzle game background", "#1a1430", "square"),
      tiles: [
        art("a red berry, game icon", "#ff6b6b", "circle"),
        art("a blue flower, game icon", "#7dd3fc", "diamond"),
        art("a yellow sun seed, game icon", "#f5c451", "star"),
        art("a green leaf, game icon", "#35e48a", "triangle"),
        art("a purple plum, game icon", "#c084fc", "square"),
      ],
    },
    rules: { cols: 7, rows: 7, kinds: 5, moves: 20, target: 1500 },
  };
}

// ─── reading ─────────────────────────────────────────────────────────────

export class SpecError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback: string, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);
const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);
/** Only https pictures and the app's own kept media; never a script or data of any other kind. */
export const safeUrl = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const u = v.trim();
  if (/^https:\/\/[^\s"'<>]+$/.test(u) && u.length < 2000) return u;
  if (/^\/api\/[a-z-]+\/[^\s"'<>]+$/.test(u) && u.length < 2000) return u;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(u) && u.length < 3_000_000) return u;
  return undefined;
};

export function clamp(n: number, [lo, hi]: readonly [number, number], whole: boolean): number {
  const v = Math.min(hi, Math.max(lo, n));
  return whole ? Math.round(v) : Math.round(v * 100) / 100;
}

function readArt(v: unknown, fallback: Art, allowAtlas = true): Art {
  if (!isObj(v)) return { ...fallback };
  const shape = SHAPES.includes(v.shape as Shape) ? (v.shape as Shape) : fallback.shape;
  const url = safeUrl(v.url);
  const ref = safeUrl(v.ref);
  let atlas: SpriteAtlas | undefined;
  if (v.atlas !== undefined && url) {
    if (!allowAtlas) throw new SpecError("Atlas animations belong in sprite slots, not backgrounds.");
    if (!url.startsWith("data:image/png;base64,")) throw new SpecError("Atlas images must be imported PNG data.");
    const header = Uint8Array.from(atob(url.split(",")[1]!.slice(0, 48)), c => c.charCodeAt(0));
    const size = pngSize(header);
    atlas = readAtlas(v.atlas, size.width, size.height);
  }
  return { prompt: text(v.prompt, fallback.prompt, 400), color: color(v.color, fallback.color), shape, ...(url ? { url } : {}), ...(ref ? { ref } : {}), ...(atlas ? { atlas } : {}) };
}

function readRules<R extends object>(v: unknown, template: Template, fallback: R): R {
  const ranges = RANGES[template] as Record<string, readonly [number, number]>;
  const given = isObj(v) ? v : {};
  const out: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
  for (const [name, range] of Object.entries(ranges)) {
    const n = Number(given[name]);
    if (given[name] !== undefined && given[name] !== null && Number.isFinite(n)) out[name] = clamp(n, range, WHOLE.has(name));
  }
  if (template === "runner") {
    if (given.goal === "distance" || given.goal === "score") out.goal = given.goal;
    Object.assign(out, clearable(out as unknown as RunnerRules));
  }
  return out as R;
}

/** The lowest jump a runner can be played with: this high, and this far at its slowest. */
export const MIN_JUMP = { height: 60, across: 140 } as const;

/**
 * Each number can be in range and the three together still make a jump too
 * small to clear anything (slow, weak and heavy). Raise the jump first, then
 * lighten gravity, until the jump clears MIN_JUMP.
 */
function clearable({ speed, gravity, jump }: RunnerRules): Pick<RunnerRules, "gravity" | "jump"> {
  const [, most] = RANGES.runner.jump;
  const needs = (g: number) => Math.max(Math.sqrt(2 * MIN_JUMP.height * g), (MIN_JUMP.across * g) / (2 * speed));
  if (jump >= needs(gravity)) return { gravity, jump };
  if (needs(gravity) <= most) return { gravity, jump: Math.ceil(needs(gravity)) };
  const g = Math.min((most * most) / (2 * MIN_JUMP.height), (2 * most * speed) / MIN_JUMP.across);
  return { gravity: Math.floor(Math.max(RANGES.runner.gravity[0], g)), jump: most };
}

/**
 * Reads anything into a playable spec, or throws a SpecError saying why it
 * can't. Only a missing or unknown template is fatal; everything else falls
 * back to the template's default.
 */
export function readSpec(value: unknown): GameSpec {
  const spec = readSpecValue(value);
  const animated = slotsOf(spec).filter(s => s.art.atlas);
  if (animated.length > 4 || animated.reduce((n, s) => n + s.art.atlas!.width * s.art.atlas!.height, 0) > 32_000_000) throw new SpecError("Keep each game to four atlases and 32 million atlas pixels. Export smaller cells.");
  return spec;
}

function readSpecValue(value: unknown): GameSpec {
  if (!isObj(value)) throw new SpecError("That isn't a game spec.");
  if (value.template === "code") return readCodeSpec(value);
  const template = value.template;
  if (!TEMPLATES.includes(template as Template)) throw new SpecError(`A game needs a template: ${TEMPLATES.join(", ")}.`);
  const base = defaultSpec(template as Template);
  const palette = isObj(value.palette) ? value.palette : {};
  const words = isObj(value.text) ? value.text : {};
  const shared = {
    version: 1 as const,
    title: text(value.title, base.title, 60),
    pitch: text(value.pitch, base.pitch, 280),
    palette: { sky: color(palette.sky, base.palette.sky), ground: color(palette.ground, base.palette.ground), accent: color(palette.accent, base.palette.accent), text: color(palette.text, base.palette.text) },
    text: { intro: text(words.intro, base.text.intro, 160), win: text(words.win, base.text.win, 120), lose: text(words.lose, base.text.lose, 120) },
  };
  const given = isObj(value.art) ? value.art : {};
  if (base.template === "match") {
    const rules = readRules(value.rules, "match", base.rules);
    const offered = Array.isArray(given.tiles) ? given.tiles : [];
    const tiles = Array.from({ length: rules.kinds }, (_, i) => readArt(offered[i], base.art.tiles[i % base.art.tiles.length]!));
    // A sixth kind with no art of its own still needs a colour that isn't one of the others.
    if (rules.kinds === 6 && !offered[5]) tiles[5] = { ...tiles[5]!, color: "#f97316", shape: "circle" };
    return { ...shared, template: "match", art: { background: readArt(given.background, base.art.background, false), tiles }, rules };
  }
  const four = { player: readArt(given.player, base.art.player), hazard: readArt(given.hazard, base.art.hazard), pickup: readArt(given.pickup, base.art.pickup), background: readArt(given.background, base.art.background, false) };
  if (base.template === "runner") return { ...shared, template: "runner", art: four, rules: readRules(value.rules, "runner", base.rules) };
  return { ...shared, template: "collector", art: four, rules: readRules(value.rules, "collector", base.rules) };
}

const CODE_PALETTE: Palette = { sky: "#101418", ground: "#1b222b", accent: "#35e48a", text: "#f5f5f4" };

/**
 * A code game, read like any spec: words trimmed, colours checked, picture
 * links kept only when safe, assets limited and named so the kit can find
 * them. Code that is empty reads (it's how the server sees a game it only
 * prices or makes art for); code that is too long is refused.
 */
function readCodeSpec(value: Record<string, unknown>): CodeSpec {
  const palette = isObj(value.palette) ? value.palette : {};
  const given = isObj(value.art) && Array.isArray(value.art.assets) ? value.art.assets : [];
  const seen = new Set<string>();
  const assets: Asset[] = [];
  for (const a of given) {
    if (!isObj(a) || typeof a.id !== "string" || !ASSET_ID.test(a.id) || seen.has(a.id)) continue;
    if (assets.length >= CODE_LIMITS.assets) break;
    seen.add(a.id);
    const kind = a.kind === "background" ? "background" : "sprite";
    const art = readArt(a, { prompt: a.id, color: CODE_PALETTE.accent, shape: kind === "background" ? "square" : "circle" }, kind === "sprite");
    const emoji = typeof a.emoji === "string" && a.emoji.trim() && [...a.emoji.trim()].length <= 8 && !/[<>&"']/.test(a.emoji) ? a.emoji.trim() : undefined;
    assets.push({ id: a.id, label: text(a.label, a.id, 40), kind, ...(emoji ? { emoji } : {}), ...art });
  }
  const code = typeof value.code === "string" ? value.code : "";
  if (code.length > CODE_LIMITS.code) throw new SpecError("That game's code is too long to keep.");
  return {
    version: 2,
    template: "code",
    title: text(value.title, "Untitled game", 60),
    pitch: text(value.pitch, "A game made with haggs Playable.", 280),
    genre: text(value.genre, "Arcade", 40),
    controls: text(value.controls, "Arrows or tap", 160),
    aspect: ASPECTS.includes(value.aspect as Aspect) ? (value.aspect as Aspect) : "16:9",
    three: value.three === true,
    touch: value.touch === "tap" ? "tap" : "pad",
    palette: { sky: color(palette.sky, CODE_PALETTE.sky), ground: color(palette.ground, CODE_PALETTE.ground), accent: color(palette.accent, CODE_PALETTE.accent), text: color(palette.text, CODE_PALETTE.text) },
    art: { assets },
    code,
  };
}

/** What kind of game it is and how it's played, for cards and headers. */
export const genreOf = (spec: GameSpec) => (spec.template === "code" ? spec.genre : TEMPLATE_INFO[spec.template].genre);
export const controlsOf = (spec: GameSpec) => (spec.template === "code" ? spec.controls : TEMPLATE_INFO[spec.template].controls);

/** The art slots a spec has, in the order the art panel lists them. */
export type Slot = { key: string; label: string; kind: "sprite" | "background"; art: Art };

export function slotsOf(spec: GameSpec): Slot[] {
  if (spec.template === "code") return spec.art.assets.map((a): Slot => ({ key: `assets.${a.id}`, label: a.label, kind: a.kind, art: a }));
  if (spec.template === "match") {
    return [
      { key: "background", label: "Background", kind: "background", art: spec.art.background },
      ...spec.art.tiles.map((t, i): Slot => ({ key: `tiles.${i}`, label: `Tile ${i + 1}`, kind: "sprite", art: t })),
    ];
  }
  return [
    { key: "player", label: "Player", kind: "sprite", art: spec.art.player },
    { key: "pickup", label: "Pickup", kind: "sprite", art: spec.art.pickup },
    { key: "hazard", label: "Hazard", kind: "sprite", art: spec.art.hazard },
    { key: "background", label: "Background", kind: "background", art: spec.art.background },
  ];
}

/** A copy of the spec with one slot's art changed. Unknown slots change nothing. */
export function withArt(spec: GameSpec, key: string, change: { [K in keyof Art]?: Art[K] | undefined }): GameSpec {
  const next = structuredClone(spec) as GameSpec;
  const apply = (a: Art): Art => {
    const merged = { ...a, ...change };
    if ("url" in change && !("atlas" in change)) delete merged.atlas;
    if (change.url === undefined && "url" in change) delete merged.url;
    if (change.ref === undefined && "ref" in change) delete merged.ref;
    return readArt(merged, a);
  };
  if (next.template === "code") {
    const at = next.art.assets.findIndex((a) => `assets.${a.id}` === key);
    const was = next.art.assets[at];
    if (was) next.art.assets[at] = { id: was.id, label: was.label, kind: was.kind, ...(was.emoji ? { emoji: was.emoji } : {}), ...apply(was) };
    return next;
  }
  if (next.template === "match") {
    if (key === "background") next.art.background = apply(next.art.background);
    const tile = /^tiles\.(\d)$/.exec(key);
    if (tile && next.art.tiles[Number(tile[1])]) next.art.tiles[Number(tile[1])] = apply(next.art.tiles[Number(tile[1])]!);
    return next;
  }
  if (key === "player" || key === "pickup" || key === "hazard" || key === "background") next.art[key] = apply(next.art[key]);
  return next;
}

/** The spec without its pictures: what the server needs to price, make art or edit, and a small request. */
export function bare(spec: GameSpec): GameSpec {
  return readSpec(JSON.parse(JSON.stringify(spec, (k, v) => (k === "url" || k === "ref" || k === "atlas" ? undefined : v))));
}

/** Smaller still, for pricing and making art: a code game without its code. */
export function forArt(spec: GameSpec): GameSpec {
  const light = bare(spec);
  return light.template === "code" ? { ...light, code: "" } : light;
}

/**
 * A copy of `after` with the art already made in `before` kept on every slot
 * whose prompt is unchanged, and every picture to follow kept on its slot.
 */
export function keepMadeArt(before: GameSpec, after: GameSpec): GameSpec {
  const old = new Map(slotsOf(before).map((s) => [s.key, s.art]));
  let spec = after;
  for (const slot of slotsOf(after)) {
    const was = old.get(slot.key);
    if (was?.url && !slot.art.url && was.prompt === slot.art.prompt) spec = withArt(spec, slot.key, { url: was.url, ...(was.atlas ? { atlas: was.atlas } : {}) });
    if (was?.ref && !slot.art.ref) spec = withArt(spec, slot.key, { ref: was.ref });
  }
  return spec;
}

/** The numbers as short chips for the spec panel: "Speed 320", "3 lives". */
export function ruleChips(spec: GameSpec): string[] {
  if (spec.template === "code") return [spec.genre, spec.three ? "3D (beta)" : "2D", spec.aspect, `${spec.art.assets.length} ${spec.art.assets.length === 1 ? "asset" : "assets"}`];
  if (spec.template === "runner") {
    const r = spec.rules;
    return [`Speed ${r.speed}`, `Jump ${r.jump}`, `Gravity ${r.gravity}`, `Hazard every ${r.spawnEvery}s`, `${r.lives} ${r.lives === 1 ? "life" : "lives"}`, r.goal === "distance" ? `Run ${r.target} m` : `Score ${r.target}`];
  }
  if (spec.template === "collector") {
    const r = spec.rules;
    return [`Speed ${r.speed}`, `${r.hazards} hazards`, `Hazard speed ${r.hazardSpeed}`, `Collect ${r.target}`, `${r.seconds}s`, `${r.lives} ${r.lives === 1 ? "life" : "lives"}`];
  }
  const r = spec.rules;
  return [`${r.cols}×${r.rows} grid`, `${r.kinds} kinds`, `${r.moves} moves`, `Score ${r.target}`];
}
