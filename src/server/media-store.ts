import { list, del } from "@vercel/blob";
import { privateMediaPath, privateMediaUrl } from "./private-media-url";
export function mediaStores() {
  const stores: { token: string; private: boolean }[] = [];
  const legacy = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.HAGGS_SYNC_BLOB_TOKEN;
  const privateToken = process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
  if (legacy) stores.push({ token: legacy, private: false });
  if (privateToken) stores.push({ token: privateToken, private: true });
  return stores;
}
export async function listStoredMedia(prefix: string) {
  const items: { url: string; pathname: string; size: number; uploadedAt: number }[] = [];
  for (const store of mediaStores()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, token: store.token, ...(cursor ? { cursor } : {}) });
      items.push(...page.blobs.map(b => ({ url: store.private ? privateMediaUrl(b.pathname) : b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.getTime() })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
  return items;
}
/** Caller must first match these URLs against its owner-scoped listing. */
export async function deleteStoredMedia(url: string) {
  const privateObject = privateMediaPath(url);
  const token = privateObject ? process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN : process.env.BLOB_READ_WRITE_TOKEN ?? process.env.HAGGS_SYNC_BLOB_TOKEN;
  if (!token) throw new Error("Storage is not configured.");
  await del(privateObject?.path ?? url, { token });
}
