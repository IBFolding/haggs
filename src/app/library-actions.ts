"use server";

import { userNow } from "../server/auth";
import { isBlobUrl, libraryToken, putLibrary } from "../server/blob";
import { allow } from "../server/limit";
import { readMedia } from "../server/media";

const EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/mpeg": "mp3", "audio/flac": "flac", "audio/wav": "wav" };
const MAX_BYTES = 250 * 1024 * 1024;

export type Kept = { ok: true; url: string } | { ok: false; reason: string; final?: boolean };

/**
 * Keeps one of your results in your account's file store so every device can
 * play it. A file that is already there is left alone. Comfy deletes the
 * output of partner models (MiniMax, FLUX, Kling) after 24 hours, so this
 * copy is the one that lasts.
 */
export async function keepInLibrary(url: string): Promise<Kept> {
  const user = await userNow();
  if (!user) return { ok: false, reason: "Sign in to keep your results in your account." };
  if (isBlobUrl(url)) return { ok: true, url };
  if (!url.startsWith("/api/local/")) return { ok: false, reason: "That result isn't a file on this machine.", final: true };
  if (!libraryToken()) return { ok: false, reason: "File sync isn't set up on this copy of haggs." };
  if (!allow(`library:${user.id}`, 600, 3_600_000)) return { ok: false, reason: "Slow down a little; syncing resumes shortly." };
  try {
    const media = await readMedia(url);
    if (media.bytes.length > MAX_BYTES) return { ok: false, reason: "That file is over 250 MB.", final: true };
    const ext = EXTENSION[media.mime];
    if (!ext) return { ok: false, reason: "That kind of file can't be kept.", final: true };
    return { ok: true, url: await putLibrary(media.bytes, ext, user.id) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The file couldn't be kept." };
  }
}
