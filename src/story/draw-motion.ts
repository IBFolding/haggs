/**
 * Draw to video: arrows sketched on a picture become a plain-language motion
 * prompt for an image-to-video model. A subject arrow says what moves and which
 * way; a camera arrow moves the camera. Positions are fractions of the picture
 * (0 to 1, y down), so the same sketch works at any size.
 */

export type Pt = { x: number; y: number };
export type Mark = { id: string; kind: "subject" | "camera"; from: Pt; to: Pt; note: string };

export const MAX_MARKS = 8;
const TOO_SHORT = 0.08;
const SMALL = 0.22;
const FAR = 0.5;
const NOTE_MAX = 40;

const third = (v: number) => (v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2);

/** "the upper left", "the middle", "the bottom": which part of the picture a spot is in. */
export function whereIs(p: Pt): string {
  const col = third(p.x);
  const row = third(p.y);
  if (row === 1 && col === 1) return "the middle";
  if (row === 1) return col === 0 ? "the left" : "the right";
  if (col === 1) return row === 0 ? "the top" : "the bottom";
  return `the ${row === 0 ? "upper" : "lower"} ${col === 0 ? "left" : "right"}`;
}

/** The way an arrow points, in words. Up means up the picture. */
export function wayOf(from: Pt, to: Pt): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = dx >= 0 ? "right" : "left";
  const rise = dy < 0 ? "up" : "down";
  if (Math.abs(dy) < 0.4 * Math.abs(dx)) return `to the ${side}`;
  if (Math.abs(dx) < 0.4 * Math.abs(dy)) return rise === "up" ? "upward" : "downward";
  return `${rise} and to the ${side}`;
}

const length = (m: Mark) => Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
const how = (len: number) => (len < SMALL ? "a little" : len < FAR ? "steadily" : "across the frame");

/** One short phrase on one line: someone's note must not become a second instruction. */
function clean(note: string): string {
  const one = note.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "");
  return one.slice(0, NOTE_MAX).trim();
}

function subject(m: Mark): string {
  const note = clean(m.note);
  const way = `${wayOf(m.from, m.to)} ${how(length(m))}`;
  if (!note) return `The subject in ${whereIs(m.from)} moves ${way}.`;
  return `${note[0]!.toUpperCase()}${note.slice(1)}, in ${whereIs(m.from)}, moves ${way}.`;
}

function camera(m: Mark): string {
  const dx = m.to.x - m.from.x;
  const dy = m.to.y - m.from.y;
  const parts: string[] = [];
  if (Math.abs(dx) >= 0.4 * Math.abs(dy)) parts.push(`pans ${dx >= 0 ? "to the right" : "to the left"}`);
  if (Math.abs(dy) >= 0.4 * Math.abs(dx)) parts.push(`tilts ${dy < 0 ? "up" : "down"}`);
  const pace = length(m) < SMALL ? " a little" : length(m) < FAR ? " steadily" : " slowly across the whole shot";
  return `The camera ${parts.join(" and ")}${pace}.`;
}

/** The motion prompt for a sketch, or "" when nothing has been drawn that is long enough to mean something. */
export function motionPrompt(marks: Mark[]): string {
  const read = marks.slice(0, MAX_MARKS).filter((m) => length(m) >= TOO_SHORT);
  if (read.length === 0) return "";
  const lines = read.map((m) => (m.kind === "camera" ? camera(m) : subject(m)));
  return `${lines.join(" ")} Keep everything else, including the light and the people, as it is. Smooth, natural motion with no cuts.`;
}
