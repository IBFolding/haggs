/**
 * Kinetic film: big words that slam in on the beat, cut to a tempo. A film is a plain-text sheet, one block per
 * line ("WORDS | beats | style"), laid out on a beat grid. Everything here is pure; the canvas draws it.
 */

export const STYLES = ["white", "green", "flip", "invert", "red"] as const;
export type Style = (typeof STYLES)[number];
export type Zoom = { x: number; y: number; scale: number };
export type WordsBlock = { kind?: undefined; text: string; beats: number; style: Style };
export type MediaBlock = { kind: "image" | "clip"; name: string; beats: number; label: string; zoom?: Zoom };
export type CountBlock = { kind: "count"; value: number; prefix: string; suffix: string; decimals: number; beats: number; label: string };
export type StackBlock = { kind: "stack"; words: string[]; beats: number; style: Style };
export type BarBlock = { kind: "bar"; value: number; beats: number; label: string };
export type Block = WordsBlock | MediaBlock | CountBlock | StackBlock | BarBlock;
export type Sheet = { bpm: number; blocks: Block[]; problems: string[] };

export const MAX_BLOCKS = 400;
export const MAX_SECONDS = 300;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function parseSheet(text: string): Sheet {
  let bpm = 120;
  const blocks: Block[] = [];
  const problems: string[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw || raw.startsWith("#")) continue;
    const tempo = /^bpm\s+(\d+(?:\.\d+)?)$/i.exec(raw);
    if (tempo) { bpm = clamp(Number(tempo[1]), 60, 220); continue; }
    if (blocks.length >= MAX_BLOCKS) { if (!problems.some((p) => p.includes(String(MAX_BLOCKS)))) problems.push(`A film has at most ${MAX_BLOCKS} blocks; the rest were left out.`); continue; }
    if (raw.startsWith("@")) { const b = parseSpecial(raw, i + 1, problems); if (b) blocks.push(b); continue; }
    const [words = "", beatsText, styleText] = raw.split("|").map((s) => s.trim());
    let beats = 2;
    if (beatsText) {
      const n = Number(beatsText);
      if (!Number.isFinite(n)) { problems.push(`Line ${i + 1}: "${beatsText}" isn't a number of beats.`); continue; }
      beats = clamp(n, 0.5, 32);
    }
    let style: Style = "white";
    if (styleText) {
      if (!(STYLES as readonly string[]).includes(styleText.toLowerCase())) { problems.push(`Line ${i + 1}: unknown style "${styleText}". Use ${STYLES.join(", ")}.`); continue; }
      style = styleText.toLowerCase() as Style;
    }
    if (!words) continue;
    blocks.push({ text: words.slice(0, 40), beats, style });
  }
  // A film is at most five minutes: whatever runs past that is left out.
  const spb = 60 / bpm;
  let seconds = 0, keep = 0;
  for (const bl of blocks) { if (seconds + bl.beats * spb > MAX_SECONDS + 1e-9) break; seconds += bl.beats * spb; keep++; }
  if (keep < blocks.length) { blocks.length = keep; problems.push("A film runs at most 5 minutes; the rest was left out."); }
  return { bpm, blocks, problems };
}

const beatsOf = (text: string | undefined, line: number, problems: string[]): number | null => {
  if (!text) return 2;
  const n = Number(text);
  if (!Number.isFinite(n)) { problems.push(`Line ${line}: "${text}" isn't a number of beats.`); return null; }
  return clamp(n, 0.5, 32);
};

