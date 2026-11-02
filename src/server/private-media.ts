import { get } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { userNow, verifyUser } from "./auth";
import { privateMediaResponse } from "./private-media-access";
export const privateBlobToken = () => process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
export async function readPrivateMedia(url: string, request?: Request, forwardRange = true): Promise<Response> {
  const token = privateBlobToken();
  if (!token) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return privateMediaResponse(url, forwardRange ? request?.headers.get("range") ?? null : null, {
    user: () => request ? verifyUser(request) : userNow(),
    published: async (location, owner) => {
      const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!endpoint || !key) return false;
      const db = createClient(endpoint, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await db.from("posts").select("id").eq("url", location).eq("user_id", owner).limit(1);
      return !error && Boolean(data?.length);
    },
    read: async (path, range) => {
      const got = await get(path, { access: "private", token, useCache: false, ...(range ? { headers: { Range: range } } : {}) });
      if (!got || got.statusCode !== 200) return null;
      return new Response(got.stream, { status: got.headers.has("content-range") ? 206 : 200, headers: got.headers });
    },
  });
}
