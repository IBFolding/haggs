import { upload } from "@vercel/blob/client";

import { supabase } from "./session";

/** The folder the signed-in person's files go in, or the shared guest folder. */
async function ownerFolder(): Promise<string> {
  const id = (await supabase()?.auth.getSession())?.data.session?.user.id;
  return id ? `u-${id}` : "guest";
}

export type Uploaded = { ok: true; url: string; kind: "audio" | "video" | "image" | "model"; name: string } | { ok: false; reason: string };

const kindOf = (file: File): "audio" | "video" | "image" | null => (file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null);

/**
 * Adds a file the app can keep. Hosted, it goes straight to the app's file
 * store from the browser; on a developer's machine it goes to the local media
 * folder through /api/upload.
 */
export async function uploadFile(file: File): Promise<Uploaded> {
  if (process.env.NEXT_PUBLIC_HOSTED === "1") {
    const kind = kindOf(file);
    if (!kind) return { ok: false, reason: "Add an audio file, a video or a picture." };
    if (file.size > 300 * 1024 * 1024) return { ok: false, reason: "Keep added files under 300 MB." };
    try {
      const owner = await ownerFolder();
      const made = await upload(`haggs/${owner}/uploads/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "-").slice(-80)}`, file, { access: "public", handleUploadUrl: "/api/blob/upload", clientPayload: JSON.stringify({size:file.size}) });
      return { ok: true, url: made.url, kind, name: file.name };
    } catch (caught) {
      return { ok: false, reason: caught instanceof Error ? caught.message : "The file couldn't be added." };
    }
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { ok?: boolean; url?: string; kind?: "audio" | "video" | "image" | "model"; name?: string; reason?: string } | null;
  if (body?.ok && body.url) return { ok: true, url: body.url, kind: body.kind ?? kindOf(file) ?? "image", name: body.name ?? file.name };
  return { ok: false, reason: body?.reason ?? "The file couldn't be added." };
}
