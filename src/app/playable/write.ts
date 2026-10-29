"use client";

import { ERROR_MARK, progressOf } from "../../playable/code";

export type WriteBody =
  | { mode: "idea"; quality: "quality" | "fast"; idea: string; genre?: string; three: boolean; references?: { id: string; label: string }[] }
  | { mode: "edit"; quality: "quality" | "fast"; game: unknown; message: string }
  | { mode: "fix"; quality: "quality" | "fast"; game: unknown; error: string };

export type Written = { ok: true; text: string } | { ok: false; reason: string; needsKey?: boolean };

/** Asks the write route for a game and reads Claude's reply as it streams, reporting lines written. */
export async function writeGame(body: WriteBody, onLines: (lines: number) => void, signal?: AbortSignal): Promise<Written> {
  let response: Response;
  try {
    response = await fetch("/api/playable/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...(signal ? { signal } : {}) });
  } catch {
    return { ok: false, reason: "Claude couldn't be reached. Try again." };
  }
  if (!response.ok || !response.body) {
    const b = (await response.json().catch(() => null)) as { reason?: string; needsKey?: boolean } | null;
    return { ok: false, reason: b?.reason ?? `The game couldn't be written (status ${response.status}).`, ...(b?.needsKey ? { needsKey: true } : {}) };
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
      onLines(progressOf(text).lines);
    }
  } catch {
    return { ok: false, reason: "The connection dropped while the game was being written. Try again." };
  }
  const at = text.indexOf(ERROR_MARK);
  if (at >= 0) return { ok: false, reason: text.slice(at + ERROR_MARK.length).trim() || "The game couldn't be finished." };
  return { ok: true, text };
}
