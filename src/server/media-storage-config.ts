export const privateMediaWrites = () => process.env.HAGGS_PRIVATE_MEDIA_WRITES === "1";
export function mediaWriteToken(): string | undefined {
  if (!privateMediaWrites()) return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.HAGGS_SYNC_BLOB_TOKEN;
  const token = process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Private media storage is not configured. No upload or generation was started.");
  return token;
}
