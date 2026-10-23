import type { Sheets } from "../sheets/sheets";
import { normalize } from "./boards";
import { createProject, newShot, type Media, type Project } from "./model";
import { applyTakes } from "./proposed-takes";
import type { Run } from "./runs";

/**
 * Save to project: a picture or clip made in Create or Video goes to work in
 * a project, as a take on a shot, a new shot, a character's or a place's
 * reference, or kept in Media. Whatever the choice, it is also in Media, so
 * there is one place that lists everything a project was made from.
 */

export type SaveTarget =
  | { as: "take"; boardId: string; shotId: string }
  | { as: "new-shot"; boardId: string }
  | { as: "character"; id: string; face?: boolean }
  | { as: "place"; id: string; face?: boolean }
  | { as: "media" };

const origin = (run: Run) => `${run.modelName}, made in ${run.kind === "video" ? "Video" : "Create"}`;

function inMedia(project: Project, run: Run, status: Media["status"], shotId?: string): Project {
  if ((project.media ?? []).some((m) => m.url === run.url)) return project;
  const item: Media = { id: crypto.randomUUID(), url: run.url, kind: run.kind, name: run.prompt.slice(0, 60) || run.modelName, origin: origin(run), status, note: "", ...(shotId ? { shotId } : {}) };
  return { ...project, media: [...(project.media ?? []), item] };
}

export function saveRun(project: Project, sheets: Sheets | null, run: Run, target: SaveTarget): { project: Project; sheets: Sheets | null; message: string } {
  const base = normalize(project);
  switch (target.as) {
    case "media":
      return { project: inMedia(base, run, "review"), sheets, message: "Kept in Media." };
    case "take": {
      const board = base.boards!.find((b) => b.id === target.boardId);
      const { project: next } = applyTakes(base, { board: target.boardId, takes: [{ shot: target.shotId, url: run.url, kind: run.kind, origin: origin(run), ...(run.usd !== null ? { usd: run.usd } : {}) }] });
      const n = board!.shots.findIndex((s) => s.id === target.shotId) + 1;
      return { project: inMedia(next, run, "approved", target.shotId), sheets, message: `Put on shot ${n} as a take on ${board!.name}.` };
    }
    case "new-shot": {
      const board = base.boards!.find((b) => b.id === target.boardId);
      if (!board) throw new Error("That board isn't in this project any more.");
      const shot = { ...newShot(), beat: run.prompt.slice(0, 200), seconds: run.kind === "video" ? 4 : 3 };
      const grown = { ...base, boards: base.boards!.map((b) => (b.id === board.id ? { ...b, shots: [...b.shots, shot] } : b)) };
      const { project: next } = applyTakes(grown, { board: board.id, takes: [{ shot: shot.id, url: run.url, kind: run.kind, origin: origin(run), ...(run.usd !== null ? { usd: run.usd } : {}) }] });
      return { project: inMedia(next, run, "approved", shot.id), sheets, message: `Started shot ${board.shots.length + 1} on ${board.name} from it.` };
    }
    case "character":
    case "place": {
      if (!sheets) throw new Error("This project has no sheets yet, so it has no characters or places to give a reference to.");
      const key = target.as === "character" ? "characters" : "locations";
      const rows = sheets[key] as { id: string; name: string; refs?: string[] }[];
      const row = rows.find((r) => r.id === target.id);
      if (!row) throw new Error(`${target.id} isn't on the sheets any more.`);
      const others = (row.refs ?? []).filter((u) => u !== run.url);
      if (others.length >= 8) throw new Error(`${row.name} already has eight references. Remove one on the sheets first.`);
      const refs = target.face ? [run.url, ...others] : [...others, run.url];
      const next = { ...sheets, [key]: rows.map((r) => (r.id === row.id ? { ...r, refs } : r)) } as Sheets;
      const what = target.as === "character" ? (target.face ? "face" : "reference") : (target.face ? "main reference" : "reference");
      return { project: inMedia(base, run, "reference"), sheets: next, message: `Saved as ${row.name}'s ${what}. ${target.as === "character" ? "Every shot they're in sends it." : "Every shot there sends it."}` };
    }
  }
}

/** A new project started from one picture or clip: one board, its first shot showing it, named after the prompt. */
export function projectFrom(run: Run): Project {
  const name = (run.prompt.split(/[,.;\n]/)[0] ?? "").trim().slice(0, 60) || "New project";
  const shot = { ...newShot(), beat: run.prompt.slice(0, 200), seconds: run.kind === "video" ? 4 : 3, render: { url: run.url, kind: run.kind, usd: run.usd, promptHash: "", at: run.at } };
  const base = createProject(name);
  return inMedia({ ...base, boards: [{ id: crypto.randomUUID(), name: "Main", kind: "board", shots: [shot], notes: [] }] }, run, "approved", shot.id);
}
