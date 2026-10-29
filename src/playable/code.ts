import type { DraftRequest } from "../writer/draft";
import { KIT_API } from "./kit";
import { SHAPES, SpecError, keepMadeArt, readSpec, type CodeSpec, type GameSpec } from "./spec";

/**
 * Games Claude writes as code. Claude answers in two tagged parts: a manifest
 * (what the game is and every asset it draws) and the game script, written
 * against the haggs game kit. The reply streams, so `progressOf` can count
 * the lines as they come; `readCodeReply` turns the finished reply into a
 * code game through `readSpec`, so a reply that reads is always storable.
 */

export const GENRES = ["Arcade", "Runner", "Shooter", "Platformer", "Puzzle", "Strategy", "Maze", "Adventure", "Racing", "Simulation", "Crowd", "Eat & Grow"] as const;

export type Quality = "quality" | "fast";
export const MODELS: Record<Quality, string> = { quality: "claude-opus-5-5", fast: "claude-sonnet-5-5" };
/** Room for a game of about 900 lines, which finishes well inside the 300 seconds a request may run. */
export const CODE_TOKENS = 24_000;
/** Ends a streamed reply that failed part way; the reason follows it. */
export const ERROR_MARK = "\n<<haggs-error>>";

const MANIFEST_SHAPE = `{
  "title": "two to four words",
  "pitch": "one sentence on what the game is",
  "genre": "one or two words, e.g. Shooter",
  "controls": "one short line, e.g. Arrows to steer, Space to fire",
  "aspect": "16:9" | "9:16" | "4:3" | "1:1",
  "touch": "pad" | "tap",
  "palette": { "sky": "#rrggbb", "ground": "#rrggbb", "accent": "#rrggbb", "text": "#rrggbb" },
  "assets": [
    { "id": "player", "label": "Player", "kind": "sprite" | "background", "emoji": "one emoji that stands in until the picture is made", "prompt": "what the picture shows, for an image model", "color": "#rrggbb", "shape": ${SHAPES.map((s) => `"${s}"`).join(" | ")} }
  ],
  "said": "one short sentence to the player on what you made or changed"
}`;

/** How Claude is told to write a code game: on the person's key here, and over MCP (haggs_playable_guide). */
export function codeGuide(three: boolean): string {
  return [
    "You make complete, polished, original browser games for haggs Playable, the kind people share. You write the whole game yourself: rules, levels, feel, and every screen.",
    [
      "Be imaginative. Before writing, find the idea's hook: one mechanic that only makes sense for this idea and is fun on its own (light that pushes back the dark, a crowd that grows and splits, gravity that flips, a magnet that pulls scrap into combos, time that only moves when you move). Build the game around it, not around a generic template.",
      "Give it a shape: at least three stages that each add something new (a new enemy, hazard, rule or place), a rising pace, combos, upgrades or choices that change how you play, and a finale worth reaching (a boss, a last wave, a final run). A run lasts one to three minutes and ends through HAGGS.end.",
      "Make it feel great: responsive controls, anticipation and impact (HAGGS.burst, HAGGS.shake, HAGGS.flash, HAGGS.float on every hit, pickup and combo), sounds on every action, HAGGS.music for the mood, animated motion (bob, squash, spin, ease), a parallax or living background, and a clear HUD with score, lives or progress.",
      "It must read well before any picture is made: every asset has an emoji placeholder, and the game draws its world with colour, light and shapes too, so it already looks deliberate.",
    ].join(" "),
    "Keep it original: no brand names, real people, or other games' characters or levels.",
    three
      ? "3D is on: build the game in three.js on HAGGS.canvas, lit and shaded, with a camera that follows the action, and put the HUD on HAGGS.hud. Use the assets as textures on planes, billboards and simple meshes."
      : "3D is off: draw everything in 2D on HAGGS.ctx. Never use THREE.",
    "Every picture the game shows is an asset in the manifest, drawn with HAGGS.draw, HAGGS.img or HAGGS.texture. List what the game needs and nothing more: usually 6 to 14 assets, at most 24. Sprites are single subjects (the image model draws them on a plain background that is removed); backgrounds are full scenes. Give each one prompt in a single consistent art style for the whole game, a fitting emoji, and a placeholder colour and shape.",
    KIT_API,
    "Write plain modern JavaScript, at most about 900 lines, no comments longer than a line. No imports, no fetch, no DOM elements, no alert, no eval, no external files. Test your logic in your head: every variable defined before use, no stray syntax, the game reachable to its end.",
    `Answer with exactly two parts and nothing else:\n<manifest>\n${MANIFEST_SHAPE}\n</manifest>\n<game>\n// the game script\n</game>`,
  ].join("\n\n");
}

export type IdeaBrief = { idea: string; genre?: string | undefined; three?: boolean | undefined; references?: { id: string; label: string }[] | undefined };