/** "@image name | beats | label", "@clip name | beats | label | zoom x y scale", "@count 26 | beats | label". */
function parseSpecial(raw: string, line: number, problems: string[]): MediaBlock | CountBlock | StackBlock | BarBlock | null {
  const [head = "", beatsText, labelText = "", extra = ""] = raw.split("|").map((x) => x.trim());
  const [kind = "", ...rest] = head.slice(1).split(/\s+/);
  const arg = rest.join(" ");
  const beats = beatsOf(beatsText, line, problems);
  if (beats === null) return null;
  const label = labelText.slice(0, 40);
  if (kind === "image" || kind === "clip") {
    if (!/^[A-Za-z0-9_-]+$/.test(arg)) { problems.push(`Line ${line}: @${kind} needs one name made of letters, numbers, - or _.`); return null; }
    const block: MediaBlock = { kind, name: arg.toLowerCase(), beats, label };
    const z = /^zoom\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)$/i.exec(extra);
    if (z) block.zoom = { x: clamp(Number(z[1]), 0, 1), y: clamp(Number(z[2]), 0, 1), scale: clamp(Number(z[3]), 1, 4) };
    return block;
  }
  if (kind === "count") {
    const m = /^([$€£]?)(\d+(?:\.\d+)?)(%?)$/.exec(arg);
    if (!m) { problems.push(`Line ${line}: @count needs a number like 26, $0.07 or 99%.`); return null; }
    return { kind: "count", value: Number(m[2]), prefix: m[1]!, suffix: m[3]!, decimals: (m[2]!.split(".")[1] ?? "").length, beats, label };
  }
  if (kind === "stack") {
    const words = arg.split("/").map((x) => x.trim()).filter(Boolean).slice(0, 6).map((x) => x.slice(0, 24));
    if (!words.length) { problems.push(`Line ${line}: @stack needs words separated by /.`); return null; }
    const style = (extra || labelText).toLowerCase();
    return { kind: "stack", words, beats, style: (STYLES as readonly string[]).includes(style) ? (style as Style) : "white" };
  }
  if (kind === "bar") {
    if (!/^\d+(\.\d+)?$/.test(arg)) { problems.push(`Line ${line}: @bar needs a percentage like 80.`); return null; }
    return { kind: "bar", value: clamp(Number(arg), 0, 100), beats, label };
  }
  problems.push(`Line ${line}: I don't know @${kind}. Use @image, @clip, @count, @stack or @bar.`);
  return null;
}

/** The pictures and clips a film asks for, once each, in order. */
export function mediaNames(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) if ((b.kind === "image" || b.kind === "clip") && !out.includes(b.name)) out.push(b.name);
  return out;
}

export type Item = { block: Block; startBeat: number; startSeconds: number; endSeconds: number };
export type Timeline = { bpm: number; secondsPerBeat: number; items: Item[]; totalSeconds: number };

export function layout(sheet: Pick<Sheet, "bpm" | "blocks">): Timeline {
  const spb = 60 / sheet.bpm;
  let beat = 0;
  const items = sheet.blocks.map((block) => {
    const item = { block, startBeat: beat, startSeconds: beat * spb, endSeconds: (beat + block.beats) * spb };
    beat += block.beats;
    return item;
  });
  return { bpm: sheet.bpm, secondsPerBeat: spb, items, totalSeconds: beat * spb };
}

/** The block playing at a time, and how many beats into it. */
export function blockAt(t: Timeline, seconds: number): { item: Item; index: number; beats: number } | null {
  if (seconds < 0 || seconds >= t.totalSeconds) return null;
  const index = t.items.findIndex((it) => seconds >= it.startSeconds && seconds < it.endSeconds);
  if (index < 0) return null;
  const item = t.items[index]!;
  return { item, index, beats: (seconds - item.startSeconds) / t.secondsPerBeat };
}

export const DEFAULT_SHEET = `bpm 150
# Words that slam on the beat. Format: WORDS | beats | style (white, green, flip, invert, red)
YOUR FILM | 2 | white
IS JUST | 2 | green
WORDS. | 2 | flip
NO TIMELINE. | 2 | white
NO PLUGINS. | 2 | invert
CUT TO THE BEAT. | 4 | green
PICK A TEMPO. | 2 | white
DROP A TRACK. | 2 | flip
PRESS PLAY. | 2 | green
@count 26 | 3 | READY-MADE APPS
MADE IN HAGGS. | 4 | invert
`;
