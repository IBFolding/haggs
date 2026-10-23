import { readFile } from "node:fs/promises";

import { hosted, isBlobUrl } from "./blob";
import { localFile } from "./local-media";

export type Media = { bytes: Uint8Array; mime: string };

/** Whether a link is something the server may read: a file in the local media folder, or this app's own store. */
export const mediaAllowed = (url: string) => url.startsWith("/api/local/") || isBlobUrl(url);

/** Reads a take, a still or an upload as bytes: from the local media folder in development, or from the app's own file store when hosted. */
export async function readMedia(url: string): Promise<Media> {
  const data = /^data:([\w/+.-]+);base64,(.+)$/.exec(url);
  if (data) return { bytes: Uint8Array.from(Buffer.from(data[2]!, "base64")), mime: data[1]! };
  if (url.startsWith("/api/local/")) {
    const file = localFile(process.env.HAGGS_LOCAL_MEDIA, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
    if (!file) throw new Error("That file isn't in the local media folder.");
    return { bytes: new Uint8Array(await readFile(file.path)), mime: file.type };
  }
  if (isBlobUrl(url)) {
    const got = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
    if (!got.ok) throw new Error("That file couldn't be fetched from the store.");
    return { bytes: new Uint8Array(await got.arrayBuffer()), mime: (got.headers.get("content-type") ?? "").split(";")[0]! };
  }
  throw new Error(hosted() ? "That file isn't in this app's store." : "Add the file from your computer first.");
}
