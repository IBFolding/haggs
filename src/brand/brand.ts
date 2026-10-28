import type { Kv } from "../story/kv";

/**
 * A brand kit: the name, logo, colours, fonts and tone of a company, read from its website
 * (or typed in), so every ad made for it looks like it belongs to the same company.
 */

export type BrandKit = { id: string; name: string; url: string; logo: string | null; colors: string[]; fonts: string[]; about: string; tone: string; createdAt: number; updatedAt: number };
export type NewBrandKit = Omit<BrandKit, "id" | "createdAt" | "updatedAt"> & Partial<Pick<BrandKit, "id" | "createdAt">>;

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
const plain = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => entities[m] ?? m).replace(/\s+/g, " ").trim();

const meta = (html: string, key: string): string => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (k === key) return plain(/content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
  }
  return "";
};

const absolute = (href: string | undefined, base: string): string | null => {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** A colour that carries a brand: not white, black or a grey. */
function chromatic(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(r, g, b) - Math.min(r, g, b) > 24;
}

const expand = (h: string) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toLowerCase();

function palette(html: string): string[] {
  const count = new Map<string, number>();
  const bump = (hex: string, by: number) => count.set(hex, (count.get(hex) ?? 0) + by);
  const theme = meta(html, "theme-color");
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(theme)) bump(expand(theme), 5);
  const css = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []).join(" ") + " " + (html.match(/style\s*=\s*"[^"]*"/gi) ?? []).join(" ");
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) bump(expand(`#${m[1]}`), 1);
  // The page's own background is part of the look even when it is pale.
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const brand = ranked.filter(chromatic);
  const pale = ranked.filter((h) => !chromatic(h) && h !== "#ffffff" && h !== "#000000" && /^#[ef]/.test(h));
  return [...brand, ...pale.filter((h) => !brand.includes(h))].slice(0, 5);
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit", "initial", "ui-sans-serif", "ui-serif", "-apple-system", "blinkmacsystemfont", "segoe ui", "arial", "helvetica", "helvetica neue", "georgia", "times new roman", "roboto", "sans"]);

function fontsOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/font-family\s*:\s*([^;}"]+)/gi)) {
    for (const part of m[1]!.split(",")) {
      const name = part.replace(/!important/g, "").replace(/["']/g, "").trim();
      if (name && !GENERIC.has(name.toLowerCase()) && !out.includes(name)) out.push(name);
    }
  }
  return out.slice(0, 3);
}

function logoOf(html: string, base: string): string | null {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (/logo/i.test(tag)) {
      const src = absolute(/\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1], base);
      if (src) return src;
    }
  }
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const rel of ["apple-touch-icon", "icon"]) {
    for (const tag of links) {
      if (new RegExp(`rel\\s*=\\s*["'][^"']*\\b${rel}\\b`, "i").test(tag)) {
        const href = absolute(/href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1], base);
        if (href) return href;
      }
    }
  }
  return null;
}

/** What a company's page says about its look. The result is a starting point to correct, not the last word. */
export function brandFromHtml(html: string, pageUrl: string): Omit<BrandKit, "id" | "createdAt" | "updatedAt"> {
  const host = (() => { try { return new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const title = plain(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const name = meta(html, "og:site_name") || title.split(/\s[|\-–—]\s/)[0]?.trim() || host || "Brand";
  return {
    name: name.slice(0, 60),
    url: pageUrl,
    logo: logoOf(html, pageUrl),
    colors: palette(html),
    fonts: fontsOf(html),
    about: (meta(html, "og:description") || meta(html, "description")).slice(0, 300),
    tone: "",
  };
}

/** The brand as words a picture model can follow. */
export function brandWords(kit: Pick<BrandKit, "name" | "colors" | "fonts" | "tone" | "about">): string {
  return [
    `Brand: ${kit.name.trim().replace(/[.\s]+$/, "")}.`,
    kit.about ? `${kit.about.replace(/[.\s]+$/, "")}.` : "",
    kit.tone ? `Tone: ${kit.tone}.` : "",
    kit.colors.length ? `Brand colours: ${kit.colors.join(", ")}.` : "",
    kit.fonts.length ? `Typography feels like ${kit.fonts.join(" and ")}.` : "",
  ].filter(Boolean).join(" ");
}

const INDEX = "brands/index";
const key = (id: string) => `brands/${id}`;

export function createBrandStore(kv: Kv) {
  return {
    async list(): Promise<BrandKit[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<BrandKit>(key(id))))).filter((k): k is BrandKit => Boolean(k)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async save(input: NewBrandKit): Promise<BrandKit> {
      const name = input.name.trim();
      if (!name) throw new Error("Give the brand a name.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<BrandKit>(key(i))))).map((x) => x?.updatedAt ?? 0));
      const now = Date.now();
      const saved: BrandKit = { ...input, name: name.slice(0, 60), colors: input.colors.slice(0, 5), fonts: input.fonts.slice(0, 3), about: input.about.slice(0, 300), tone: input.tone.slice(0, 120), id: input.id ?? crypto.randomUUID(), createdAt: input.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
      await kv.set(key(saved.id), saved);
      if (!ids.includes(saved.id)) await kv.set(INDEX, [...ids, saved.id]);
      return saved;
    },
    async remove(id: string) {
      await kv.remove(key(id));
      await kv.set(INDEX, ((await kv.get<string[]>(INDEX)) ?? []).filter((x) => x !== id));
    },
  };
}
