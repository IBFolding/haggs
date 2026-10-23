import { del, list } from "@vercel/blob";

import { expired, type Item } from "../../../../server/library";

/** Runs once a day (see vercel.json). Removes files past their keep time; only Vercel's own scheduler, carrying the project's secret, may call it. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not found", { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: true, removed: 0 });
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "haggs/", limit: 1000, ...(cursor ? { cursor } : {}) });
    const items: Item[] = page.blobs.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.getTime() }));
    const gone = expired(items).map((i) => i.url);
    if (gone.length) { await del(gone); removed += gone.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return Response.json({ ok: true, removed });
}
