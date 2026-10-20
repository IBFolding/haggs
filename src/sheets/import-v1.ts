/**
 * Brings a storyboard made in Open Haggsfield v1 onto the sheets.
 *
 * v1 boards already hold the hard decisions — which moments, in what order,
 * at what length, framed how — so importing one should keep all of it rather
 * than start the work again. Each v1 beat becomes a story beat tied to the
 * script scenes its shots cite, and each v1 shot becomes a shot-list row.
 * Free-text camera notes that do not fit a column are kept on the row's note,
 * so nothing written in v1 is lost.
 */

import { hashPrompt, promptFor } from "../story/assemble";
import type { Media, Project } from "../story/model";
import { cameraMove } from "./camera";
import { addBeat, addShot, type Sheets } from "./sheets";

export type V1Shot = {
  name: string;
  seconds: number;
  visual: string;
  prompt: string;
  dialogue: string;
  sound: string;
  references: string[];
  camera?: { size?: string; angle?: string; lens?: string; movement?: string; blocking?: string };
  continuity?: string;
  /** "Episode 1, lines 355–465" */
  source?: string;
  /** "01 · Let them be funny first" */
  beat?: string;
};

export type V1Board = { title: string; logline: string; format: string; shots: V1Shot[] };

const MOVES: [RegExp, string][] = [
  [/\b(locked|static|tripod|hold)\b/i, "static"],
  [/\bpush(es)?[- ]in\b|\bdolly in\b|\bcreep in\b/i, "dolly-in"],
  [/\bpull(s)?[- ](back|out)\b|\bdolly out\b/i, "dolly-out"],
  [/\bcrane up\b|\brise(s)? (up|over)\b/i, "crane-up"],
  [/\bcrane down\b/i, "crane-down"],
  [/\brack focus\b|\bfocus (pull|change)\b/i, "focus-change"],
  [/\bpan(s)? left\b/i, "pan-left"],
  [/\bpan(s)? right\b/i, "pan-right"],
  [/\btilt(s)? up\b/i, "tilt-up"],
  [/\btilt(s)? down\b/i, "tilt-down"],
  [/\bhandheld\b/i, "handheld"],
  [/\borbit\b(?!.*\bno orbit)/i, "orbit-360"],
  [/\bzoom in\b/i, "zoom-in"],
  [/\bzoom out\b/i, "zoom-out"],
  [/\b(follow|tracking|tracks)\b/i, "head-tracking"],
  [/\boverhead\b|\btop[- ]down\b/i, "overhead"],
];

/** The named move a v1 movement note describes, or "" when none fits well enough to claim. */
export function guessMove(note: string): string {
  if (/\bno (orbit|move|movement)\b/i.test(note) && !/\blocked\b/i.test(note)) return "";
  for (const [pattern, id] of MOVES) if (pattern.test(note) && cameraMove(id)) return id;
  return "";
}

function sceneFor(sheets: Sheets, shot: V1Shot): string {
  const match = /Episode\s+(\d+),\s*lines?\s+(\d+)\s*[–-]\s*(\d+)/i.exec(shot.source ?? "");
  const scene = match
    ? sheets.script.find((s) => s.episode === Number(match[1]) && s.from <= Number(match[3]) && s.to >= Number(match[2]))
    : undefined;
  if (!scene) throw new Error(`v1 shot "${shot.name}" cites ${shot.source || "no source"}, which is not in the uploaded scripts.`);
  return scene.id;
}

const clean = (beat: string | undefined, fallback: string) => (beat ?? "").replace(/^\s*\d+\s*·\s*/, "").trim() || fallback;

export function fromV1Board(base: Sheets, board: V1Board): Sheets {
  let sheets: Sheets = { ...base, title: base.title, logline: base.logline || board.logline, format: board.format || base.format };
  const groups: { title: string; shots: V1Shot[] }[] = [];
  for (const shot of board.shots) {
    const title = clean(shot.beat, shot.name);
    const last = groups.at(-1);
    if (last && last.title === title) last.shots.push(shot);
    else groups.push({ title, shots: [shot] });
  }

  for (const group of groups) {
    const scenes = group.shots.map((shot) => sceneFor(sheets, shot));
    sheets = addBeat(sheets, { title: group.title, sceneIds: [...new Set(scenes)] });
    const beat = sheets.story.at(-1)!;
    group.shots.forEach((shot, i) => {
      const camera = shot.camera ?? {};
      const scene = sheets.script.find((s) => s.id === scenes[i])!;
      const note = [
        camera.movement && `v1 camera: ${camera.movement}`,
        camera.angle && camera.angle.length > 12 && `v1 angle: ${camera.angle}`,
        shot.continuity && `v1 continuity: ${shot.continuity}`,
      ].filter(Boolean).join("\n");
      sheets = addShot(sheets, beat.id, {
        sceneId: scene.id,
        seconds: shot.seconds,
        size: camera.size ?? "",
        angle: /^eye level/i.test(camera.angle ?? "") ? "Eye level" : (camera.angle ?? ""),
        lens: /^\d+mm$/i.test(camera.lens ?? "") ? camera.lens! : "",
        move: guessMove(camera.movement ?? ""),
        blocking: camera.blocking ?? "",
        action: shot.visual,
        dialogue: shot.dialogue,
        sound: shot.sound,
        characters: [...scene.characters],
        note,
      });
    });
  }
  return sheets;
}

export type MediaInput = Omit<Media, "id" | "shotId"> & { /** 1-based shot number on the board. */ shot?: number };

/**
 * Adds imported media to a project and puts each shot's best footage on it:
 * a take over a still, the last one listed over earlier ones, and never
 * anything marked rejected. Nothing here generates or charges.
 */
export function attachMedia(project: Project, items: MediaInput[]): Project {
  const next = structuredClone(project);
  const media: Media[] = items.map(({ shot, ...item }) => {
    if (shot === undefined) return { ...item, id: crypto.randomUUID() };
    const target = next.shots[shot - 1];
    if (!target) throw new Error(`There is no shot ${shot} on the board for "${item.name}".`);
    return { ...item, id: crypto.randomUUID(), shotId: target.id };
  });
  next.media = [...(next.media ?? []), ...media];
  next.shots.forEach((shot, at) => {
    const usable = media.filter((m) => m.shotId === shot.id && m.status !== "rejected");
    const best = usable.filter((m) => m.kind === "video").at(-1) ?? usable.at(-1);
    if (!best || shot.render) return;
    shot.render = { url: best.url, kind: best.kind, usd: null, promptHash: hashPrompt(promptFor(next, at)), at: Date.now() };
  });
  return next;
}
