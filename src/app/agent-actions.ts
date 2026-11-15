"use server";

import Anthropic from "@anthropic-ai/sdk";
import { anthropicOptions, anthropicErrorReason } from "../writer/anthropic-config";
import { cookies } from "next/headers";

import { CLAUDE_COOKIE, keyIn, claudeWorkspaceIn } from "../server/keys";
import {HAGGY_TOOLS} from "../agent/tool-definitions";

/**
 * The in-app agent's brain: one turn of a conversation with Claude, with
 * haggs's tools described. The tools themselves run in the browser, against
 * the person's own projects, so this never sees or stores a project.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are Haggy, the producer inside haggs, an open-source film studio that runs on Comfy. People make films here: Sheets (script, characters, places, beats, shot list) → Board (the story as a flow of shots, with subplot lanes) → Cut (the editor: takes, trims, splits, voice-over, soundtrack, Render MP4) → Media. Create and Video make single pictures and clips; Swap puts a new character into a video; Workflows runs Comfy workflows as simple apps.

You can read the person's projects and change them with the tools. Every change you make shows in the chat with an Undo, so make the change rather than describing it, then say in a sentence what you did. Read before you change: get the board before editing its shots.

You never spend money. Generating, animating, speaking lines and running workflows cost the person's credits, so you set things up and send them to the page where they press the button that shows the price. Never delete anything.

You introduce yourself as Haggy if asked who you are. Keep replies short and plain. Name shots by number and beat, not by id.`;


export type AgentTurn =
  | { ok: true; content: Anthropic.Beta.BetaContentBlock[]; stop: string | null }
  | { ok: false; reason: string; needsKey?: boolean };

export async function claudeHeld(): Promise<boolean> {
  return Boolean(keyIn(await cookies(), CLAUDE_COOKIE));
}

/** One turn. The history only ever grows (the page someone is on travels in their own message), so Claude's thinking stays valid. */
export async function agentTurn(messages: Anthropic.Beta.BetaMessageParam[]): Promise<AgentTurn> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key to talk to Haggy.", needsKey: true };
  if (!Array.isArray(messages) || !messages.length || messages.length > 400) return { ok: false, reason: "That conversation can't be sent." };
  try {
    const client = new Anthropic(anthropicOptions(key, claudeWorkspaceIn(await cookies())));
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: HAGGY_TOOLS,
      messages,
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined that request." };
    return { ok: true, content: response.content, stop: response.stop_reason };
  } catch (caught) {
    if (caught instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Anthropic refused the Claude key.", needsKey: true };
    if (caught instanceof Anthropic.RateLimitError) return { ok: false, reason: "Claude is busy right now. Try again in a moment." };
    if (caught instanceof Anthropic.APIError) return { ok: false, reason: anthropicErrorReason(caught.status, caught.message) };
    return { ok: false, reason: caught instanceof Error && caught.message.startsWith("Enter an Anthropic workspace ID") ? caught.message : "Claude couldn't be reached." };
  }
}
