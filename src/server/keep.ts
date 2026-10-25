import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Kept } from "../providers/cloud";
import { userNow } from "./auth";
import type { User } from "./billing";
import { hosted, libraryToken, putBlob, putLibrary } from "./blob";
import { localUrl } from "./local-media";

type Account = { user: () => Promise<User | null>; token: string | undefined; upload: (bytes: Uint8Array, extension: string, userId: string) => Promise<string> };

/**
 * On your own computer, a signed-in person's finished result goes straight to their account's file store,
 * so it plays on every device from the moment it exists. Null when that isn't possible (nobody signed in,
 * file sync not set up, or the upload failed): the caller keeps it locally and the background copy picks it up.
 */
export async function keepInAccount(bytes: Uint8Array, extension: string, via: Account = { user: userNow, token: libraryToken(), upload: putLibrary }): Promise<string | null> {
  if (!via.token) return null;
  const user = await via.user();
  if (!user) return null;
  try {
    return await via.upload(bytes, extension, user.id);
  } catch {
    return null;
  }
}

/** Keeps a finished result in the account's file store when it can, else in the local media folder (development) and returns the link the app plays it from. */
export async function keepResult(bytes: Uint8Array, extension: Kept): Promise<string> {
  if (hosted()) return putBlob(bytes, extension);
  const inAccount = await keepInAccount(bytes, extension);
  if (inAccount) return inAccount;
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root || process.env.NODE_ENV === "production") throw new Error("Set HAGGS_LOCAL_MEDIA so results have somewhere to be kept.");
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  await mkdir(join(root, "haggs-renders"), { recursive: true });
  await writeFile(join(root, "haggs-renders", name), bytes);
  return localUrl("haggs-renders", name);
}
