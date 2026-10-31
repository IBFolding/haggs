/** Names for the pictures and clips a kinetic film uses, and the small helpers around them. */

export const slugName = (file: string): string => {
  const base = file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return base || "media";
};

export function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  for (let n = 2; ; n++) if (!taken.includes(`${name}-${n}`)) return `${name}-${n}`;
}

export const kindOf = (mime: string): "image" | "clip" | null => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "clip" : null);

/** Adds a line to the end of the sheet. */
export const insertLine = (sheet: string, line: string): string => `${sheet.replace(/\s+$/, "")}${sheet.trim() ? "\n" : ""}${line}\n`;
