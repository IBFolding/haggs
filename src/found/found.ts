import { createProject, newShot, type Project } from "../story/model";

/**
 * Found footage: describe a film, find archive scenes that match in the
 * Internet Archive's Prelinger collection (public-domain stock footage, a free
 * public API with no key), keep the ones you pick, and put them on a board
 * ready to restyle into what you want and cut.
 */

export type Found = { id: string; title: string; year: string; about: string; tags: string; thumb: string; page: string };
export type FoundFile = { name: string; url: string; bytes: number };

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "about", "that", "this", "is", "are", "it", "my", "i", "make", "film", "video", "scene", "scenes", "want", "show", "like", "favorite", "favourite", "best", "top", "ten", "five", "three", "great", "good", "nice", "some", "little", "really", "just", "things", "stuff", "footage", "clip", "clips", "movie", "movies", "films", "story", "making", "have", "has", "was", "were", "has", "all", "any", "from", "would", "could", "should", "please"]);

/** Words worth searching on from a plain description: the nouns, not the filler. */
export function searchWords(description: string, max = 6): string[] {
  const seen = new Set<string>();
  for (const w of description.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
    if (!STOP.has(w)) seen.add(w.replace(/'s$/, ""));
  }
  return [...seen].slice(0, max);
}

/** The archive.org search for those words, inside Prelinger's films only. Quotes and operators are stripped so words can't change the query. */
export function searchUrl(words: string[], rows = 24, mode: "any" | "all" | "title" = "any"): string {
  const clean = words.map((w) => w.replace(/[^a-zA-Z0-9'-]/g, "")).filter(Boolean).slice(0, 8);
  if (!clean.length) throw new Error("Type a few words about what you need.");
  const list = clean.join(mode === "all" ? " AND " : " OR ");
  const q = `(${mode === "title" ? `title:(${list})` : list}) AND collection:(prelinger) AND mediatype:(movies)`;
  // Best match first when every word must match; most-watched first when any will do.
  const params = new URLSearchParams({ q, rows: String(rows), page: "1", output: "json", ...(mode === "any" ? { sort: "downloads desc" } : {}) });
  for (const f of ["identifier", "title", "year", "description", "subject"]) params.append("fl[]", f);
  return `https://archive.org/advancedsearch.php?${params}`;
}

const text = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : "");

export function parseSearch(json: unknown): Found[] {
  const docs = (json as { response?: { docs?: Record<string, unknown>[] } })?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((d) => {
    const id = text(d.identifier);
    if (!/^[A-Za-z0-9._-]{2,120}$/.test(id)) return [];
    return [{ id, title: text(d.title).slice(0, 120) || id, year: text(d.year), about: text(d.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180), tags: (Array.isArray(d.subject) ? d.subject.join(" ") : typeof d.subject === "string" ? d.subject : "").slice(0, 300), thumb: `https://archive.org/services/img/${id}`, page: `https://archive.org/details/${id}` }];
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


/** A word and the forms it might take in an old film's title: cars and car, boxes and box, cities and city. */
export function variants(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set([w]);
  if (/ies$/.test(w) && w.length > 4) out.add(w.slice(0, -3) + "y");
  else if (/(ses|xes|ches|shes)$/.test(w)) out.add(w.slice(0, -2));
  else if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) out.add(w.slice(0, -1));
  else if (w.length > 2 && !/ss$/.test(w)) { out.add(w + "s"); if (/y$/.test(w)) out.add(w.slice(0, -1) + "ies"); }
  return [...out];
}

/** Every searched word with its other forms, as one flat list of clean words. */
export const expandWords = (words: string[]): string[] => [...new Set(words.flatMap(variants))].slice(0, 12);

const has = (hay: string, w: string) => new RegExp(`(^|[^a-z])${w.replace(/[^a-z0-9]/gi, "")}($|[^a-z])`, "i").test(hay);

/**
 * How well a scene fits what you asked for: a word in the title counts most, in its subjects
 * next, in its description least, and a scene that has every word you gave beats one that
 * has a few. Without this the archive hands back whatever is most watched.
 */
export function fitOf(f: Found, words: string[]): number {
  let matched = 0, score = 0;
  for (const w of words) {
    const forms = variants(w);
    const t = forms.some((x) => has(f.title, x)), g = forms.some((x) => has(f.tags, x)), d = forms.some((x) => has(f.about, x));
    if (t || g || d) matched += 1;
    score += (t ? 3 : 0) + (g ? 2 : 0) + (d ? 1 : 0);
  }
  return score + (words.length > 1 && matched === words.length ? 4 : 0) + matched;
}

/** Best fit first, stable among equals (the archive's own order), and nothing that matches none of the words. */
export function rankFound(list: Found[], words: string[]): Found[] {
  return list
    .map((f, i) => ({ f, i, s: fitOf(f, words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

/** Add downloaded archive shots once to the explicitly chosen edit. */
export function appendFound(project: Project, boardId: string, imported: Project): Project {
  if (!project.boards?.some((b) => b.id === boardId)) throw new Error("That edit is no longer available.");
  const sourcePage = (beat: string) => /https:\/\/archive\.org\/details\/[A-Za-z0-9._-]+/.exec(beat)?.[0]?.replace(/\.$/, "");
  return { ...project, boards: project.boards.map((board) => {
    if (board.id !== boardId) return board;
    const seen = new Set(board.shots.map((s) => sourcePage(s.beat)).filter(Boolean));
    const added = (imported.boards?.[0]?.shots ?? []).filter((shot) => {
      const page = sourcePage(shot.beat);
      if (page && seen.has(page)) return false;
      if (page) seen.add(page);
      return true;
    });
    return { ...board, shots: [...board.shots, ...added] };
  }) };
}
