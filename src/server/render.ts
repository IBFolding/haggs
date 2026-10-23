import { join } from "node:path";

import { mixFilter, normFilter, type Cut } from "../story/cut";

/**
 * Renders a cut to an MP4 on this machine: the same steps as the exported
 * ffmpeg script, run directly on the files in the local media folder, so
 * nothing is downloaded. Development only — it needs ffmpeg and the folder.
 *
 * Every clip is normalised to 1920×1080 at 30fps with stereo sound (a still
 * or a silent take gets silence), the clips are joined, and the voices and
 * soundtrack are mixed over the joined picture.
 */

export type RenderOptions = {
  /** The local media folder (HAGGS_LOCAL_MEDIA). */
  root: string;
  /** A scratch folder for the normalised clips. */
  work: string;
  /** Goes in the file name, so renders never overwrite each other. */
  stamp: string;
  ffmpeg: (args: string[]) => Promise<void>;
  hasAudio: (path: string) => Promise<boolean>;
  write: (path: string, text: string) => Promise<void>;
};

const QUIET = ["-loglevel", "error", "-y"];

/** The path in the media folder behind a /api/local/… link, or null for anything else. */
export function localPath(root: string, url: string): string | null {
  if (!url.startsWith("/api/local/")) return null;
  const segments = url.slice("/api/local/".length).split("/").map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return "";
    }
  });
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))) return null;
  return join(root, ...segments);
}

const slug = (name: string) => name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "cut";

export async function renderCut(cut: Cut, name: string, o: RenderOptions): Promise<{ url: string; path: string }> {
  if (!cut.clips.length) throw new Error("There is nothing to render yet. Shoot at least one shot first.");
  const file = (url: string) => {
    const path = localPath(o.root, url);
    if (!path) throw new Error("Only media on this machine can be rendered here. Use the ffmpeg script for media on the web.");
    return path;
  };
  // Resolve everything first, so a bad link stops the render before any work is done.
  const clips = cut.clips.map((clip) => ({ clip, src: file(clip.url) }));
  const NORM = normFilter(cut.aspect);
  const mix = mixFilter(cut);
  const sounds = (mix?.inputs ?? []).map(file);

  const parts: string[] = [];
  for (const { clip, src } of clips) {
    const dest = join(o.work, `clip-${String(clip.index + 1).padStart(3, "0")}.mp4`);
    const silence = ["-f", "lavfi", "-t", String(clip.seconds), "-i", "anullsrc=r=48000:cl=stereo"];
    if (clip.kind === "image") {
      await o.ffmpeg([...QUIET, "-loop", "1", "-t", String(clip.seconds), "-i", src, ...silence, "-vf", NORM, "-c:v", "libx264", "-c:a", "aac", "-shortest", dest]);
    } else {
      const seek = clip.from > 0 ? ["-ss", String(clip.from)] : [];
      const sound = await o.hasAudio(src);
      await o.ffmpeg([...QUIET, ...seek, "-i", src, ...(sound ? [] : silence), "-t", String(clip.seconds), "-vf", NORM, ...(sound ? ["-af", "aresample=48000,apad", "-ar", "48000", "-ac", "2"] : []), "-c:v", "libx264", "-c:a", "aac", "-shortest", dest]);
    }
    parts.push(dest);
  }

  const list = join(o.work, "list.txt");
  const picture = join(o.work, "picture.mp4");
  const name_ = `${slug(name)}-${o.stamp}.mp4`;
  const out = join(o.root, "haggs-renders", name_);
  await o.write(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  await o.ffmpeg([...QUIET, "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", mix ? picture : out]);
  if (mix) {
    await o.ffmpeg([...QUIET, "-i", picture, ...sounds.flatMap((s) => ["-i", s]), "-filter_complex", mix.filter, "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out]);
  }
  return { url: `/api/local/haggs-renders/${encodeURIComponent(name_)}`, path: out };
}

const num = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error("The cut has a time or level out of range.");
  return v;
};
const link = (v: unknown): string => {
  if (typeof v !== "string" || !v.startsWith("/api/local/") || v.length > 600) throw new Error("Only media on this machine can be rendered here.");
  return v;
};

/** A cut sent from the browser, rebuilt from checked fields only: every number in the filter graph is a real number. */
export function checkCut(raw: unknown): Cut {
  const c = raw as Partial<Cut> | null;
  if (!c || !Array.isArray(c.clips) || !c.clips.length || c.clips.length > 400) throw new Error("There is nothing to render yet.");
  const clips = c.clips.map((x, i) => ({
    shotId: String(x.shotId ?? i),
    index: i,
    heading: String(x.heading ?? "").slice(0, 200),
    url: link(x.url),
    kind: x.kind === "video" ? ("video" as const) : ("image" as const),
    start: num(x.start, 0, 7200),
    from: num(x.from ?? 0, 0, 600),
    seconds: num(x.seconds, 0.1, 600),
  }));
  const voices = (Array.isArray(c.voices) ? c.voices : []).slice(0, 200).map((v) => ({ shotId: String(v.shotId), id: String(v.id), url: link(v.url), text: String(v.text ?? "").slice(0, 200), start: num(v.start, 0, 7200), gain: num(v.gain ?? 0, -40, 20) }));
  const music = c.music ? { url: link(c.music.url), name: String(c.music.name ?? "").slice(0, 120), gain: num(c.music.gain ?? 0, -40, 20) } : null;
  return { clips, total: num(c.total, 0.1, 7200), skipped: [], voices, music, aspect: c.aspect === "9:16" ? "9:16" : "16:9" };
}
