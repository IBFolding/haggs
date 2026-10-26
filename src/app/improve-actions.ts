"use server";

import { cookies } from "next/headers";

import { CLAUDE_COOKIE, claudeWorkspaceIn, keyIn } from "../server/keys";
import { askClaude } from "../writer/draft";
import { IMPROVE_SCHEMA, improveRequest, readImproved, type ImproveSurface } from "../writer/improve";

export type Improved = { ok: true; prompt: string } | { ok: false; reason: string; needsKey?: boolean };

/** Claude rewrites a prompt into a fuller one for the picture or video model. A few cents on your Claude key; never retried automatically. */
export async function improvePrompt(prompt: string, surface: ImproveSurface): Promise<Improved> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key to improve prompts.", needsKey: true };
  if (surface !== "Create" && surface !== "Video" && surface !== "Edit") return { ok: false, reason: "That can't be improved here." };
  let request;
  try {
    request = improveRequest(String(prompt), surface);
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That can't be improved." };
  }
  const result = await askClaude<string>({ key, workspaceId: claudeWorkspaceIn(await cookies()), request, schema: IMPROVE_SCHEMA, read: readImproved });
  return result.ok ? { ok: true, prompt: result.draft } : { ok: false, reason: result.reason };
}
