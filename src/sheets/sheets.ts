/**
 * The skill-sheet pipeline: script → story beats → characters → locations →
 * shots → prompts → QA → a board project.
 *
 * Prompts and QA are derived from the other sheets every time and never
 * stored, for the same reason a board shot's prompt is never stored: a fix to
 * a character lock or a camera move has to show up in every shot it touches,
 * and a stored copy would quietly go on describing the old one.
 */

import type { Project, Shot, Thread } from "../story/model";
import { cameraMove, movePrompt } from "./camera";
import type { Line, Scene, Screenplay } from "./screenplay";

export const SHEETS = [
  { id: "script", label: "Script", hint: "Every scene the upload found. Pick the ones the reel is built from." },
  { id: "story", label: "Story beats", hint: "The moments the reel is built from, in reel order." },
  { id: "characters", label: "Characters", hint: "Identity locks keep each face and wardrobe the same in every shot." },
  { id: "locations", label: "Locations", hint: "Look locks keep each place consistent." },
  { id: "shots", label: "Shot list", hint: "Size, angle, lens, camera move, blocking and timing for every shot." },
  { id: "prompts", label: "Prompts", hint: "Assembled from the shot, its locks and its camera move. Edit those, not the prompt." },
  { id: "qa", label: "QA", hint: "What would make a bad reel, found before anything is spent." },
] as const;

export type SheetId = (typeof SHEETS)[number]["id"];
type EditableSheet = "script" | "story" | "characters" | "locations" | "shots";

export type SceneRow = Scene & { note: string };
export type Beat = {
  id: string;
  title: string;
  sceneIds: string[];
  /** "Ep 2, lines 11–30" — where in the scripts this beat comes from. */
  source: string;
  feeling: string;
  /** Anything a shot of this beat must not show. QA flags it. */
  withhold: string;
  note: string;
};
export type CharacterRow = {
  id: string;
  name: string;
  aliases: string[];
  age: number | null;
  lines: number;
  scenes: string[];
  look: string;
  wardrobe: string;
  voice: string;
  /** Written into every shot the character is in. */
  lock: string;
  never: string;
};
export type LocationRow = {
  id: string;
  name: string;
  setting: string;
  areas: string[];
  scenes: string[];
  look: string;
  light: string;
  lock: string;
};
export type ShotRow = {
  id: string;
  beatId: string;
  sceneId: string;
  seconds: number;
  size: string;
  angle: string;
  lens: string;
  /** A camera move id from the picker, or "". */
  move: string;
  blocking: string;
  action: string;
  dialogue: string;
  sound: string;
  characters: string[];
  location: string;
  note: string;
};
export type Sheets = {
  version: 1;
  title: string;
  logline: string;
  seconds: number;
  format: string;
  style: string;
  rules: string[];
  sources: { episode: number; title: string; series: string; lines: number; scenes: number }[];
  script: SceneRow[];
  story: Beat[];
  characters: CharacterRow[];
  locations: LocationRow[];
  shots: ShotRow[];
};
type Row = SceneRow | Beat | CharacterRow | LocationRow | ShotRow;
type Patch = Record<string, unknown>;

export type Finding = { level: "error" | "warn"; sheet: SheetId; id: string; message: string };

const FIXED = new Set(["id", "beatId", "sceneId", "from", "to", "episode", "number"]);
const uid = () => crypto.randomUUID().slice(0, 8);
const clone = <T>(value: T): T => structuredClone(value);
/** Shot lengths land on a 30fps frame, the same rule the cut uses. */
const onFrame = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0.5 && n <= 15 && Math.abs(n * 30 - Math.round(n * 30)) < 1e-6;
const cap = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : "");

const blankCharacter = (name: string): CharacterRow => ({
  id: name, name, aliases: [], age: null, lines: 0, scenes: [], look: "", wardrobe: "", voice: "", lock: "", never: "",
});
const blankLocation = (name: string, setting = ""): LocationRow => ({
  id: name, name, setting, areas: [], scenes: [], look: "", light: "", lock: "",
});

export type SheetOptions = {
  title?: string;
  seconds?: number;
  format?: string;
  style?: string;
  rules?: string[];
  logline?: string;
};

