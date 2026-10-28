import type { DraftRequest } from "../writer/draft";
import { RANGES, SHAPES, TEMPLATE_INFO, TEMPLATES, keepMadeArt, readSpec, type GameSpec } from "./spec";

/**
 * Words to a game spec, and a chat message to a changed one, on the person's
 * own Claude key. Claude answers in one flat shape (every template's rules
 * at once, the ones that don't apply ignored), because structured output
 * wants every field named; `readGameReply` turns that into a real spec
 * through readSpec, so whatever comes back is clamped into a playable game.
 */

const str = (description: string) => ({ type: "string", description }) as const;
const num = (description: string) => ({ type: "number", description }) as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const range = (t: keyof typeof RANGES, k: string) => {
  const [lo, hi] = (RANGES[t] as Record<string, readonly [number, number]>)[k]!;
  return `${lo} to ${hi}`;
};

const ART = obj({
  prompt: str("What the picture shows, for an image model: the subject, the view (side view for a runner, top-down for a collector, icon for match tiles), and the style. No text or logos."),
  color: str("A #rrggbb colour for the placeholder shape drawn until the picture is made."),
  shape: { type: "string", enum: [...SHAPES] },
});

export const GAME_SCHEMA = obj({
  template: { type: "string", enum: [...TEMPLATES] },
  title: str("The game's name, two to four words."),
  pitch: str("One sentence on what the game is."),
  palette: obj({ sky: str("#rrggbb"), ground: str("#rrggbb"), accent: str("#rrggbb"), text: str("#rrggbb, readable on sky") }),
  text: obj({ intro: str("The start card, one short line on how to win."), win: str("The win card, a few words."), lose: str("The lose card, a few words.") }),
  art: obj({
    player: ART,
    pickup: ART,
    hazard: ART,
    background: ART,
    tiles: { type: "array", items: ART, description: "Match only: one per tile kind, all clearly different in colour and shape. Other templates: an empty list." },
  }),
  rules: obj({
    speed: num(`Runner: scroll speed, ${range("runner", "speed")} (320 is steady). Collector: walking speed, ${range("collector", "speed")}.`),
    gravity: num(`Runner: ${range("runner", "gravity")}, 1900 is normal.`),
    jump: num(`Runner: jump strength, ${range("runner", "jump")}, 760 is normal.`),
    spawnEvery: num(`Runner: seconds between hazards, ${range("runner", "spawnEvery")}.`),
    pickupEvery: num(`Runner: seconds between pickups, ${range("runner", "pickupEvery")}.`),
    lives: num(`Runner and collector: ${range("runner", "lives")}.`),
    goal: { type: "string", enum: ["distance", "score"], description: "Runner: win by metres run or by pickups taken." },
    target: num(`Runner: metres (100 to 600 is a minute or two) or pickups. Collector: pickups to gather, ${range("collector", "target")}. Match: score to reach, ${range("match", "target")} (about 75 points a move).`),
    hazards: num(`Collector: how many roam, ${range("collector", "hazards")}.`),
    hazardSpeed: num(`Collector: ${range("collector", "hazardSpeed")}.`),
    seconds: num(`Collector: time limit, ${range("collector", "seconds")}.`),
    cols: num(`Match: ${range("match", "cols")}.`),
    rows: num(`Match: ${range("match", "rows")}.`),
    kinds: num(`Match: tile kinds, ${range("match", "kinds")}; fewer is easier.`),
    moves: num(`Match: ${range("match", "moves")}.`),
  }),
  said: str("One short sentence to the player on what you made or changed."),
});

const templates = TEMPLATES.map((t) => `- ${t}: ${TEMPLATE_INFO[t].genre}. ${TEMPLATE_INFO[t].says} Controls: ${TEMPLATE_INFO[t].controls}.`).join("\n");

const SYSTEM = [
  "You design small browser games for haggs Playable. A game is a spec for one of three templates; you never write code.",
  templates,
  "Pick the template that fits the idea best, and theme everything to it: the title, the words on the cards, the colours, and what each piece of art shows.",
  "Make it fair and fun on a first try: a minute or two to win, not instantly and not impossible. Keep words short and plain, with no brand names, real people or existing games' characters.",
  "Fill every field. Rules and art that the chosen template doesn't use are ignored, so give them any sensible value.",
].join("\n\n");

export function ideaRequest(idea: string): DraftRequest {
  const text = idea.trim();
  if (text.length < 4) throw new Error("Say what the game is about, a few words is enough.");
  if (text.length > 2000) throw new Error("That idea is too long. Keep it under 2,000 characters.");
  return { system: SYSTEM, user: `Make a game from this idea:\n\n${text}`, maxTokens: 4000 };
}

/** The spec as Claude sees it: no picture links, which it has no use for and shouldn't rewrite. */
export function forClaude(spec: GameSpec): unknown {
  return JSON.parse(JSON.stringify(spec, (k, v) => (k === "url" || k === "version" ? undefined : v)));
}

export function editRequest(spec: GameSpec, message: string): DraftRequest {
  const text = message.trim();
  if (!text) throw new Error("Say what to change.");
  if (text.length > 2000) throw new Error("That message is too long. Keep it under 2,000 characters.");
  const user = [
    "Here is the game as it is now:",
    JSON.stringify(forClaude(spec)),
    "Change it as the player asks, and keep everything they didn't ask to change exactly as it is. Change the template only if they ask for a different kind of game.",
    `The player says: ${text}`,
  ].join("\n\n");
  return { system: SYSTEM, user, maxTokens: 4000 };
}

export type GameReply = { spec: GameSpec; said: string };

/**
 * Claude's reply as a spec. When it's an edit, art that was already made
 * stays on every slot whose prompt didn't change.
 */
export function readGameReply(value: unknown, before?: GameSpec): GameReply {
  const v = value as { said?: unknown } | null;
  const read = readSpec(value);
  const spec = before ? keepMadeArt(before, read) : read;
  const said = typeof v?.said === "string" && v.said.trim() ? v.said.trim().slice(0, 300) : before ? "Changed." : `Made ${spec.title}.`;
  return { spec, said };
}
