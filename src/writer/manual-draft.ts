import type { Format } from "../sheets/formats";
import { applyDraft, DRAFT_SCHEMA, draftRequest, validateDraft } from "./draft";
import { readReply } from "./breakdown";

/** The exact writing request, usable in a chat without an API key. */
export function manualDraftPrompt(format: Format, idea: string, notes: string): string {
  if (idea.trim().length < 12) throw new Error("Say a little more about the idea first.");
  const request = draftRequest(format, idea.slice(0, 8000), notes.slice(0, 4000));
  return [request.system, `Return one JSON object matching this JSON Schema. Escape newlines inside the script string. Do not omit the production sheets.\n${JSON.stringify(DRAFT_SCHEMA)}`, request.user].join("\n\n");
}
export function readManualDraft(raw: string, format: Format) {
  if (raw.length > 1_000_000) throw new Error("That reply is too large. Paste a draft under 1 MB.");
  return applyDraft(validateDraft(readReply(raw)), format);
}