export function buildSheets(scripts: Screenplay[], options: SheetOptions = {}): Sheets {
  const { title = "Untitled reel", seconds = 60, format = "16:9", style = "", rules = [], logline = "" } = options;
  if (!scripts.length) throw new Error("Upload at least one script.");
  const ordered = [...scripts].sort((a, b) => a.episode - b.episode);
  if (new Set(ordered.map((s) => s.episode)).size !== ordered.length) {
    throw new Error("Two scripts have the same episode number. Remove one or renumber it.");
  }

  const characters = new Map<string, CharacterRow>();
  const locations = new Map<string, LocationRow>();
  for (const script of ordered) {
    for (const speaker of script.characters) {
      const row = characters.get(speaker.name) ?? blankCharacter(speaker.name);
      row.lines += speaker.lines;
      row.scenes.push(...speaker.scenes);
      row.age ??= speaker.age;
      characters.set(speaker.name, row);
    }
    for (const scene of script.scenes) {
      if (!scene.place) continue;
      const row = locations.get(scene.place) ?? blankLocation(scene.place, scene.setting);
      if (scene.area && !row.areas.includes(scene.area)) row.areas.push(scene.area);
      row.scenes.push(scene.id);
      locations.set(scene.place, row);
    }
  }

  return {
    version: 1,
    title,
    logline,
    seconds,
    format,
    style,
    rules: [...rules],
    sources: ordered.map((s) => ({ episode: s.episode, title: s.title, series: s.series, lines: s.lines, scenes: s.scenes.length })),
    script: ordered.flatMap((s) => s.scenes.map((scene) => ({ ...clone(scene), note: "" }))),
    story: [],
    characters: [...characters.values()],
    locations: [...locations.values()],
    shots: [],
  };
}

function rowsOf(sheets: Sheets, sheet: string): Row[] {
  if (!SHEETS.some((s) => s.id === sheet)) throw new Error(`There is no ${sheet} sheet.`);
  if (sheet === "prompts" || sheet === "qa") {
    throw new Error(`The ${sheet} sheet is derived. Change the shot, character or location it comes from.`);
  }
  return sheets[sheet as EditableSheet];
}

function indexOf(rows: Row[], id: string): number {
  const at = rows.findIndex((row) => row.id === id);
  if (at < 0) throw new Error("That row is not on the sheet any more.");
  return at;
}

function check(sheet: string, patch: Patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (FIXED.has(key)) throw new Error(`The ${key} column cannot be changed.`);
    if (sheet === "shots" && key === "seconds" && !onFrame(value)) throw new Error("Shots run 0.5–15 seconds, on a 30fps frame.");
    if (sheet === "shots" && key === "move" && value && !cameraMove(String(value))) throw new Error("Choose a camera move from the list.");
    if (typeof value === "string" && value.length > 4000) throw new Error("Keep each cell under 4,000 characters.");
  }
}

/** Fix: change one cell. */
export function fixCell(sheets: Sheets, sheet: string, id: string, key: string, value: unknown): Sheets {
  const next = clone(sheets);
  const rows = rowsOf(next, sheet);
  const at = indexOf(rows, id);
  check(sheet, { [key]: value });
  (rows[at] as Record<string, unknown>)[key] = value;
  return next;
}

/** Alter: change the same columns on several rows at once. */
export function alterRows(sheets: Sheets, sheet: string, ids: string[], patch: Patch): Sheets {
  const next = clone(sheets);
  const rows = rowsOf(next, sheet);
  check(sheet, patch);
  for (const id of ids) Object.assign(rows[indexOf(rows, id)]!, clone(patch));
  return next;
}

