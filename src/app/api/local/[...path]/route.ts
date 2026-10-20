import { open } from "node:fs/promises";

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
  // Read the range in chunks. Browsers cancel video requests constantly while
  // scrubbing; cancelling simply closes the file instead of erroring the server.
  const handle = await open(file.path, "r");
  let position = start;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const size = Math.min(256 * 1024, end + 1 - position);
        if (size <= 0) {
          await handle.close();
          controller.close();
          return;
        }
        const chunk = new Uint8Array(size);
        const { bytesRead } = await handle.read(chunk, 0, size, position);
        if (!bytesRead) {
          await handle.close();
          controller.close();
          return;
        }
        position += bytesRead;
        controller.enqueue(chunk.subarray(0, bytesRead));
      } catch {
        await handle.close().catch(() => undefined);
        try {
          controller.close();
        } catch {
          // Already closed by a cancel.
        }
      }
    },
    async cancel() {
      await handle.close().catch(() => undefined);
    },
  });
  return new Response(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "Content-Length": String(end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${file.size}` } : {}) },
  });
}
