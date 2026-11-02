import { privateMediaPath } from "./private-media-url";
export type PrivateMediaAccess = {
  user: () => Promise<{ id: string } | null>;
  published: (url: string, owner: string) => Promise<boolean>;
  read: (path: string, range: string | null) => Promise<Response | null>;
};
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
/** Authorization is evaluated on every read, including ranges and public shares. */
export async function privateMediaResponse(url: string, range: string | null, io: PrivateMediaAccess): Promise<Response> {
  const object = privateMediaPath(url);
  const hidden = () => new Response("Not found", { status: 404, headers });
  if (!object) return hidden();
  const user = await io.user();
  if (user?.id !== object.owner && !await io.published(url, object.owner)) return hidden();
  if (range && !/^bytes=(?:[0-9]+-[0-9]*|-[0-9]+)$/.test(range)) return new Response(null, { status: 416, headers });
  const got = await io.read(object.path, range);
  if (!got?.ok || !got.body) return hidden();
  const type = got.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!/^(?:image\/(?:png|jpeg|webp)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|mp4|aac|flac|wav|x-wav))$/.test(type)) { await got.body.cancel(); return hidden(); }
  const outgoing = new Headers(headers);
  outgoing.set("Content-Type", type);
  for (const name of ["content-length", "content-range", "accept-ranges"]) { const value = got.headers.get(name); if (value) outgoing.set(name, value); }
  // Never forward storage URLs, authentication headers, redirects, cookies or public caching.
  return new Response(got.body, { status: got.status === 206 ? 206 : 200, headers: outgoing });
}
