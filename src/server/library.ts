/**
 * Keeping the file store tidy: what a person has in it, deleting it, and
 * what is old enough to go. The rules are pure; the store calls live in the
 * actions and the daily job that use them.
 */

export type Item = { url: string; pathname: string; size: number; uploadedAt: number };

/** How long files are kept, in days. The terms say the same. */
export const KEEP_DAYS = 60;

/** Only files in this person's own folder are theirs to list or delete. */
export const ownsPath = (owner: string, pathname: string) => pathname.startsWith(`haggs/${owner}/`) && !pathname.includes("..");

export function mine(owner: string, items: Item[]): Item[] {
  return items.filter((i) => ownsPath(owner, i.pathname)).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** Files older than the keep time. Anything outside the app's own folder is never touched. */
export function expired(items: Item[], now = Date.now(), days = KEEP_DAYS): Item[] {
  return items.filter((i) => i.pathname.startsWith("haggs/") && now - i.uploadedAt > days * 86_400_000);
}

export const megabytes = (bytes: number) => Math.round((bytes / 1_000_000) * 10) / 10;
export const totalBytes = (items: Item[]) => items.reduce((n, i) => n + i.size, 0);

/** The urls from a request that really belong to the owner, as the store reported them. */
export function deletable(owner: string, wanted: string[], held: Item[]): string[] {
  const own = new Set(mine(owner, held).map((i) => i.url));
  return wanted.filter((u) => own.has(u));
}
