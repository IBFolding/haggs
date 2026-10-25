import { join } from "node:path";

import { isBlobUrl } from "./blob";
import { isFx } from "../story/fx";
import { captionFilter, clipFilters, overlayFilter, mixFilter, frameOf, type Cut } from "../story/cut";

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
  /** Draws a caption as a transparent frame-sized PNG; without it captions are left out. */
  caption?: (path: string, text: string, size: { w: number; h: number }) => Promise<void>;
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
  const mix = mixFilter(cut);
  const sounds = (mix?.inputs ?? []).map(file);

  const parts: string[] = [];
  for (const { clip, src } of clips) {
    const dest = join(o.work, `clip-${String(clip.index + 1).padStart(3, "0")}.mp4`);
    const silence = ["-f", "lavfi", "-t", String(clip.seconds), "-i", "anullsrc=r=48000:cl=stereo"];
    const fade = clipFilters(cut.aspect, clip);
    const vf = fade.v;
    if (clip.kind === "image") {
      await o.ffmpeg([...QUIET, "-loop", "1", "-t", String(clip.seconds), "-i", src, ...silence, "-vf", vf, "-c:v", "libx264", "-c:a", "aac", "-shortest", dest]);
    } else {
      const seek = clip.from > 0 ? ["-ss", String(clip.from)] : [];
      const sound = await o.hasAudio(src);
      await o.ffmpeg([...QUIET, ...seek, "-i", src, ...(sound ? [] : silence), "-t", String(clip.seconds), "-vf", vf, ...(sound ? ["-af", `aresample=48000,apad${fade.a ? `,${fade.a}` : ""}`, "-ar", "48000", "-ac", "2"] : []), "-c:v", "libx264", "-c:a", "aac", "-shortest", dest]);
    }
    parts.push(dest);
  }

  const list = join(o.work, "list.txt");
  const picture = join(o.work, "picture.mp4");
  const name_ = `${slug(name)}-${o.stamp}.mp4`;
  const out = join(o.root, "haggs-renders", name_);
  // With a loudness target, every stage writes to a scratch file and one last pass levels it into the final one.
  const pre = cut.loudness ? join(o.work, "prenorm.mp4") : out;
  await o.write(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const caps = o.caption ? captionFilter(cut) : null;
  const titles = overlayFilter(cut);
  const titleFiles = titles ? titles.inputs.map(file) : [];
  const afterCaps = titles ? join(o.work, "captioned.mp4") : mix ? picture : pre;
  const joined = caps ? join(o.work, "joined.mp4") : titles ? afterCaps : mix ? picture : pre;
  await o.ffmpeg([...QUIET, "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  if (caps) {
    const size = frameOf(cut.aspect);
    const pngs: string[] = [];
    for (const [i, c] of caps.captions.entries()) {
      const png = join(o.work, `caption-${i}.png`);
      await o.caption!(png, c.text, size);
      pngs.push(png);
    }
    await o.ffmpeg([...QUIET, "-i", joined, ...pngs.flatMap((p) => ["-i", p]), "-filter_complex", caps.filter, "-map", "[out]", "-map", "0:a", "-c:v", "libx264", "-crf", "16", "-c:a", "copy", afterCaps]);
  }
  if (titles) {
    const src = caps ? afterCaps : joined;
    await o.ffmpeg([...QUIET, "-i", src, ...titleFiles.flatMap((p) => ["-i", p]), "-filter_complex", titles.filter, "-map", "[out]", "-map", "0:a", "-c:v", "libx264", "-crf", "16", "-c:a", "copy", mix ? picture : pre]);
  }
  if (mix) {
    await o.ffmpeg([...QUIET, "-i", picture, ...sounds.flatMap((s) => ["-i", s]), "-filter_complex", mix.filter, "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", pre]);
  }
  if (cut.loudness) {
    await o.ffmpeg([...QUIET, "-i", pre, "-c:v", "copy", "-af", `loudnorm=I=${cut.loudness}:TP=-1.5:LRA=11`, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out]);
  }
  return { url: `/api/local/haggs-renders/${encodeURIComponent(name_)}`, path: out };
}

const num = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error("The cut has a time or level out of range.");
  return v;
};
const link = (v: unknown): string => {
  if (typeof v !== "string" || !(v.startsWith("/api/local/") || isBlobUrl(v)) || v.length > 600) throw new Error("Only media on this machine, or in this app's store, can be rendered here.");
  return v;
};

