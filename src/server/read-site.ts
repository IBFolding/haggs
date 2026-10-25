import { brandFromHtml, type BrandKit } from "../brand/brand";
import { mayFetchForKeeping } from "./keep-url";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type SiteRead = { ok: true; kit: Omit<BrandKit, "id" | "createdAt" | "updatedAt"> } | { ok: false; reason: string };

const LIMIT = 1_500_000;

/** Reads a company's page and works out its brand. Only outside https addresses are fetched; the page is read up to 1.5 MB. */
export async function readSite(address: string, fetcher: Fetcher = fetch): Promise<SiteRead> {
  const typed = address.trim();
  if (!typed) return { ok: false, reason: "Type the company's web address." };
  const link = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  if (!mayFetchForKeeping(link)) return { ok: false, reason: "Use the public https address of the company's site." };
  try {
    const res = await fetcher(link, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "Mozilla/5.0 (compatible; haggs brand reader)", accept: "text/html" } });
    if (!res.ok) return { ok: false, reason: "That page couldn't be opened." };
    // A redirect must not lead somewhere we would not have gone.
    if (res.url && !mayFetchForKeeping(res.url)) return { ok: false, reason: "That page couldn't be opened." };
    if (!/html/i.test(res.headers.get("content-type") ?? "")) return { ok: false, reason: "That address isn't a web page." };
    const html = (await res.text()).slice(0, LIMIT);
    const base = new URL(res.url || link).toString();
    return { ok: true, kit: brandFromHtml(html + (await styles(html, base, fetcher)), base) };
  } catch {
    return { ok: false, reason: "That page couldn't be opened." };
  }
}

/** The text of the page's first few linked stylesheets, as a <style> block, so the palette and fonts come from the real design. */
async function styles(html: string, base: string, fetcher: Fetcher): Promise<string> {
  const hrefs: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    try {
      const u = new URL(/href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? "", base).toString();
      if (mayFetchForKeeping(u) && !hrefs.includes(u)) hrefs.push(u);
    } catch {
      // A broken link is skipped.
    }
  }
  const sheets = await Promise.all(hrefs.slice(0, 3).map(async (u) => {
    try {
      const r = await fetcher(u, { redirect: "follow", signal: AbortSignal.timeout(6_000) });
      return r.ok && (!r.url || mayFetchForKeeping(r.url)) ? (await r.text()).slice(0, 600_000) : "";
    } catch {
      return "";
    }
  }));
  return sheets.map((c) => `<style>${c}</style>`).join("\n");
}
