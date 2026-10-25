import type { DraftRequest } from "./draft";

/**
 * "Improve my prompt": Claude rewrites what you typed into a fuller prompt for the picture or video model, keeping your idea.
 * Costs a few cents on your own Claude key; the result goes into the box for you to read and change before anything is made.
 */

export type ImproveSurface = "Create" | "Video" | "Edit";

export const IMPROVE_SCHEMA = {
  type: "object",
  properties: { improved: { type: "string", description: "The rewritten prompt, one paragraph, no quotation marks." } },
  required: ["improved"],
  additionalProperties: false,
};

const KIND: Record<ImproveSurface, string> = {
  Create: "a still picture. Add the subject's look, the setting, the light, the lens and framing, the mood and the style, in that order of importance.",
  Video: "a short video clip. Add the subject and what they do, how the camera moves, the setting, the light and the pace. One continuous shot; describe motion in plain words.",
  Edit: "an edit to an existing picture. Say exactly what to change and what to keep exactly the same. Do not describe the whole picture again.",
};

export function improveRequest(prompt: string, surface: ImproveSurface): DraftRequest {
  const text = prompt.trim();
  if (!text) throw new Error("Describe what you want first.");
  if (text.length > 3000) throw new Error("That prompt is too long to improve. Trim it under 3,000 characters.");
  const system = [
    `You improve prompts for an AI image and video model. The person is making ${KIND[surface]}`,
    "Keep their idea, subject and any names or words they gave. Make it more specific and more visual, in 40 to 120 words, one paragraph.",
    "Do not add new characters, brands, logos or text on the picture that they did not ask for. Do not invent a different story.",
    "Return only the improved prompt in the field provided.",
  ].join(" ");
  return { system, user: text, maxTokens: 600 };
}

export function readImproved(value: unknown): string {
  const raw = typeof (value as { improved?: unknown } | null)?.improved === "string" ? (value as { improved: string }).improved : "";
  const text = raw.trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  if (!text) throw new Error("Claude sent back no prompt. Try again.");
  if (text.length > 4000) throw new Error("Claude's prompt was too long to use. Try again.");
  return text;
}
