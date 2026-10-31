/** Names for the pictures and clips a kinetic film uses, and the small helpers around them. */
import type { Timeline } from "./beats";

export const slugName = (file: string): string => {
  const base = file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return base || "media";
};

export function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  for (let n = 2; ; n++) if (!taken.includes(`${name}-${n}`)) return `${name}-${n}`;
}

export const kindOf = (mime: string): "image" | "clip" | null => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "clip" : null);

/** A repeated clip occurrence needs its own playback position during transitions. */
export const occurrenceKey = (index: number, name: string) => `${index}:${name}`;

export function scopeClipOccurrences<T, C extends T>(
  timeline: Timeline,
  media: Record<string, { el: T; width: number; height: number }>,
  clips: Record<string, C>,
  clone: (clip: C) => C,
) {
  const scopedMedia = { ...media }, scopedClips = { ...clips }, seen = new Set<string>();
  for (const [index, item] of timeline.items.entries()) {
    const b = item.block;
    if (b.kind !== "clip") continue;
    const source = clips[b.name];
    if (source && seen.has(b.name)) {
      const key = occurrenceKey(index, b.name), copy = clone(source), base = media[b.name];
      scopedClips[key] = copy;
      if (base) scopedMedia[key] = { ...base, el: copy };
    }
    seen.add(b.name);
  }
  return { media: scopedMedia, clips: scopedClips };
}

/** Adds a line to the end of the sheet. */
export const insertLine = (sheet: string, line: string): string => `${sheet.replace(/\s+$/, "")}${sheet.trim() ? "\n" : ""}${line}\n`;
