import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * "Pull my brand": reads a public web page and returns a name, a description, brand colours and a logo.
 * The address comes from a stranger (an advertiser), so it is never fetched unless it is a plain public http(s) site.
 */
export type BrandKit = { id: string; name: string; description: string; tone: string; colors: string[]; logo_url: string | null };

/** True for loopback, private, link-local and other addresses a public page must never resolve to. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = address.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

/** Cheap checks on the text of the address, before any network call. Returns the cleaned URL or null. */
export function cleanPublicUrl(input: unknown): URL | null {
  if (typeof input !== "string" || input.length > 300) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") && !isIP(host)) return null;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (isIP(host) && isPrivateAddress(host)) return null;
  return url;
}

const clean = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

function meta(html: string, ...names: string[]): string {
  for (const name of names) {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i").exec(html);
    const hit = a?.[1] ?? b?.[1];
    if (hit) return clean(hit);
  }
  return "";
}

/** Pure: builds the kit from page HTML. */
export function extractBrandKit(html: string, pageUrl: URL): BrandKit {
  const title = clean(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  const name = (meta(html, "og:site_name", "application-name") || title.split(/[|\-–—:]/)[0] || pageUrl.hostname.replace(/^www\./, "")).trim().slice(0, 60);
  const description = (meta(html, "og:description", "description") || "").slice(0, 280);
  const colors = [...new Set([meta(html, "theme-color", "msapplication-TileColor"), ...(html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).slice(0, 40)].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).map((c) => c.toLowerCase()))].slice(0, 4);
  let logo: string | null = null;
  const raw = meta(html, "og:image") || /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] || "";
  if (raw) {
    try {
      const u = new URL(raw, pageUrl);
      logo = u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      logo = null;
    }
  }
  const tone = /(playful|fun|friendly)/i.test(description) ? "playful" : /(luxury|premium|craft)/i.test(description) ? "premium" : "clear and direct";
  return { id: Buffer.from(pageUrl.hostname).toString("base64url").slice(0, 24), name, description, tone, colors, logo_url: logo };
}

/** Fetches the page (public sites only, short timeout, size cap, no redirects to private addresses) and extracts the kit. */
export async function fetchBrandKit(input: unknown, fetcher: typeof fetch = fetch, resolve: (host: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map((r) => r.address)): Promise<BrandKit | null> {
  let url = cleanPublicUrl(input);
  if (!url) return null;
  for (let hop = 0; hop < 3; hop++) {
    const addresses = isIP(url.hostname) ? [url.hostname] : await resolve(url.hostname).catch(() => []);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) return null;
    const res = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "StoryPopBrandKit/1.0" } }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      const next = cleanPublicUrl(new URL(res.headers.get("location") ?? "", url).toString());
      if (!next) return null;
      url = next;
      continue;
    }
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 500_000);
    return extractBrandKit(text, url);
  }
  return null;
}