/** Add: a new character or place. Beats and shots have their own adders. */
export function addRow(sheets: Sheets, sheet: string, row: Patch = {}, at?: number): Sheets {
  if (sheet === "story") return addBeat(sheets, row as BeatInput);
  if (sheet === "shots") {
    if (typeof row.beatId !== "string") throw new Error("Add shots from a story beat.");
    return addShot(sheets, row.beatId, row as Partial<ShotRow>);
  }
  const next = clone(sheets);
  const rows = rowsOf(next, sheet);
  if (sheet !== "characters" && sheet !== "locations") {
    throw new Error("Scenes come from the uploaded script. Upload the script again to add scenes.");
  }
  const name = String(row.name ?? "").trim().toUpperCase();
  if (!name) throw new Error("Give the new row a name.");
  if (rows.some((r) => r.id === name)) throw new Error(`${name} is already on the sheet.`);
  check(sheet, Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id")));
  const made = { ...(sheet === "characters" ? blankCharacter(name) : blankLocation(name)), ...row, id: name, name };
  rows.splice(at ?? rows.length, 0, made as Row);
  return next;
}

export function removeRow(sheets: Sheets, sheet: string, id: string): Sheets {
  if (sheet === "script") throw new Error("Scenes come from the uploaded script and stay on the sheet.");
  const next = clone(sheets);
  const rows = rowsOf(next, sheet);
  rows.splice(indexOf(rows, id), 1);
  // A shot belongs to its beat; without the beat it has nothing to say.
  if (sheet === "story") next.shots = next.shots.filter((shot) => shot.beatId !== id);
  return next;
}

export function moveRow(sheets: Sheets, sheet: string, id: string, to: number): Sheets {
  const next = clone(sheets);
  const rows = rowsOf(next, sheet);
  const [row] = rows.splice(indexOf(rows, id), 1);
  rows.splice(Math.max(0, Math.min(rows.length, to)), 0, row!);
  return next;
}

function sourceOf(sheets: Sheets, ids: string[]): string {
  const scenes = ids.map((id) => sheets.script.find((s) => s.id === id)!);
  return [...new Set(scenes.map((s) => s.episode))]
    .map((episode) => {
      const own = scenes.filter((s) => s.episode === episode);
      return `Ep ${episode}, lines ${Math.min(...own.map((s) => s.from))}–${Math.max(...own.map((s) => s.to))}`;
    })
    .join("; ");
}

export type BeatInput = { title?: string; sceneIds?: string[]; feeling?: string; withhold?: string; at?: number };

export function addBeat(sheets: Sheets, { title = "", sceneIds = [], feeling = "", withhold = "", at }: BeatInput = {}): Sheets {
  if (!sceneIds.length || sceneIds.some((id) => !sheets.script.some((s) => s.id === id))) {
    throw new Error("Pick the scene or scenes this beat comes from.");
  }
  const next = clone(sheets);
  const scene = sheets.script.find((s) => s.id === sceneIds[0])!;
  next.story.splice(at ?? next.story.length, 0, {
    id: "beat-" + uid(),
    title: String(title || scene.heading).slice(0, 100),
    sceneIds: [...sceneIds],
    source: sourceOf(sheets, sceneIds),
    feeling,
    withhold,
    note: "",
  });
  return next;
}

const speech = (line: Line) => `${line.character}${line.extension ? ` (${line.extension})` : ""}: ${line.words}`;

/** A shot starts from its beat's first scene: its cast, its place, its action and its first lines. */
export function addShot(sheets: Sheets, beatId: string, options: Partial<ShotRow> & { at?: number } = {}): Sheets {
  const beat = sheets.story.find((b) => b.id === beatId);
  if (!beat) throw new Error("That story beat is not on the sheet any more.");
  const { at, ...given } = options;
  const scene = sheets.script.find((s) => s.id === (given.sceneId ?? beat.sceneIds[0]))!;
  const shot: ShotRow = {
    beatId,
    sceneId: scene.id,
    seconds: 5,
    size: "",
    angle: "",
    lens: "",
    move: "",
    blocking: "",
    action: scene.action.slice(0, 600),
    dialogue: scene.dialogue.slice(0, 3).map(speech).join("\n"),
    sound: "",
    characters: [...scene.characters],
    location: scene.place,
    note: "",
    ...given,
    id: "shot-" + uid(),
  };
  check("shots", { seconds: shot.seconds, move: shot.move });
  const next = clone(sheets);
  const order = (id: string) => next.story.findIndex((b) => b.id === id);
  // New shots land after the last shot of this beat or any beat before it.
  const last = next.shots.findLastIndex((s) => order(s.beatId) <= order(beatId));
  next.shots.splice(at ?? last + 1, 0, shot);
  return next;
}

function frameOf(shot: ShotRow): string {
  return [shot.size && `${cap(shot.size)} shot`, shot.angle && `${shot.angle} angle`, shot.lens && `${shot.lens} lens`]
    .filter(Boolean)
    .join(", ");
}

function locksOf(sheets: Sheets, shot: ShotRow): string[] {
  const cast = shot.characters.map((name) => sheets.characters.find((c) => c.id === name)?.lock);
  const place = sheets.locations.find((l) => l.id === shot.location)?.lock;
  return [...cast, place].filter((lock): lock is string => Boolean(lock));
}

/** The prompt a shot runs on its own, as the Prompts sheet shows it. */
export function promptForShot(sheets: Sheets, shot: ShotRow): string {
  const frame = frameOf(shot);
  return [
    [frame && frame + ".", shot.action.trim()].filter(Boolean).join(" "),
    shot.blocking && `Blocking: ${shot.blocking}`,
    ...locksOf(sheets, shot),
    movePrompt(shot.move),
    sheets.style && `Style: ${sheets.style}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

export function promptRows(sheets: Sheets) {
  return sheets.shots.map((shot, i) => ({
    id: shot.id,
    number: i + 1,
    beat: sheets.story.find((b) => b.id === shot.beatId)?.title ?? "",
    text: promptForShot(sheets, shot),
  }));
}

export const runtime = (sheets: Sheets) => Math.round(sheets.shots.reduce((n, s) => n + s.seconds, 0) * 30) / 30;

export function qaSheet(sheets: Sheets): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], sheet: SheetId, id: string, message: string) => out.push({ level, sheet, id, message });
  const { shots } = sheets;

  if (!shots.length) add("error", "shots", "", "No shots yet. Add beats on the Story sheet, then shots from each beat.");
  if (shots.length > 96) add("error", "shots", "", "Keep the reel to 96 shots or fewer.");
  if (shots.length && runtime(sheets) !== sheets.seconds) {
    add("error", "shots", "", `The reel runs ${runtime(sheets)}s of the ${sheets.seconds}s target. Change shot lengths until they add up.`);
  }

  const cast = new Set(shots.flatMap((s) => s.characters));
  const places = new Set(shots.map((s) => s.location).filter(Boolean));
  for (const c of sheets.characters) {
    if (cast.has(c.id) && !c.lock) add("warn", "characters", c.id, `${c.name} has no identity lock. Describe face, age, hair and wardrobe so every shot matches.`);
  }
  for (const l of sheets.locations) {
    if (places.has(l.id) && !l.lock) add("warn", "locations", l.id, `${l.name} has no look lock. Describe the place and its light.`);
  }

  const rules = [
    ...sheets.rules,
    ...sheets.characters.filter((c) => cast.has(c.id) && c.never).map((c) => c.never),
    ...sheets.story.map((b) => b.withhold).filter(Boolean),
  ];
  shots.forEach((shot, i) => {
    const prompt = promptForShot(sheets, shot);
    const hay = (shot.action + "\n" + prompt).toLowerCase();
    if (!shot.action.trim()) add("error", "shots", shot.id, `Shot ${i + 1} has no action. Say what we see.`);
    if (prompt.length >= 4000) add("error", "prompts", shot.id, `Shot ${i + 1}'s prompt is too long. Shorten the action or the locks.`);
    if (shot.dialogue.trim()) {
      add("warn", "shots", shot.id, `Shot ${i + 1} has dialogue. Video models do not lip-sync reliably; plan voice and lip-sync as a separate step.`);
    }
    for (const rule of rules) {
      if (rule.trim() && hay.includes(rule.trim().toLowerCase())) {
        add("error", "shots", shot.id, `Shot ${i + 1} shows something marked withheld: "${rule.trim()}".`);
      }
    }
  });
  return out;
}

