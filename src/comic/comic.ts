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

/** How the art should look, beyond the preset: your own notes, a palette, a line weight, and pictures to match. */
export type StyleSheet = { notes: string; palette: string[]; line: "fine" | "medium" | "bold" | ""; refs: string[] };
export const emptyStyle = (): StyleSheet => ({ notes: "", palette: [], line: "", refs: [] });
export const MAX_STYLE_REFS = 2;

/** The style sheet as words, added to every panel so the art stays one hand. */
export function styleWords(sheet: StyleSheet): string {
  const line = sheet.line ? `${sheet.line} linework.` : "";
  const palette = sheet.palette.length ? `Colour palette: ${sheet.palette.join(", ")}.` : "";
  const notes = sheet.notes.trim() ? `Art direction: ${sheet.notes.trim().replace(/[.\s]+$/, "")}.` : "";
  return [line, palette, notes, sheet.refs.length ? "Match the art style of the reference style sheet exactly." : ""].filter(Boolean).join(" ");
}

/** The prompt that draws the style sheet itself: one page that shows the look, to be sent with every panel after it. */
export function styleSheetPrompt(look: LookId, sheet: StyleSheet, locks: string[]): string {
  const words = LOOKS.find((l) => l.id === look)!.words;
  return [`Comic art style sheet, one page: ${words}`, locks.join(" "), styleWords({ ...sheet, refs: [] }), "Show the main character in three poses (front, three-quarter, action), a row of colour swatches of the palette, and three samples of the line weight, on a plain page. No text, no letters, no watermark."].filter(Boolean).join(" ");
}

/** The prompt for one panel's picture: the look, who is in it and what happens. No words in the picture; the bubbles are drawn on after. */
export function panelPrompt(panel: Panel, look: LookId, locks: string[], place?: string, style?: StyleSheet): string {
  const words = LOOKS.find((l) => l.id === look)!.words;
  return [words, style ? styleWords(style) : "", locks.join(" "), place ?? "", `The panel shows: ${panel.action.trim().replace(/[.\s]+$/, "")}.`, "No text, no speech bubbles, no captions, no watermark in the picture."].filter(Boolean).join(" ");
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
  { id: "spark", name: "Origin: Spark", says: "A young hero, a storm, and one bolt of lightning.", panels: [
    { action: "A skinny teenage girl with short curly black hair and a patched denim jacket climbs onto a city rooftop to fix a wobbling TV antenna while a huge thunderstorm rolls over the skyline, rain blowing sideways", caption: "ROOFTOP. THE NIGHT THE POWER WENT OUT.", lines: [{ who: "Juno", text: "Mom's TV. One more time..." }], shape: "wide" },
    { action: "Low angle: black storm clouds with the first veins of lightning crawling above a water tower, the girl tiny at the bottom of the frame with one hand on the antenna mast", lines: [{ who: "Juno", text: "Okay. Okay, okay, okay." }], shape: "tall" },
    { action: "Extreme close-up of her wide dark eyes reflecting a flash of pure white light, rain on her lashes", caption: "THE FLASH.", shape: "wide" },
    { action: "A thick bolt of lightning strikes the antenna mast, the girl thrown backwards in mid-air, blinding white light, her silhouette sharp against it", lines: [{ who: "Juno", text: "AAAAAH!" }], shape: "square" },
    { action: "She sits up on the rooftop in a puddle, both hands crackling with blue-white electricity, steam rising from her wet jacket, the storm still raging behind her", lines: [{ who: "Juno", text: "...Did I just do that?" }], shape: "wide" },
    { action: "Dawn-lit city: the girl in a homemade goggles-and-scarf mask leaps across an alley between two roofs, a trail of lightning arcing behind her", caption: "SPARK. DAY ONE.", lines: [{ who: "Spark", text: "Hang on! I'm coming!" }], shape: "wide" },
  ] },
  { id: "heist", name: "The last job", says: "A quick heist in five panels.", panels: [
    { action: "Three figures in dark clothes crouch on a rooftop at night looking at a glowing city, one holds a blueprint", caption: "11:58 PM.", shape: "wide" },
    { action: "Close shot of a gloved hand opening a vault dial, a drop of sweat falling", lines: [{ who: "Mara", text: "Quiet now." }], shape: "square" },
    { action: "A security guard turning a corner with a flashlight, the beam almost reaching the figures", shape: "tall" },
    { action: "The vault door swinging open to a room full of ordinary cardboard boxes", lines: [{ who: "Theo", text: "That's... it?" }], shape: "wide" },
    { action: "The three figures laughing quietly on the rooftop at dawn, one holding a single small box", caption: "WORTH IT.", shape: "wide" },
  ] },
];