const unit = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

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
    ...(typeof x.caption === "string" && x.caption.trim() ? { caption: x.caption.trim().slice(0, 140) } : {}),
    ...(typeof x.caption === "string" && x.caption.trim() && Number.isFinite(x.captionAt) && Number(x.captionAt) > 0 ? { captionAt: Math.min(Number(x.captionAt), 7200) } : {}),
    ...(typeof x.caption === "string" && x.caption.trim() && Number.isFinite(x.captionFor) && Number(x.captionFor) > 0 ? { captionFor: Math.min(Number(x.captionFor), 7200) } : {}),
    ...(x.fit === "fill" ? { fit: "fill" as const, ...(x.focus && typeof x.focus === "object" ? { focus: { x: unit((x.focus as { x?: unknown }).x), y: unit((x.focus as { y?: unknown }).y) } } : {}) } : {}),
    ...(typeof x.fadeIn === "number" && x.fadeIn > 0 && x.fadeIn <= 10 ? { fadeIn: x.fadeIn } : {}),
    ...(typeof x.fadeOut === "number" && x.fadeOut > 0 && x.fadeOut <= 10 ? { fadeOut: x.fadeOut } : {}),
    ...(isFx(x.fx) ? { fx: x.fx } : {}),
  }));
  const voices = (Array.isArray(c.voices) ? c.voices : []).slice(0, 200).map((v) => ({ shotId: String(v.shotId), id: String(v.id), url: link(v.url), text: String(v.text ?? "").slice(0, 200), start: num(v.start, 0, 7200), gain: num(v.gain ?? 0, -40, 20) }));
  const music = c.music ? { url: link(c.music.url), name: String(c.music.name ?? "").slice(0, 120), gain: num(c.music.gain ?? 0, -40, 20) } : null;
  const effects = (Array.isArray((c as { effects?: unknown[] }).effects) ? (c as { effects: Record<string, unknown>[] }).effects : []).slice(0, 100).map((e) => ({ id: String(e.id ?? ""), name: String(e.name ?? "").slice(0, 80), url: link(e.url), start: num(e.start, 0, 7200), gain: num(e.gain ?? 0, -40, 20), seconds: num(e.seconds ?? 1, 0, 600) }));
  const mix = (c as { sound?: Record<string, unknown> }).sound;
  const level = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  const sound = mix && typeof mix === "object"
    ? Object.fromEntries(Object.entries({ room: level(mix.room, 0, 1), warmth: level(mix.warmth, -6, 6), clarity: level(mix.clarity, -6, 6), squeeze: level(mix.squeeze, 0, 1), duck: level(mix.duck, 0, 1), voiceGain: level(mix.voiceGain, -30, 12), fxGain: level(mix.fxGain, -30, 12), clipGain: level(mix.clipGain, -40, 12), ...(mix.loud === true ? { loud: true } : {}), ...(mix.voiceMute === true ? { voiceMute: true } : {}), ...(mix.fxMute === true ? { fxMute: true } : {}), ...(mix.musicMute === true ? { musicMute: true } : {}), ...(mix.clipMute === true ? { clipMute: true } : {}) }).filter(([, v]) => v !== undefined))
    : undefined;
  const overlays = (Array.isArray((c as { overlays?: unknown[] }).overlays) ? (c as { overlays: Record<string, unknown>[] }).overlays : []).slice(0, 50).map((e) => ({ id: String(e.id ?? ""), name: String(e.name ?? "").slice(0, 80), url: link(e.url), start: num(e.start, 0, 7200), seconds: num(e.seconds ?? 3, 0.1, 600) }));
  // A render on a deployment has five minutes and a small disk: nothing longer than ten minutes of film, and no more than a hundred clips.
  if (process.env.BLOB_READ_WRITE_TOKEN && (clips.length > 100 || Number(c.total) > 600)) throw new Error("A cut longer than ten minutes, or with over a hundred clips, can't be rendered here. Cut it down, or render on your own machine.");
  const loudness = typeof (c as { loudness?: unknown }).loudness === "number" && Number.isFinite((c as { loudness: number }).loudness) && (c as { loudness: number }).loudness >= -24 && (c as { loudness: number }).loudness <= -9 ? (c as { loudness: number }).loudness : undefined;
  return { clips, total: num(c.total, 0.1, 7200), skipped: [], voices, music, ...(loudness !== undefined ? { loudness } : {}), ...(overlays.length ? { overlays } : {}), ...(effects.length ? { effects } : {}), ...(sound && Object.keys(sound).length ? { sound } : {}), aspect: c.aspect === "9:16" ? "9:16" : "16:9" };
}
