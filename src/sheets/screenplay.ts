/**
 * Reads a screenplay into scenes, dialogue, speaking characters and places.
 *
 * It accepts the indented layout most writers use and flat, Fountain-style
 * plain text, because a script that arrives from a phone or a Markdown export
 * has usually lost its indentation. The script is data: nothing in it is ever
 * treated as an instruction.
 */

export type Line = {
  character: string;
  /** V.O., O.S., CONT'D — what the cue says about how the line is heard. */
  extension: string;
  parenthetical: string;
  words: string;
};

export type Scene = {
  /** `e{episode}-s{number}`, stable for a given upload. */
  id: string;
  episode: number;
  number: number;
  act: string;
  heading: string;
  flash: boolean;
  montage: boolean;
  setting: "INT" | "EXT" | "INT/EXT" | "";
  place: string;
  area: string;
  time: string;
  /** 1-based line numbers in the uploaded file, inclusive. */
  from: number;
  to: number;
  action: string;
  dialogue: Line[];
  characters: string[];
};

export type Speaker = { name: string; lines: number; scenes: string[]; age: number | null };

export type Screenplay = {
  series: string;
  episode: number;
  title: string;
  lines: number;
  scenes: Scene[];
  characters: Speaker[];
};

const HEADING =
  /^(?:(FLASH|TIME CUT)\s*[—–-]+\s*|[—–]\s+)?(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?|INT\.|EXT\.)\s+(.+?):?$/;
/** A non-INT/EXT slugline: "NOWHERE — A PLACE MADE OF MEMORY". */
const SLUG = /^(?:(FLASH|TIME CUT)\s*[—–-]+\s*)?([^a-z]+?\s[—–]\s[^a-z]+?)[:.]?$/;
const ACT = /^(TEASER|COLD OPEN|PROLOGUE|EPILOGUE|TAG|ACT (?:ONE|TWO|THREE|FOUR|FIVE|SIX|[1-9]))$/;
const TIME =
  /^(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|LATE AFTERNOON|LATE NIGHT|PRE-DAWN|FIRST LIGHT|SUNRISE|SUNSET|CONTINUOUS|LATER|MOMENTS LATER|SAME|SAME TIME|TIMELESS|NIGHT CYCLE)\b/;
const CUE = /^([A-Z][A-Z0-9 .'’\-]*[A-Z0-9'’])((?:\s*\([^)]*\))*)$/;
const NOT_CUE =
  /^(FADE|CUT|SMASH|DISSOLVE|MATCH|END|TITLE|THE END|BACK TO|INTERCUT|SUPER|CONTINUED|LATER|MONTAGE|FLASH|TIME CUT)\b/;
const PREFIX = /^(FLASH|TIME CUT)\s*[—–-]+\s*|^[—–]\s+/;
const RULE = /^[─━-]{3,}$/;
const TRANSITION = /^(FADE (IN|OUT)|SMASH TO BLACK|CUT TO|END OF |TITLE CARD|BACK TO)/;

const dashes = (text: string) =>
  text
    .split(/\s+[—–-]\s+|\s+--\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
const blank = (lines: string[], i: number) => i < 0 || i >= lines.length || !lines[i]!.trim();
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

type Heading = Pick<Scene, "heading" | "flash" | "montage" | "setting" | "place" | "area" | "time">;

function slug(lines: string[], i: number): Heading | null {
  const text = lines[i]!.trim();
  const match = SLUG.exec(text);
  if (!match || text.length > 90 || ACT.test(text) || /TO:$/.test(text)) return null;
  if (/^(FADE|CUT|SMASH|DISSOLVE|END|TITLE)\b/.test(text)) return null;
  if (!blank(lines, i - 1) || !blank(lines, i + 1)) return null;
  const heading = text.replace(/^(FLASH|TIME CUT)\s*[—–-]+\s*/, "").replace(/[:.]$/, "");
  // A sequence marker, not a place: it names the scene but adds no location row.
  return {
    heading,
    flash: Boolean(match[1]),
    montage: false,
    setting: "",
    place: "",
    area: heading,
    time: dashes(match[2]!).filter((part) => TIME.test(part)).join(" — "),
  };
}

function heading(lines: string[], i: number): Heading | null {
  const text = lines[i]!.trim();
  const match = HEADING.exec(text);
  if (!match) return slug(lines, i);
  // "— INT. LARK HOUSE: Anna folding laundry," is a montage item inside a scene.
  if (/^[—–]\s/.test(text) && /[a-z]/.test(text)) return null;
  const raw = match[2]!.replace(/[.\s]/g, "");
  const setting = raw === "INT" || raw === "EXT" ? raw : "INT/EXT";
  const time: string[] = [];
  const place: string[] = [];
  for (const part of dashes(match[3]!.replace(/:$/, ""))) {
    (TIME.test(part.replace(/\s*\(.*\)$/, "")) ? time : place).push(part);
  }
  return {
    heading: text.replace(PREFIX, "").replace(/:$/, ""),
    flash: Boolean(match[1]),
    montage: /^[—–]\s/.test(text),
    setting,
    place: place[0] ?? "",
    area: place.slice(1).join(" — "),
    time: time.map((part) => part.replace(/\s*\(.*\)$/, "")).join(" — "),
  };
}

function cue(lines: string[], i: number): { character: string; extension: string } | null {
  const text = lines[i]!.trim();
  if (!text || text.length > 50 || /[a-z]/.test(text)) return null;
  if (/[:,!?]$|\.$/.test(text.replace(/\([^)]*\)/g, "").trim())) return null;
  if (ACT.test(text) || NOT_CUE.test(text) || HEADING.test(text)) return null;
  if (SLUG.test(text) && /\s[—–]\s/.test(text)) return null;
  if (!blank(lines, i - 1) || blank(lines, i + 1)) return null;
  const match = CUE.exec(text);
  // More than four words is carved text or a sign, not a speaker.
  if (!match || match[1]!.split(/\s+/).length > 4) return null;
  const extension = [...match[2]!.matchAll(/\(([^)]*)\)/g)]
    .map((part) => part[1]!.trim())
    .filter((part) => !/^\d+$/.test(part));
  return { character: match[1]!.trim(), extension: extension.join(" ") };
}

