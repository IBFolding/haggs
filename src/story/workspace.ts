/**
 * The brainstorming workspace behind Photos and Video: pictures laid out freely,
 * grouped into named frames, with sticky notes. Pure layout maths, so what a
 * drag, a group or a prune does is the same everywhere and easy to test.
 */

export const CARD_W = 220;
export const CARD_H = 165;
const GAP_X = 244;
const GAP_Y = 190;
const COLUMNS = 5;
const ORIGIN = 40;
const FRAME_PAD = 24;
const FRAME_HEAD = 44;
const MIN_FRAME_W = 160;
const MIN_FRAME_H = 120;

export type Spot = { x: number; y: number };
export type Frame = { id: string; name: string; x: number; y: number; w: number; h: number };
export type Note = { id: string; text: string; x: number; y: number };
export type Layout = { cards: Record<string, Spot>; frames: Frame[]; notes: Note[] };

export const empty = (): Layout => ({ cards: {}, frames: [], notes: [] });

/** Gives each new picture the next free cell, row by row. Pictures already placed stay where they are. */
export function place(layout: Layout, ids: string[]): Layout {
  const taken = new Set(Object.values(layout.cards).map((c) => `${Math.round((c.x - ORIGIN) / GAP_X)},${Math.round((c.y - ORIGIN) / GAP_Y)}`));
  const cards = { ...layout.cards };
  let n = 0;
  for (const id of ids) {
    if (cards[id]) continue;
    let col: number, row: number;
    do {
      col = n % COLUMNS;
      row = Math.floor(n / COLUMNS);
      n++;
    } while (taken.has(`${col},${row}`));
    taken.add(`${col},${row}`);
    cards[id] = { x: ORIGIN + col * GAP_X, y: ORIGIN + row * GAP_Y };
  }
  return { ...layout, cards };
}

export const moveCard = (layout: Layout, id: string, x: number, y: number): Layout =>
  layout.cards[id] ? { ...layout, cards: { ...layout.cards, [id]: { x, y } } } : layout;

const inside = (f: Frame, c: Spot) => {
  const cx = c.x + CARD_W / 2;
  const cy = c.y + CARD_H / 2;
  return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
};

/** The pictures whose centre sits inside a frame. */
export function membersOf(layout: Layout, frameId: string): string[] {
  const f = layout.frames.find((x) => x.id === frameId);
  if (!f) return [];
  return Object.entries(layout.cards).filter(([, c]) => inside(f, c)).map(([id]) => id);
}

/** A named frame drawn around the chosen pictures. */
export function groupCards(layout: Layout, ids: string[], name: string): Layout {
  const spots = ids.map((id) => layout.cards[id]).filter((s): s is Spot => Boolean(s));
  if (spots.length === 0) return layout;
  const x0 = Math.max(0, Math.min(...spots.map((s) => s.x)) - FRAME_PAD);
  const y0 = Math.max(0, Math.min(...spots.map((s) => s.y)) - FRAME_PAD - FRAME_HEAD);
  const x1 = Math.max(...spots.map((s) => s.x)) + CARD_W + FRAME_PAD;
  const y1 = Math.max(...spots.map((s) => s.y)) + CARD_H + FRAME_PAD;
  const next = layout.frames.reduce((m, f) => Math.max(m, Number(f.id.slice(1)) || 0), 0) + 1;
  const frame: Frame = { id: `g${next}`, name: name.trim() || "Group", x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return { ...layout, frames: [...layout.frames, frame] };
}

/** Moves a frame and the pictures inside it, and nothing else. */
export function moveFrame(layout: Layout, frameId: string, dx: number, dy: number): Layout {
  const members = new Set(membersOf(layout, frameId));
  const cards = Object.fromEntries(Object.entries(layout.cards).map(([id, c]) => [id, members.has(id) ? { x: c.x + dx, y: c.y + dy } : c]));
  return { ...layout, cards, frames: layout.frames.map((f) => (f.id === frameId ? { ...f, x: f.x + dx, y: f.y + dy } : f)) };
}

export const renameFrame = (layout: Layout, frameId: string, name: string): Layout => ({
  ...layout,
  frames: layout.frames.map((f) => (f.id === frameId ? { ...f, name: name.slice(0, 60) } : f)),
});

export const resizeFrame = (layout: Layout, frameId: string, w: number, h: number): Layout => ({
  ...layout,
  frames: layout.frames.map((f) => (f.id === frameId ? { ...f, w: Math.max(MIN_FRAME_W, w), h: Math.max(MIN_FRAME_H, h) } : f)),
});

/** Takes the frame away; the pictures stay where they are. */
export const removeFrame = (layout: Layout, frameId: string): Layout => ({ ...layout, frames: layout.frames.filter((f) => f.id !== frameId) });

export function addNote(layout: Layout, text: string, x: number, y: number): Layout {
  const next = layout.notes.reduce((m, n) => Math.max(m, Number(n.id.slice(1)) || 0), 0) + 1;
  return { ...layout, notes: [...layout.notes, { id: `n${next}`, text: text.slice(0, 400), x, y }] };
}
export const moveNote = (layout: Layout, id: string, x: number, y: number): Layout => ({ ...layout, notes: layout.notes.map((n) => (n.id === id ? { ...n, x, y } : n)) });
export const editNote = (layout: Layout, id: string, text: string): Layout => ({ ...layout, notes: layout.notes.map((n) => (n.id === id ? { ...n, text: text.slice(0, 400) } : n)) });
export const removeNote = (layout: Layout, id: string): Layout => ({ ...layout, notes: layout.notes.filter((n) => n.id !== id) });

/** Forgets pictures that are no longer on the page. Frames and notes are yours, so they stay. */
export const prune = (layout: Layout, ids: string[]): Layout => {
  const keep = new Set(ids);
  return { ...layout, cards: Object.fromEntries(Object.entries(layout.cards).filter(([id]) => keep.has(id))) };
};

/** Reads a saved layout back, tolerating anything odd in storage. */
export function parse(value: unknown): Layout {
  if (typeof value !== "object" || value === null) return empty();
  const v = value as Partial<Layout>;
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  return {
    cards: Object.fromEntries(Object.entries(v.cards ?? {}).filter(([, c]) => c && num(c.x) && num(c.y))),
    frames: (v.frames ?? []).filter((f) => f && typeof f.id === "string" && num(f.x) && num(f.y) && num(f.w) && num(f.h)).map((f) => ({ ...f, name: String(f.name ?? "Group") })),
    notes: (v.notes ?? []).filter((n) => n && typeof n.id === "string" && num(n.x) && num(n.y)).map((n) => ({ ...n, text: String(n.text ?? "") })),
  };
}
