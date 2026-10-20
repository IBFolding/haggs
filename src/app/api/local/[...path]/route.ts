import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { localFile, parseRange } from "../../../../server/local-media";

/** Streams a file from HAGGS_LOCAL_MEDIA in development. See server/local-media.ts. */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = localFile(process.env.HAGGS_LOCAL_MEDIA, path, process.env.NODE_ENV);
  if (!file) return new Response("Not found", { status: 404 });

  const headers = { "Content-Type": file.type, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  const range = parseRange(request.headers.get("range"), file.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${file.size}` } });
  }
  const { start, end } = range ?? { start: 0, end: file.size - 1 };
  const body = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "Content-Length": String(end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${file.size}` } : {}) },
  });
}
