import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { hosted } from "../../../../server/blob";

/**
 * Lets the browser send a file straight to the app's file store (hosted only),
 * so a video of any size never has to pass through a function. The token it
 * hands out is for one upload, to this app's folder, of media only.
 */
export async function POST(request: Request) {
  if (!hosted()) return Response.json({ ok: false, reason: "File uploads here need the hosted file store." }, { status: 404 });
  // Only this site's own pages may ask for an upload token.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ ok: false, reason: "Not allowed." }, { status: 403 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*", "image/*", "audio/*"],
        maximumSizeInBytes: 300 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => undefined,
    });
    return Response.json(result);
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "The upload couldn't start." }, { status: 400 });
  }
}
