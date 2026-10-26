"use server";

import Anthropic from "@anthropic-ai/sdk";
import { anthropicOptions, anthropicErrorReason } from "../writer/anthropic-config";
import { cookies } from "next/headers";

import { checkFrames, parseFocus, type Frame, type Point } from "../story/focus";
import { CLAUDE_COOKIE, keyIn, claudeWorkspaceIn } from "../server/keys";

/** Small and quick: it only has to say where in a picture the main subject is. */
const MODEL = "claude-haiku-5-5";

const PROMPT = `Each picture is one shot from a film. For every picture, say where to centre a tall, narrow crop so the main subject stays in frame: the face of the person who matters most, or the most important thing if there is no person. Give the point as x (0 is the left edge, 1 the right) and y (0 the top, 1 the bottom).
Answer with only a JSON list, one entry per picture in order, like [{"i":0,"x":0.42,"y":0.35},{"i":1,"x":0.7,"y":0.3}]. No other words.`;

export type Found = { ok: true; focus: Record<string, Point> } | { ok: false; reason: string; needsKey?: boolean };

/** Looks at up to eight shots and says where each one's subject is. Uses the person's own Claude key; a few shots cost a fraction of a cent. */
export async function findSubjects(frames: Frame[]): Promise<Found> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key to find the faces.", needsKey: true };
  const bad = checkFrames(frames);
  if (bad) return { ok: false, reason: bad };
  try {
    const client = new Anthropic(anthropicOptions(key, claudeWorkspaceIn(await cookies())));
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            ...frames.flatMap((f, i): Anthropic.Messages.ContentBlockParam[] => [
              { type: "text", text: `Picture ${i}:` },
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpeg.slice("data:image/jpeg;base64,".length) } },
            ]),
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { ok: true, focus: parseFocus(text, frames.map((f) => f.id)) };
  } catch (caught) {
    if (caught instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Anthropic refused the Claude key.", needsKey: true };
    if (caught instanceof Anthropic.RateLimitError) return { ok: false, reason: "Claude is busy right now. Try again in a moment." };
    if (caught instanceof Anthropic.APIError) return { ok: false, reason: anthropicErrorReason(caught.status, caught.message) };
    return { ok: false, reason: caught instanceof Error && caught.message.startsWith("Enter an Anthropic workspace ID") ? caught.message : "Claude couldn't be reached." };
  }
}
