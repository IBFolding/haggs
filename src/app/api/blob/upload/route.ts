import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { ownerOf, signInRequired, verifyUser } from "../../../../server/auth";
import { hosted } from "../../../../server/blob";
import { allow, caller } from "../../../../server/limit";

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
  const user = await verifyUser(request);
  // 40 uploads an hour each, guests by address.
  if (!allow(`upload:${caller(request, user?.id)}`, 40, 3_600_000)) return Response.json({ ok: false, reason: "That's a lot of uploads. Try again in a little while." }, { status: 429 });
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // A person uploads into their own folder; guests into the shared one, unless sign-in is required.
        if (signInRequired() && !user) throw new Error("Sign in to add files here.");
        if (!pathname.startsWith(`haggs/${ownerOf(user)}/uploads/`)) throw new Error("That isn't your folder.");
        return {
        allowedContentTypes: ["video/*", "image/*", "audio/*"],
        maximumSizeInBytes: 300 * 1024 * 1024,
        addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return Response.json(result);
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "The upload couldn't start." }, { status: 400 });
  }
}
