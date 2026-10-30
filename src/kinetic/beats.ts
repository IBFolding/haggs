/**
 * Kinetic film: big words that slam in on the beat, cut to a tempo. A film is a plain-text sheet, one block per
 * line ("WORDS | beats | style"), laid out on a beat grid. Everything here is pure; the canvas draws it.
 */

export const STYLES = ["white", "green", "flip", "invert", "red"] as const;
export type Style = (typeof STYLES)[number];
export type Block = { text: string; beats: number; style: Style };
export type Sheet = { bpm: number; blocks: Block[]; problems: string[] };

export const MAX_BLOCKS = 120;
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
  return { bpm, blocks, problems };
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
MADE IN HAGGS. | 4 | invert
`;
