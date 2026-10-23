import { createProject, newShot, type Project } from "../story/model";

/**
 * Found footage: describe a film, find archive scenes that match in the
 * Internet Archive's Prelinger collection (public-domain stock footage, a free
 * public API with no key), keep the ones you pick, and put them on a board
 * ready to restyle into what you want and cut.
 */

export type Found = { id: string; title: string; year: string; about: string; thumb: string; page: string };
export type FoundFile = { name: string; url: string; bytes: number };

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "about", "that", "this", "is", "are", "it", "my", "i", "make", "film", "video", "scene", "scenes", "want", "show", "like"]);

/** Words worth searching on from a plain description: the nouns, not the filler. */
export function searchWords(description: string, max = 6): string[] {
  const seen = new Set<string>();
  for (const w of description.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
    if (!STOP.has(w)) seen.add(w.replace(/'s$/, ""));
  }
  return [...seen].slice(0, max);
}

/** The archive.org search for those words, inside Prelinger's films only. Quotes and operators are stripped so words can't change the query. */
export function searchUrl(words: string[], rows = 24, mode: "any" | "all" = "any"): string {
  const clean = words.map((w) => w.replace(/[^a-zA-Z0-9'-]/g, "")).filter(Boolean).slice(0, 8);
  if (!clean.length) throw new Error("Type a few words about what you need.");
  const q = `(${clean.join(mode === "all" ? " AND " : " OR ")}) AND collection:(prelinger) AND mediatype:(movies)`;
  // Best match first when every word must match; most-watched first when any will do.
  const params = new URLSearchParams({ q, rows: String(rows), page: "1", output: "json", ...(mode === "any" ? { sort: "downloads desc" } : {}) });
  for (const f of ["identifier", "title", "year", "description"]) params.append("fl[]", f);
  return `https://archive.org/advancedsearch.php?${params}`;
}

const text = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : "");

export function parseSearch(json: unknown): Found[] {
  const docs = (json as { response?: { docs?: Record<string, unknown>[] } })?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((d) => {
    const id = text(d.identifier);
    if (!/^[A-Za-z0-9._-]{2,120}$/.test(id)) return [];
    return [{ id, title: text(d.title).slice(0, 120) || id, year: text(d.year), about: text(d.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180), thumb: `https://archive.org/services/img/${id}`, page: `https://archive.org/details/${id}` }];
  });
}

const MAX_BYTES = 120 * 1024 * 1024;

/** The best MP4 to keep from an item's file list: a web-sized h.264 copy, not the huge original. */
export function pickFile(id: string, metadata: unknown): FoundFile | null {
  const files = (metadata as { files?: Record<string, unknown>[] })?.files;
  if (!Array.isArray(files)) return null;
  const rank = (f: Record<string, unknown>) => (/h\.?264/i.test(String(f.format)) ? 0 : /mpeg4/i.test(String(f.format)) ? 1 : 9);
  const ok = files
    .map((f) => ({ name: String(f.name ?? ""), bytes: Number(f.size) || 0, r: rank(f) }))
    .filter((f) => f.r < 9 && /\.mp4$/i.test(f.name) && f.bytes > 0 && f.bytes <= MAX_BYTES && !f.name.includes("/"))
    .sort((a, b) => a.r - b.r || a.bytes - b.bytes);
  const best = ok[0];
  return best ? { name: best.name, bytes: best.bytes, url: `https://archive.org/download/${id}/${encodeURIComponent(best.name)}` } : null;
}

export type Pick = { found: Found; localUrl: string; seconds: number };

/** The picks as a board, one shot each, each with where it came from kept in plain sight. */
export function foundBoard(name: string, brief: string, picks: Pick[]): Project {
  if (!picks.length) throw new Error("Pick at least one scene.");
  const base = createProject(name);
  const board = {
    id: crypto.randomUUID(),
    name: "Found footage",
    kind: "reel" as const,
    notes: [],
    shots: picks.map((p) => ({
      ...newShot(),
      heading: p.found.title,
      beat: `${p.found.title}${p.found.year ? ` (${p.found.year})` : ""}. Archive footage from the Prelinger Archives, ${p.found.page}.${brief.trim() ? ` For: ${brief.trim().slice(0, 200)}` : ""}`,
      seconds: Math.min(15, Math.max(1, Math.round(p.seconds * 10) / 10)),
      render: { url: p.localUrl, kind: "video" as const, usd: 0, promptHash: "", at: Date.now() },
    })),
  };
  return { ...base, boards: [board], source: { templateId: "found-footage", name } };
}
