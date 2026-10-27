import {jobOutcome} from "../providers/job-outcome";
import {reserveStorage,finishStorage} from "./storage-quota";
import { put } from "@vercel/blob";

import { ownerOf, signInRequired, userNow } from "./auth";
import { allow } from "./limit";

/**
 * The hosted file store. On a deployment with a Vercel Blob store connected
 * (BLOB_READ_WRITE_TOKEN), results, uploads and renders are kept there and
 * played from https links; on a developer's machine they go to the local
 * media folder as before.
 */

export const hosted = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", wav: "audio/wav" };

/** Keeps bytes in the store and returns the public link. The name is unguessable. */
export async function putBlob(bytes: Uint8Array, extension: string, folder = "results"): Promise<string> {
  const user = await userNow();
  if (signInRequired() && !user) throw new Error("Sign in to save results here.");
  if (!user) throw new Error("Sign in to use cloud storage.");
  // 300 saved files an hour each; guests share one allowance per server instance.
  if (!allow(`save:${user ? user.id : "guest"}`, user ? 300 : 600, 3_600_000)) throw new Error("That's a lot of results for now. Try again in a little while.");
  const ext = extension.toLowerCase().replace(/^\./, "");
  const type = TYPES[ext];
  if (!type) throw new Error("That kind of file can't be kept.");
  const day = new Date().toISOString().slice(0, 10);
  const hold=jobOutcome.getStore()?.storage;
  const reusable=hold&&hold.userId===user.id&&!hold.saved&&bytes.byteLength<=hold.maxBytes;
  const reservation=reusable?hold.id:await reserveStorage(user,bytes.byteLength);
  const made = await put(`haggs/${ownerOf(user)}/${folder}/${day}-${crypto.randomUUID().slice(0, 8)}.${ext}`, Buffer.from(bytes), { access: "public", contentType: type, addRandomSuffix: true });
  await finishStorage(user.id,reservation,made.url,bytes.byteLength);
  if(reusable)hold.saved=true;
  return made.url;
}

/** A link into this app's own store: the only web links the server will fetch media from when hosted. */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** The token for the file store: the deployment's own, or on a developer's machine the one set aside for keeping files in your account. */
export const libraryToken = () => process.env.BLOB_READ_WRITE_TOKEN ?? process.env.HAGGS_SYNC_BLOB_TOKEN;

/** Keeps a file in a signed-in person's own folder of the file store, and returns the public link. */
export async function putLibrary(bytes: Uint8Array, extension: string, userId: string): Promise<string> {
  const token = libraryToken();
  if (!token) throw new Error("File sync isn't set up on this copy of haggs.");
  const ext = extension.toLowerCase().replace(/^\./, "");
  const type = TYPES[ext];
  if (!type) throw new Error("That kind of file can't be kept.");
  const day = new Date().toISOString().slice(0, 10);
  const user = await userNow();
  if (!user || user.id!==userId) throw new Error("Sign in to save to your own storage.");
  const hold=jobOutcome.getStore()?.storage;
  const reusable=hold&&hold.userId===user.id&&!hold.saved&&bytes.byteLength<=hold.maxBytes;
  const reservation=reusable?hold.id:await reserveStorage(user,bytes.byteLength);
  const made = await put(`haggs/u-${userId}/library/${day}-${crypto.randomUUID().slice(0, 8)}.${ext}`, Buffer.from(bytes), { access: "public", contentType: type, addRandomSuffix: true, token });
  await finishStorage(userId,reservation,made.url,bytes.byteLength);
  if(reusable)hold.saved=true;
  return made.url;
}
