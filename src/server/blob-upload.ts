import {reserveStorage,finishStorage,reconcileStorage,uploadFolder} from "./storage-quota";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { ownerOf, requestToken, verifyUser } from "./auth";
import { privateBlobToken } from "./private-media";
import { privateMediaUrl } from "./private-media-url";
import { privateMediaWrites } from "./media-storage-config";
import { allow, caller } from "./limit";

/**
 * Lets the browser send a file straight to the app's file store (hosted only),
 * so a video of any size never has to pass through a function. The token it
 * hands out is for one upload, to this app's folder, of media only.
 */
export async function handleBlobUpload(request: Request, privateStore: boolean) {
  const token = privateStore ? privateBlobToken() : process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ ok: false, reason: "File uploads here need the hosted file store." }, { status: 404 });
  const body = await request.json().catch(() => null) as HandleUploadBody | null;
  if (!body) return Response.json({ ok: false, reason: "Invalid upload request." }, { status: 400 });
  if (body.type !== "blob.upload-completed" && privateStore !== privateMediaWrites()) return Response.json({ ok: false, reason: "Upload destination changed. Reload and try again." }, { status: 503 });
  // SDK verifies the completion callback signature; only token requests require browser origin.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && host && new URL(origin).host === host); } catch {}
  if (body.type !== "blob.upload-completed" && !sameOrigin) return Response.json({ ok: false, reason: "Not allowed." }, { status: 403 });
  const user = await verifyUser(request);
  // 40 uploads an hour each, guests by address.
  if (body.type !== "blob.upload-completed" && !allow(`upload:${caller(request, user?.id)}`, 40, 3_600_000)) return Response.json({ ok: false, reason: "That's a lot of uploads. Try again in a little while." }, { status: 429 });
  try {
    const result = await handleUpload({
      request,
      body,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // A person uploads into their own folder; guests into the shared one, unless sign-in is required.
        if (!user) throw new Error("Sign in to add files here.");
        if (!pathname.startsWith(`haggs/${ownerOf(user)}/uploads/`)) throw new Error("That isn't your folder.");
        // The hold's id names the upload's folder, so an upload whose completion never arrives can still be found and counted.
        const reservation=/^[^/]+\/[^/]+\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/]+$/.exec(pathname)?.[1];
        if (!reservation || !pathname.startsWith(uploadFolder(user.id,reservation))) throw new Error("Reload the page and add the file again.");
        const size=Number(JSON.parse(clientPayload ?? "{}").size);
        if(!Number.isSafeInteger(size)||size<=0||size>300*1024*1024)throw new Error("Keep added files under 300 MB.");
        await reconcileStorage(user,requestToken(request));
        await reserveStorage(user,size,reservation);
        return {
        tokenPayload: JSON.stringify({userId:user.id,reservation}),
        validUntil: Date.now()+15*60*1000,
        allowedContentTypes: privateStore ? ["video/mp4", "video/webm", "video/quicktime", "image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/mp4", "audio/aac", "audio/flac", "audio/wav", "audio/x-wav"] : ["video/*", "image/*", "audio/*"],
        maximumSizeInBytes: size,
        addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({blob, tokenPayload}) => {
        const saved=JSON.parse(tokenPayload ?? "{}");
        if(typeof saved.userId!=="string"||typeof saved.reservation!=="string")throw new Error("Missing storage reservation.");
        await finishStorage(saved.userId,saved.reservation,privateStore ? privateMediaUrl(blob.pathname) : blob.url);
      },
    });
    return Response.json(result);
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "The upload couldn't start." }, { status: 400 });
  }
}
