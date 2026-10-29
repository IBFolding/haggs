import { SOCIALS, cleanProfile, socialUrl, websiteUrl, type Profile, type SocialId } from "../account/profile";

/**
 * Explore: the pictures and clips people choose to share, each with who made it, the words and model it was made
 * with, and what it cost. The database decides who may read and write (see the explore migration); this turns rows
 * into things to show and checks a share before it is sent.
 */

export type PublicProfile = { userId: string; handle: string; name: string; picture: string | null; bio: string; links: Profile["links"] };
export type Post = { id: string; userId: string; kind: "image" | "video"; url: string; prompt: string; model: string; credits: number | null; at: number; by: PublicProfile | null };

/** Only files already in haggs's own store can be shared, so a post can never point anywhere else. */
export const isStoreUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname);
  } catch { return false; }
};

/** Why a run can't be shared, in a sentence, or null when it can. */
export function cantShare(run: { url: string; kind: string }, profile: { handle: string } | null): string | null {
  if (run.kind !== "image" && run.kind !== "video") return "Only pictures and clips can be shared for now.";
  if (!isStoreUrl(run.url)) return "Only things made on the live site can be shared. This one is on this computer only.";
  if (!profile?.handle) return "Pick a handle on your Account page first, so people know who made it.";
  return null;
}

/** The row a share inserts. Credits are the run's Comfy price in cents, rounded up, as everywhere else. */
export function shareRow(run: { url: string; kind: "image" | "video"; prompt: string; modelName: string; usd: number | null }, userId: string) {
  return { user_id: userId, kind: run.kind, url: run.url, prompt: run.prompt.trim().slice(0, 2000), model: run.modelName.slice(0, 80), credits: run.usd === null ? null : Math.max(0, Math.ceil(run.usd * 100 - 1e-9)) };
}

/** A profile row as the public may see it; links that don't check out are dropped again here, whatever is stored. */
export function toPublic(row: Record<string, unknown>): PublicProfile {
  const raw = row.links && typeof row.links === "object" ? (row.links as Record<string, unknown>) : {};
  const links: Profile["links"] = {};
  for (const s of SOCIALS) if (typeof raw[s.id] === "string") { const u = socialUrl(s.id as SocialId, raw[s.id] as string); if (u) links[s.id] = u; }
  if (typeof raw.website === "string") { const u = websiteUrl(raw.website); if (u) links.website = u; }
  const picture = typeof row.picture === "string" && isStoreUrl(row.picture) ? row.picture : null;
  return { userId: String(row.user_id ?? ""), handle: String(row.handle ?? ""), name: String(row.name ?? ""), picture, bio: String(row.bio ?? ""), links };
}

export function toPost(row: Record<string, unknown>): Post | null {
  const kind = row.kind === "video" ? "video" : row.kind === "image" ? "image" : null;
  const url = String(row.url ?? "");
  if (!kind || !isStoreUrl(url)) return null;
  const by = row.profiles && typeof row.profiles === "object" ? toPublic({ user_id: row.user_id, ...(row.profiles as Record<string, unknown>) }) : null;
  return { id: String(row.id), userId: String(row.user_id ?? ""), kind, url, prompt: String(row.prompt ?? ""), model: String(row.model ?? ""), credits: typeof row.credits === "number" ? row.credits : null, at: Date.parse(String(row.created_at ?? "")) || 0, by };
}

/** The public row for a saved profile, or null when it has no handle (and so can't be public). */
export function profileRow(p: Profile, userId: string): Record<string, unknown> | null {
  const c = cleanProfile(p);
  if (!c.handle) return null;
  return { user_id: userId, handle: c.handle, name: c.name, picture: c.picture && isStoreUrl(c.picture) ? c.picture : null, bio: c.bio, links: c.links, updated_at: new Date().toISOString() };
}

/** A database refusal, in words: the table not there yet, a handle someone else has, anything else. */
export function exploreMessage(error: { code?: string; message?: string } | null, fallback: string): string | null {
  if (!error) return null;
  if (error.code === "42P01" || /relation .* does not exist|schema cache/i.test(error.message ?? "")) return "Explore isn't switched on yet.";
  if (error.code === "23505" && /handle/.test(error.message ?? "")) return "That handle is taken. Try another.";
  if (error.code === "23505") return "You've already shared this.";
  return fallback;
}
