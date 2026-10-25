/**
 * Finding where the subject of a shot is, so a tall crop keeps it in frame.
 * Claude looks at one small picture per shot and answers with a point; these
 * are the checks on what goes out and the reading of what comes back.
 */

export type Frame = { id: string; jpeg: string };
export type Point = { x: number; y: number };

export const MAX_FRAMES = 8;
const MAX_BYTES = 450_000;

/** Why these pictures can't be sent, or null if they can. */
export function checkFrames(frames: Frame[]): string | null {
  if (!Array.isArray(frames) || frames.length === 0) return "There is nothing to look at.";
  if (frames.length > MAX_FRAMES) return `Send at most ${MAX_FRAMES} pictures at a time.`;
  for (const f of frames) {
    if (typeof f?.id !== "string" || typeof f?.jpeg !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f.jpeg)) return "One of the pictures isn't a JPEG.";
    if (f.jpeg.length > MAX_BYTES) return "One of the pictures is too big. Send it smaller.";
  }
  return null;
}

const unit = (n: number) => Math.min(1, Math.max(0, n));

/** Reads Claude's answer, a JSON list of {i, x, y}, into a point per picture id. Anything it can't read is left out. */
export function parseFocus(text: string, ids: string[]): Record<string, Point> {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return {};
  let list: unknown;
  try {
    list = JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }
  if (!Array.isArray(list)) return {};
  const out: Record<string, Point> = {};
  for (const item of list) {
    const row = item as { i?: unknown; x?: unknown; y?: unknown };
    if (typeof row?.i !== "number" || typeof row.x !== "number" || typeof row.y !== "number") continue;
    const id = ids[row.i];
    if (id !== undefined && Number.isFinite(row.x) && Number.isFinite(row.y)) out[id] = { x: unit(row.x), y: unit(row.y) };
  }
  return out;
}