export function codeIdeaRequest(brief: IdeaBrief): DraftRequest {
  const idea = brief.idea.trim();
  if (idea.length < 4) throw new Error("Say what the game is about, a few words is enough.");
  if (idea.length > 3000) throw new Error("That idea is too long. Keep it under 3,000 characters.");
  const lines = [`Make a game from this idea:\n\n${idea}`];
  if (brief.genre) lines.push(`Genre: ${brief.genre}.`);
  if (brief.references?.length) lines.push(`The player gave pictures to use. Include these assets with exactly these ids, and write their prompts to match: ${brief.references.map((r) => `"${r.id}" (${r.label})`).join(", ")}.`);
  return { system: codeGuide(Boolean(brief.three)), user: lines.join("\n\n"), maxTokens: CODE_TOKENS };
}

/** The game as Claude sees it for a change: its manifest without picture links, and its code. */
export function forRewrite(spec: CodeSpec): string {
  const { code, ...rest } = spec;
  const manifest = JSON.parse(JSON.stringify(rest, (k, v) => (k === "url" || k === "ref" || k === "version" || k === "template" || k === "three" ? undefined : v)));
  manifest.assets = manifest.art.assets;
  delete manifest.art;
  return `<manifest>\n${JSON.stringify(manifest, null, 1)}\n</manifest>\n<game>\n${code}\n</game>`;
}

export function codeEditRequest(spec: CodeSpec, message: string): DraftRequest {
  const text = message.trim();
  if (!text) throw new Error("Say what to change.");
  if (text.length > 3000) throw new Error("That message is too long. Keep it under 3,000 characters.");
  const user = [
    "Here is the game as it is now:",
    forRewrite(spec),
    "Change it as the player asks and answer with the whole new manifest and game. Keep everything they didn't ask to change, and keep each asset's id and prompt unless the change is about that asset, so pictures already made are kept.",
    `The player says: ${text}`,
  ].join("\n\n");
  return { system: codeGuide(spec.three), user, maxTokens: CODE_TOKENS };
}

export function codeFixRequest(spec: CodeSpec, error: string): DraftRequest {
  const user = [
    "Here is the game as it is now:",
    forRewrite(spec),
    `It stopped with this error: ${error.slice(0, 600)}`,
    "Find the cause and fix it. Answer with the whole manifest and game, changing only what the fix needs.",
  ].join("\n\n");
  return { system: codeGuide(spec.three), user, maxTokens: CODE_TOKENS };
}

/** How far a streamed reply has got, for "Writing… 340 lines". */
export function progressOf(text: string): { lines: number; inGame: boolean } {
  const at = text.indexOf("<game>");
  if (at < 0) return { lines: 0, inGame: false };
  return { lines: text.slice(at).split("\n").length - 1, inGame: true };
}

export type CodeReply = { spec: CodeSpec; said: string };

/**
 * A finished reply as a code game. When it's an edit, art already made stays
 * on every asset whose id and prompt didn't change, and pictures to follow
 * stay on their assets.
 */
export function readCodeReply(text: string, options: { three: boolean; before?: CodeSpec | undefined }): CodeReply {
  const manifest = /<manifest>\s*([\s\S]*?)\s*<\/manifest>/.exec(text)?.[1];
  const game = /<game>\s*([\s\S]*?)\s*<\/game>/.exec(text)?.[1];
  if (!manifest) throw new SpecError("Claude's reply had no manifest. Try again.");
  if (game === undefined) throw new SpecError(text.includes("<game>") ? "Claude ran out of room before the game was finished. Try a smaller idea, or Fast." : "Claude's reply had no game. Try again.");
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(manifest.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new SpecError("Claude's manifest couldn't be read. Try again.");
  }
  const code = game.replace(/^```(?:js|javascript)?\s*|\s*```$/g, "");
  if (!code.trim()) throw new SpecError("Claude's reply had an empty game. Try again.");
  const read = readSpec({ ...m, template: "code", three: options.three, art: { assets: m.assets }, code }) as CodeSpec;
  const spec = options.before ? (keepMadeArt(options.before, read) as CodeSpec) : read;
  const said = typeof m.said === "string" && m.said.trim() ? m.said.trim().slice(0, 300) : options.before ? "Changed." : `Made ${spec.title}.`;
  return { spec, said };
}

/** With no Claude key on your own computer: the request to paste to Claude where the haggs MCP is connected. */
export function mcpCodeAsk(brief: IdeaBrief): string {
  return `Use haggs_playable_guide with code: true${brief.three ? " and 3d: true" : ""}, then haggs_propose_game with a code game, to make a haggs Playable game${brief.three ? " in 3D" : ""}${brief.genre ? ` in the ${brief.genre} genre` : ""} from this idea: ${brief.idea.trim()}`;
}

export const isCode = (spec: GameSpec): spec is CodeSpec => spec.template === "code";
