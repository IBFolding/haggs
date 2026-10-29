/**
 * The Scripts shelf in the Gallery: every project that has a script, as one card each, so a script is never more than
 * a click away. Read from what is already saved on this device; nothing here changes a project.
 */

import type { Project } from "../story/model";
import { normalizeSheets, runtime, sheetsView, type Sheets } from "./sheets";

export type ScriptCard = {
  project: string;
  name: string;
  title: string;
  logline: string;
  scenes: number;
  episodes: number;
  characters: number;
  places: number;
  beats: number;
  shots: number;
  seconds: number;
  target: number;
  format: string;
  /** A picture to show on the card: a frame from a board, else a cast or place reference. */
  picture: string | null;
  updatedAt: number;
};

const picture = (project: Project, sheets: Sheets): string | null => {
  for (const board of project.boards ?? []) {
    for (const shot of board.shots) {
      const still = shot.takes?.find((t) => t.kind === "image")?.url ?? (shot.render?.kind === "image" ? shot.render.url : undefined);
      if (still) return still;
    }
  }
  return [...sheets.characters, ...sheets.locations].flatMap((r) => r.refs ?? [])[0] ?? null;
};

/** One project's card, counting beats and shots across every board. Null when it has no script yet. */
export function scriptCard(project: Project, sheets: Sheets | null): ScriptCard | null {
  if (!sheets || !sheets.script.length) return null;
  const boards = project.boards?.length ? project.boards : [{ id: "main", name: project.name }];
  const all = normalizeSheets(sheets, boards[0]!.id);
  const views = boards.map((b) => sheetsView(all, b.id, { title: b.name }));
  return {
    project: project.id,
    name: project.name,
    title: sheets.title || project.name,
    logline: sheets.logline,
    scenes: sheets.script.length,
    episodes: sheets.sources.length,
    characters: sheets.characters.length,
    places: sheets.locations.length,
    beats: views.reduce((n, v) => n + v.story.length, 0),
    shots: views.reduce((n, v) => n + v.shots.length, 0),
    seconds: views.reduce((n, v) => n + runtime(v), 0),
    target: sheets.seconds,
    format: sheets.format,
    picture: picture(project, sheets),
    updatedAt: project.updatedAt,
  };
}

/** Cards newest first, narrowed by a search over title, logline, project, cast and places. */
export function shelf(entries: { project: Project; sheets: Sheets | null }[], query = ""): ScriptCard[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries
    .flatMap(({ project, sheets }) => {
      const card = scriptCard(project, sheets);
      if (!card) return [];
      const hay = [card.title, card.logline, card.name, ...(sheets?.characters.map((c) => c.name) ?? []), ...(sheets?.locations.map((l) => l.name) ?? [])].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w)) ? [card] : [];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
