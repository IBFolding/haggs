"use server";

import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";

import { CLAUDE_COOKIE, keyIn } from "../server/keys";

/**
 * The in-app agent's brain: one turn of a conversation with Claude, with
 * haggs's tools described. The tools themselves run in the browser, against
 * the person's own projects, so this never sees or stores a project.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the producer inside haggs, an open-source film studio that runs on Comfy. People make films here: Sheets (script, characters, places, beats, shot list) → Board (the story as a flow of shots, with subplot lanes) → Cut (the editor: takes, trims, splits, voice-over, soundtrack, Render MP4) → Media. Create and Video make single pictures and clips; Swap puts a new character into a video; Workflows runs Comfy workflows as simple apps.

You can read the person's projects and change them with the tools. Every change you make shows in the chat with an Undo, so make the change rather than describing it, then say in a sentence what you did. Read before you change: get the board before editing its shots.

You never spend money. Generating, animating, speaking lines and running workflows cost the person's credits, so you set things up and send them to the page where they press the button that shows the price. Never delete anything.

Keep replies short and plain. Name shots by number and beat, not by id.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "list_projects", description: "The person's projects, each with its boards and how many shots they have.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "read_board",
    description: "One board's shots in order: id, number, beat, seconds, what it shows (still, video or nothing), how many takes, whether it's kept as it is, and its voice-over lines.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string", description: "Board id; the first board if left out." } }, required: ["project"], additionalProperties: false },
  },
  {
    name: "read_sheets",
    description: "The project's sheets: characters (looks, how many reference pictures), places, and the board's story beats.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" } }, required: ["project"], additionalProperties: false },
  },
  {
    name: "edit_shots",
    description: "Change shots on a board: the beat, the seconds it holds, or keep it as it is (locked, so batch tools leave it alone). Only the fields given change.",
    input_schema: {
      type: "object",
      properties: {
        project: { type: "string" },
        board: { type: "string" },
        edits: { type: "array", items: { type: "object", properties: { shot: { type: "string" }, beat: { type: "string" }, seconds: { type: "number" }, locked: { type: "boolean" } }, required: ["shot"], additionalProperties: false } },
      },
      required: ["project", "board", "edits"],
      additionalProperties: false,
    },
  },
  {
    name: "move_shot",
    description: "Move a shot to a new position on its board (1 is first).",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" }, shot: { type: "string" }, to: { type: "integer", minimum: 1 } }, required: ["project", "board", "shot", "to"], additionalProperties: false },
  },
  {
    name: "add_board",
    description: "Add a new board to a project. Each shot reuses an existing shot by id (keeping its takes) or starts empty from a beat. Nothing already there changes.",
    input_schema: {
      type: "object",
      properties: {
        project: { type: "string" },
        name: { type: "string" },
        shots: { type: "array", items: { type: "object", properties: { beat: { type: "string" }, seconds: { type: "number" }, from: { type: "string" }, dialogue: { type: "string" }, locked: { type: "boolean" } }, required: ["beat", "seconds"], additionalProperties: false } },
      },
      required: ["project", "name", "shots"],
      additionalProperties: false,
    },
  },
  {
    name: "add_voice_line",
    description: "Put a voice-over line on a shot. It is not spoken yet; the person presses Speak in the Cut, which shows the price. Voices: Sarah (female, american), Laura (female, american), Chris (male, american), Brian (male, american), George (male, british), Alice (female, british) and others from ElevenLabs.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" }, shot: { type: "string" }, speaker: { type: "string" }, text: { type: "string" }, voice: { type: "string" }, offset: { type: "number", description: "Seconds after the shot starts." } }, required: ["project", "board", "shot", "speaker", "text", "voice"], additionalProperties: false },
  },
  {
    name: "find_workflows",
    description: "Search Comfy's workflows that run here, by what they do (character swap, product video, upscale…).",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "open_page",
    description: "Take the person to a page in haggs: /library, /photos (make pictures), /edit (edit a picture), /video, /swap (put a character into a video), /editor (the Cut of their last board), /workflows, /workflows/<name>, /board/<project>?b=<board>, /board/<project>/sheets?b=<board>, /board/<project>/cut?b=<board>, /board/<project>/media?b=<board>, /gallery.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
];

export type AgentTurn =
  | { ok: true; content: Anthropic.Beta.BetaContentBlock[]; stop: string | null }
  | { ok: false; reason: string; needsKey?: boolean };

export async function claudeHeld(): Promise<boolean> {
  return Boolean(keyIn(await cookies(), CLAUDE_COOKIE));
}

/** One turn. The history only ever grows (the page someone is on travels in their own message), so Claude's thinking stays valid. */
export async function agentTurn(messages: Anthropic.Beta.BetaMessageParam[]): Promise<AgentTurn> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key to talk to the producer.", needsKey: true };
  if (!Array.isArray(messages) || !messages.length || messages.length > 400) return { ok: false, reason: "That conversation can't be sent." };
  const client = new Anthropic({ apiKey: key });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined that request." };
    return { ok: true, content: response.content, stop: response.stop_reason };
  } catch (caught) {
    if (caught instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Anthropic refused the Claude key.", needsKey: true };
    if (caught instanceof Anthropic.RateLimitError) return { ok: false, reason: "Claude is busy right now. Try again in a moment." };
    if (caught instanceof Anthropic.APIError) return { ok: false, reason: `Claude answered ${caught.status}: ${caught.message.slice(0, 200)}` };
    return { ok: false, reason: "Claude couldn't be reached." };
  }
}
