/**
 * A person's profile: the name and handle they go by, a picture, a line about them, and where to find them.
 * Kept with their sign-in for now, so it is private to them until community pages open; nothing here is shown
 * to anyone else yet.
 */

export const SOCIALS = [
  { id: "instagram", label: "Instagram", host: "instagram.com", path: (h: string) => `https://instagram.com/${h}` },
  { id: "tiktok", label: "TikTok", host: "tiktok.com", path: (h: string) => `https://tiktok.com/@${h}` },
  { id: "youtube", label: "YouTube", host: "youtube.com", path: (h: string) => `https://youtube.com/@${h}` },
  { id: "x", label: "X", host: "x.com", path: (h: string) => `https://x.com/${h}` },
] as const;
export type SocialId = (typeof SOCIALS)[number]["id"];

export type Profile = { name: string; handle: string; picture: string | null; bio: string; links: Partial<Record<SocialId | "website", string>> };
export const EMPTY_PROFILE: Profile = { name: "", handle: "", picture: null, bio: "", links: {} };

const HOSTS: Record<SocialId, string[]> = { instagram: ["instagram.com"], tiktok: ["tiktok.com"], youtube: ["youtube.com", "youtu.be"], x: ["x.com", "twitter.com"] };

/** A handle: letters, numbers, dots and underscores, 2 to 30, no leading @. Empty when there is nothing usable. */
export function cleanHandle(raw: string): string {
  const h = raw.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
  return h.length >= 2 ? h : "";
}

/**
 * Where a social link really goes, from "@name", "name" or a full link on that site. A link to any other site is
 * refused (null), so a profile can only point to the network it says.
 */
export function socialUrl(id: SocialId, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) {
    try {
      const u = new URL(/^https?:/i.test(v) ? v : `https://${v}`);
      const host = u.hostname.replace(/^(www\.|m\.)/, "").toLowerCase();
      if (!HOSTS[id].includes(host)) return null;
      return `https://${host}${u.pathname.replace(/\/+$/, "")}`;
    } catch { return null; }
  }
  const h = v.replace(/^@+/, "");
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(h)) return null;
  return SOCIALS.find((s) => s.id === id)!.path(h);
}

/** A website: https only, or turned into https when no scheme is given. */
export function websiteUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z]+:/i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/\./.test(u.hostname)) return null;
    u.protocol = "https:";
    return u.toString().replace(/\/$/, "");
  } catch { return null; }
}

/** A profile ready to keep: trimmed, limited, the handle cleaned and every link checked. Bad links are dropped. */
export function cleanProfile(p: Profile): Profile {
  const links: Profile["links"] = {};
  for (const s of SOCIALS) { const url = p.links[s.id] ? socialUrl(s.id, p.links[s.id]!) : null; if (url) links[s.id] = url; }
  const site = p.links.website ? websiteUrl(p.links.website) : null;
  if (site) links.website = site;
  return { name: p.name.trim().slice(0, 60), handle: cleanHandle(p.handle), picture: p.picture && /^https?:\/\//.test(p.picture) ? p.picture : p.picture?.startsWith("/") ? p.picture : null, bio: p.bio.trim().slice(0, 200), links };
}

/** A profile read back from storage, tolerant of anything missing. */
export function readProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Profile>;
  return { name: typeof r.name === "string" ? r.name : "", handle: typeof r.handle === "string" ? r.handle : "", picture: typeof r.picture === "string" ? r.picture : null, bio: typeof r.bio === "string" ? r.bio : "", links: r.links && typeof r.links === "object" ? (r.links as Profile["links"]) : {} };
}