export function parseScreenplay(text: unknown, { episode }: { episode?: number } = {}): Screenplay {
  if (typeof text !== "string") throw new Error("Upload the script as a text file.");
  if (text.length > 3_000_000) throw new Error("Keep each script under 3 MB.");

  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const scenes: Scene[] = [];
  let series = "";
  let title = "";
  let ep = episode;
  let act = "";
  let scene: Scene | null = null;
  let action: string[] = [];
  // Content before the first heading only counts once the script has started.
  let opened = false;

  const first = lines.find((line) => line.trim())?.trim();
  if (first && !/[a-z]/.test(first) && !HEADING.test(first) && !ACT.test(first)) series = first;
  for (const line of lines.slice(0, 40)) {
    const match = /^Episode\s+(\d+)\s*[—–:-]\s*["“]?(.+?)["”]?\s*$/i.exec(line.trim());
    if (match) {
      ep ??= Number(match[1]);
      title = match[2]!;
      break;
    }
  }
  const epNumber = ep ?? 1;

  const close = (end: number) => {
    if (!scene) return;
    scene.to = end;
    scene.action = squash(action.join(" ")).slice(0, 2000);
  };
  const open = (at: number, h: Heading) => {
    close(at);
    action = [];
    scene = {
      id: `e${epNumber}-s${scenes.length + 1}`,
      episode: epNumber,
      number: scenes.length + 1,
      act,
      ...h,
      from: at + 1,
      to: 0,
      action: "",
      dialogue: [],
      characters: [],
    };
    scenes.push(scene);
    return scene;
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trim();
    if (ACT.test(text)) {
      act = text;
      opened = true;
      continue;
    }
    if (/^FADE IN/.test(text)) {
      opened = true;
      continue;
    }
    const h = heading(lines, i);
    if (h) {
      open(i, h);
      continue;
    }
    let current: Scene | null = scene;
    if (!current) {
      if (!opened || !text || RULE.test(text)) continue;
      const untitled = { heading: act || "OPENING", flash: false, montage: false, setting: "", place: "", area: "", time: "" } as const;
      current = open(i, untitled);
    }
    const speaker = cue(lines, i);
    if (speaker) {
      const paren: string[] = [];
      const words: string[] = [];
      let j = i + 1;
      let inParen = false;
      for (; j < lines.length && lines[j]!.trim(); j++) {
        const part = lines[j]!.trim();
        if (inParen || part.startsWith("(")) {
          paren.push(part.replace(/^\(|\)$/g, ""));
          inParen = !part.endsWith(")");
        } else {
          words.push(part);
        }
      }
      current.dialogue.push({
        ...speaker,
        parenthetical: squash(paren.join(" ")).replace(/\)\s*\(/g, "; "),
        words: squash(words.join(" ")),
      });
      if (!current.characters.includes(speaker.character)) current.characters.push(speaker.character);
      i = j - 1;
      continue;
    }
    if (text && !TRANSITION.test(text) && !RULE.test(text)) action.push(text);
  }
  close(lines.length);
  if (!scenes.length) throw new Error("No scene heading found. Scenes start with INT. or EXT.");

  const speakers = new Map<string, Speaker>();
  for (const s of scenes) {
    for (const line of s.dialogue) {
      const speaker = speakers.get(line.character) ?? { name: line.character, lines: 0, scenes: [], age: null };
      speaker.lines++;
      if (!speaker.scenes.includes(s.id)) speaker.scenes.push(s.id);
      speakers.set(line.character, speaker);
    }
  }
  // "MAYA (19) waits on the dock" — the age the action gives a speaker when we first meet them.
  for (const s of scenes) {
    for (const match of s.action.matchAll(/\b([A-Z][A-Z'’ .-]*[A-Z])\s*\((\d{1,3})\)/g)) {
      const speaker = speakers.get(match[1]!.trim());
      if (speaker && speaker.age === null) speaker.age = Number(match[2]);
    }
  }

  return { series, episode: epNumber, title, lines: lines.length, scenes, characters: [...speakers.values()] };
}
