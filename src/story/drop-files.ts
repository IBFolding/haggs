/**
 * Checks files dragged in from the desktop before they reach an upload function.
 * Pure: it only looks at name, type and size, so it can be tested without a browser.
 */

export type DropKind = "image" | "video";
export type FileLike = { name: string; type: string; size: number };

const EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", bmp: "image/bmp", heic: "image/heic",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v", mkv: "video/x-matroska",
};

/** The type the browser reports, or one guessed from the extension when a desktop drop reports none. */
export function mimeOf(file: FileLike): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return EXT[ext] ?? "";
}

/** True when the drag carries files from outside the page, not an in-app drag such as an asset from the shelf. */
export function dragHasFiles(types: readonly string[] | undefined): boolean {
  return Array.from(types ?? []).includes("Files");
}

export type DropRules = {
  /** What this spot takes. Image-only spots reject video, so a clip cannot land where it makes no sense. */
  kinds: DropKind[];
  /** Narrow image types further, as the existing picker does (e.g. only png). Omit for any image. */
  mimes?: string[];
  multiple?: boolean;
  /** Same ceiling the upload client enforces. */
  maxBytes?: number;
};

export const MAX_DROP_BYTES = 300 * 1024 * 1024;

const WORDS: Record<DropKind, string> = { image: "an image", video: "a video" };

export function describeKinds(kinds: DropKind[]): string {
  return kinds.map((k) => WORDS[k]).join(" or ");
}

export type DropResult<T extends FileLike> = { accepted: T[]; error: string | null };

/** Splits a drop into the files this spot accepts and a plain-language reason when something was refused. */
export function checkDrop<T extends FileLike>(files: readonly T[], rules: DropRules): DropResult<T> {
  if (files.length === 0) return { accepted: [], error: null };
  const limit = rules.maxBytes ?? MAX_DROP_BYTES;
  const fits = (f: T) => {
    const mime = mimeOf(f);
    if (rules.mimes) return rules.mimes.includes(mime);
    return rules.kinds.some((k) => mime.startsWith(`${k}/`));
  };
  const right = files.filter(fits);
  if (right.length === 0) {
    const what = rules.mimes ? "a PNG, JPEG or WebP picture" : describeKinds(rules.kinds);
    return { accepted: [], error: `That file type does not fit here. Drop ${what}.` };
  }
  const small = right.filter((f) => f.size <= limit);
  if (small.length === 0) return { accepted: [], error: "Keep added files under 300 MB." };
  const accepted = rules.multiple ? small : small.slice(0, 1);
  const skipped = files.length - accepted.length;
  const error = skipped > 0 && (rules.multiple || files.length > 1)
    ? rules.multiple
      ? `${skipped} file${skipped === 1 ? " was" : "s were"} skipped: only ${describeKinds(rules.kinds)} files under 300 MB are added.`
      : `Only one file is added at a time; the first one was used.`
    : null;
  return { accepted, error };
}
