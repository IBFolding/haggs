import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Kept } from "../providers/cloud";
import { hosted, putBlob } from "./blob";
import { localUrl } from "./local-media";

/** Keeps a finished result in the local media folder (development) and returns the link the app plays it from. */
export async function keepResult(bytes: Uint8Array, extension: Kept): Promise<string> {
  if (hosted()) return putBlob(bytes, extension);
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root || process.env.NODE_ENV === "production") throw new Error("Set HAGGS_LOCAL_MEDIA so results have somewhere to be kept.");
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  await mkdir(join(root, "haggs-renders"), { recursive: true });
  await writeFile(join(root, "haggs-renders", name), bytes);
  return localUrl("haggs-renders", name);
}
