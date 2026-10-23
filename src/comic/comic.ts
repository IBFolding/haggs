import { createProject, newShot, type Project } from "../story/model";

/**
 * A comic: panels written one by one (who is in it, what happens, what they
 * say), drawn as pictures in a comic look, then laid out as a strip or a page
 * with captions and speech bubbles. The panels can also go to a project, to be
 * animated into a motion comic.
 */

export type Shape = "wide" | "square" | "tall";
export type Line = { who: string; text: string };
export type Panel = { id: string; action: string; caption: string; lines: Line[]; shape: Shape; who: string[] };

export const LOOKS = [
  { id: "ink", name: "Inked comic", says: "Bold black lines, flat colour, halftone shadows.", words: "Comic book panel, bold black ink outlines, flat saturated colours, halftone dot shading, dynamic composition, hand-inked." },
  { id: "manga", name: "Manga", says: "Black and white screentone, sharp lines.", words: "Manga panel, black and white, screentone shading, sharp clean linework, expressive faces, dramatic speed lines." },
  { id: "vector", name: "Pop vector", says: "Flat shapes, big colour, clean edges.", words: "Flat vector comic illustration, clean shapes, bold saturated palette, thick outlines, no gradients." },
  { id: "noir", name: "Noir", says: "High contrast, heavy shadow, one colour.", words: "Noir graphic novel panel, high contrast black ink, deep shadows, one accent colour, moody rain and smoke." },
  { id: "ligne", name: "Ligne claire", says: "Even lines, soft colour, a calm European look.", words: "Ligne claire comic panel, uniform clean line, soft flat colours, detailed backgrounds, calm composition." },
  { id: "story", name: "Storybook", says: "Painted, warm, gentle.", words: "Children's storybook illustration, soft watercolour and gouache, warm light, gentle shapes." },
] as const;
export type LookId = (typeof LOOKS)[number]["id"];

export const LAYOUTS = [
  { id: "strip", name: "Strip", says: "Three across, like a newspaper.", columns: 3 },
  { id: "page", name: "Page", says: "Two across, a full comic page.", columns: 2 },
  { id: "webtoon", name: "Webtoon", says: "One long scroll, one panel under another.", columns: 1 },
] as const;
export type LayoutId = (typeof LAYOUTS)[number]["id"];

export const SHAPE_RATIO: Record<Shape, number> = { wide: 16 / 9, square: 1, tall: 3 / 4 };
/** The shape the picture model is asked for: it makes 16:9 or 9:16, and each panel crops to its own frame. */
export const imageRatio = (shape: Shape): "16:9" | "9:16" => (shape === "wide" ? "16:9" : "9:16");

export const newPanel = (over: Partial<Panel> = {}): Panel => ({ id: crypto.randomUUID(), action: "", caption: "", lines: [], shape: "wide", who: [], ...over });

export type Rect = { x: number; y: number; w: number; h: number };
export const PAGE_W = 1200;
const GUTTER = 28;
const MARGIN = 44;

/** Where each panel sits on the page: rows of `columns`, equal widths, each row as tall as its tallest frame. */
export function layoutPanels(shapes: Shape[], layout: LayoutId): { rects: Rect[]; width: number; height: number } {
  const columns = LAYOUTS.find((l) => l.id === layout)!.columns;
  const cellW = (PAGE_W - MARGIN * 2 - GUTTER * (columns - 1)) / columns;
  const rects: Rect[] = [];
  let y = MARGIN;
  for (let i = 0; i < shapes.length; i += columns) {
    const row = shapes.slice(i, i + columns);
    const rowH = Math.max(...row.map((s) => cellW / SHAPE_RATIO[s]));
    row.forEach((s, k) => {
      const h = cellW / SHAPE_RATIO[s];
      rects.push({ x: MARGIN + k * (cellW + GUTTER), y, w: cellW, h: Math.round(columns === 1 ? h : rowH) });
    });
    y += rowH + GUTTER;
  }
  return { rects, width: PAGE_W, height: Math.round(y - GUTTER + MARGIN) };
}