const COLORS = ["#d4f83a", "#7dd3fc", "#f5c451", "#f9a8d4", "#a78bfa", "#fb923c", "#34d399", "#f87171"];

/**
 * The sheets as a board project. Each shot keeps its action as the beat and
 * carries its frame, move, blocking and locks as direction, so the board's own
 * prompt assembly — continuity from the shot before included — does the rest.
 * Every shot starts on MiniMax H3 through Comfy.
 */
export function toProject(sheets: Sheets): Project {
  if (!sheets.shots.length) throw new Error("Add at least one shot before opening the board.");
  const now = Date.now();
  const cast = [...new Set(sheets.shots.flatMap((s) => s.characters))];
  const threads: Thread[] = cast.map((name, i) => ({ id: "thread-" + uid(), name, color: COLORS[i % COLORS.length]!, kind: "character" }));
  const threadOf = new Map(threads.map((t) => [t.name, t.id]));

  const shots: Shot[] = sheets.shots.map((s) => {
    const scene = sheets.script.find((x) => x.id === s.sceneId);
    const place = sheets.locations.find((l) => l.id === s.location);
    const frame = frameOf(s);
    return {
      id: crypto.randomUUID(),
      heading: scene?.heading ?? "",
      beat: s.action.trim(),
      threadIds: s.characters.map((name) => threadOf.get(name)).filter((id): id is string => Boolean(id)),
      seconds: s.seconds,
      model: { id: "minimax/minimax-h3", settings: {} },
      direction: {
        camera: [frame && frame + ".", cameraMove(s.move)?.prompt].filter(Boolean).join(" "),
        light: place?.light ?? "",
        staging: s.blocking,
        constants: locksOf(sheets, s).join(" "),
      },
    };
  });

  return {
    id: crypto.randomUUID(),
    name: sheets.title || "Untitled reel",
    createdAt: now,
    updatedAt: now,
    shots,
    threads,
    notes: [],
    direction: { camera: "", light: "", staging: "", constants: sheets.style },
    source: { templateId: "script-sheets", name: "Script sheets" },
  };
}

export const exportSheets = (sheets: Sheets) => JSON.stringify(sheets, null, 1);

export function importSheets(raw: string): Sheets {
  if (raw.length > 5_000_000) throw new Error("Keep the sheet file under 5 MB.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("That is not a sheet file exported from haggs.");
  }
  const x = value as Partial<Sheets> | null;
  const arrays = ["script", "story", "characters", "locations", "shots"] as const;
  if (!x || x.version !== 1 || arrays.some((key) => !Array.isArray(x[key])) || typeof x.title !== "string" || !Number.isFinite(x.seconds)) {
    throw new Error("That is not a sheet file exported from haggs.");
  }
  return x as Sheets;
}
