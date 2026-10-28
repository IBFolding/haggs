"use server";

import { cookies } from "next/headers";

import { askClaude } from "../../writer/draft";
import { CLAUDE_COOKIE, claudeWorkspaceIn, keyIn } from "../../server/keys";
import { ART_MODEL, artPrompt, artSettings } from "../../playable/art";
import { GAME_SCHEMA, editRequest, ideaRequest, readGameReply, type GameReply } from "../../playable/claude";
import { readSpec, slotsOf, type GameSpec } from "../../playable/spec";
import { estimateGeneration, run } from "../actions";

/**
 * Playable's server side: Claude turns words into a game spec on your own key,
 * and art is made through the same `run` every picture in haggs goes through,
 * so it is priced first, charged in credits (or on your own Comfy key), kept,
 * and never retried.
 */

/**
 * The header's Open weights only switch, read from the cookie it sets. The art
 * model is a partner model, so with the switch on nothing is started. On main
 * the switch isn't in the header yet; this reads the same cookie it will set.
 */
const OPEN_COOKIE = "haggs-open-only";
const OPEN_REFUSAL = "Open weights only is on, and game art uses a partner model (Nano Banana 2 Lite on Comfy Cloud), so nothing was started. The placeholder shapes still play; turn the switch off in the header to make art.";

export type GameAnswer = { ok: true; spec: GameSpec; said: string } | { ok: false; reason: string; needsKey?: boolean };

async function ask(request: () => ReturnType<typeof ideaRequest>, before?: GameSpec): Promise<GameAnswer> {
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key in Keys to make games from words. The three starters work without one.", needsKey: true };
  let built;
  try {
    built = request();
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That can't be sent." };
  }
  const result = await askClaude<GameReply>({ key, workspaceId: claudeWorkspaceIn(jar), request: built, schema: GAME_SCHEMA, read: (v) => readGameReply(v, before) });
  return result.ok ? { ok: true, spec: result.draft.spec, said: result.draft.said } : { ok: false, reason: result.reason };
}

/** Words to a new game. One call on your Claude key. */
export async function gameFromIdea(idea: string): Promise<GameAnswer> {
  return ask(() => ideaRequest(String(idea ?? "")));
}

/** A chat message to a changed game. One call on your Claude key. */
export async function editGame(spec: unknown, message: string): Promise<GameAnswer> {
  let before: GameSpec;
  try {
    before = readSpec(spec);
  } catch {
    return { ok: false, reason: "That game couldn't be read." };
  }
  return ask(() => editRequest(before, String(message ?? "")), before);
}

export type ArtQuote = { ok: true; prices: Record<string, number | null>; model: string; openOnly: boolean } | { ok: false; reason: string };

/** What each piece of art would cost. Reads a price table; starts nothing. */
export async function quoteArt(spec: unknown): Promise<ArtQuote> {
  let game: GameSpec;
  try {
    game = readSpec(spec);
  } catch {
    return { ok: false, reason: "That game couldn't be read." };
  }
  const prices: Record<string, number | null> = {};
  for (const slot of slotsOf(game)) {
    const { usd } = await estimateGeneration(ART_MODEL, artPrompt(game, slot), artSettings(slot), [], false);
    prices[slot.key] = usd;
  }
  return { ok: true, prices, model: "Nano Banana 2 Lite", openOnly: (await cookies()).get(OPEN_COOKIE)?.value === "1" };
}

export type MadeArt = { ok: true; url: string; usd: number | null } | { ok: false; reason: string; needsKey?: boolean };

/** Makes one piece of art. Only ever called from a button that showed its price. */
export async function makeArt(spec: unknown, slotKey: string): Promise<MadeArt> {
  if ((await cookies()).get(OPEN_COOKIE)?.value === "1") return { ok: false, reason: OPEN_REFUSAL };
  let game: GameSpec;
  try {
    game = readSpec(spec);
  } catch {
    return { ok: false, reason: "That game couldn't be read." };
  }
  const slot = slotsOf(game).find((s) => s.key === slotKey);
  if (!slot) return { ok: false, reason: "That piece of art isn't in this game." };
  const result = await run(ART_MODEL, artPrompt(game, slot), artSettings(slot));
  if (!result.ok) return result;
  const shot = result.shots.find((s) => s.kind === "image");
  if (!shot) return { ok: false, reason: "The model returned no picture." };
  return { ok: true, url: shot.url, usd: result.usd };
}