/** Words broken into lines of at most `max` letters, never splitting a word. */
export function wrapWords(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + w).length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** Where a panel's speech bubbles go: the first top left, the second lower right, each inside the frame. */
export function bubbleSlots(rect: Rect, count: number): Rect[] {
  const w = rect.w * 0.46;
  const h = rect.h * 0.3;
  const slots = [{ x: rect.x + rect.w * 0.04, y: rect.y + rect.h * 0.14, w, h }, { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5, w, h }];
  return slots.slice(0, Math.min(2, count));
}

/** The prompt for one panel's picture: the look, who is in it and what happens. No words in the picture; the bubbles are drawn on after. */
export function panelPrompt(panel: Panel, look: LookId, locks: string[], place?: string): string {
  const words = LOOKS.find((l) => l.id === look)!.words;
  return [words, locks.join(" "), place ?? "", `The panel shows: ${panel.action.trim().replace(/[.\s]+$/, "")}.`, "No text, no speech bubbles, no captions, no watermark in the picture."].filter(Boolean).join(" ");
}

/** The panels as a project: one shot per panel with its picture, ready to animate into a motion comic. */
export function comicProject(name: string, panels: Panel[], pictures: Record<string, string>, vertical = false): Project {
  const base = createProject(name);
  const made = panels.filter((p) => pictures[p.id]);
  if (!made.length) throw new Error("Make at least one panel first.");
  const board = {
    id: crypto.randomUUID(),
    name: "Comic",
    kind: "reel" as const,
    notes: [],
    ...(vertical ? { aspect: "9:16" as const } : {}),
    shots: made.map((p) => ({
      ...newShot(),
      heading: "",
      beat: p.action,
      seconds: 3,
      ...(p.caption.trim() ? { caption: p.caption.trim() } : {}),
      render: { url: pictures[p.id]!, kind: "image" as const, usd: 0.07, promptHash: "", at: Date.now() },
    })),
  };
  return { ...base, boards: [board], source: { templateId: "comic", name } };
}

/** A starting story, so the first panel is never a blank page. */
export const STARTERS: { id: string; name: string; says: string; panels: { action: string; caption?: string; lines?: Line[]; shape?: Shape }[] }[] = [
  { id: "storm", name: "The storm chaser", says: "Six panels: a sky, a warning, a catch.", panels: [
    { action: "A lone figure in a yellow raincoat stands in a wheat field, one arm raised toward a huge dark funnel cloud, lightning behind", caption: "KANSAS. 6:42 PM.", lines: [{ who: "", text: "Come on... give me a good one!" }], shape: "wide" },
    { action: "An old farmer on a porch holding a mug, shouting toward the field, rain slanting, warm window light behind him", lines: [{ who: "Grandpa", text: "Get inside!" }], shape: "tall" },
    { action: "Extreme close-up of the figure's green eye, lightning reflected in it", shape: "wide" },
    { action: "The figure catches a glowing blue orb in a baseball glove, smiling, rain on her face", lines: [{ who: "", text: "...Got it." }], shape: "square" },
    { action: "Shelf in a barn window with three glass jars each holding a glowing blue orb, her hand reaching to set another", shape: "wide" },
    { action: "Wide shot of the farmhouse at night under a clearing sky, the jars glowing in the window", caption: "NEXT STORM: SOON.", shape: "wide" },
  ] },
  { id: "heist", name: "The last job", says: "A quick heist in five panels.", panels: [
    { action: "Three figures in dark clothes crouch on a rooftop at night looking at a glowing city, one holds a blueprint", caption: "11:58 PM.", shape: "wide" },
    { action: "Close shot of a gloved hand opening a vault dial, a drop of sweat falling", lines: [{ who: "Mara", text: "Quiet now." }], shape: "square" },
    { action: "A security guard turning a corner with a flashlight, the beam almost reaching the figures", shape: "tall" },
    { action: "The vault door swinging open to a room full of ordinary cardboard boxes", lines: [{ who: "Theo", text: "That's... it?" }], shape: "wide" },
    { action: "The three figures laughing quietly on the rooftop at dawn, one holding a single small box", caption: "WORTH IT.", shape: "wide" },
  ] },
];
