import { staleShots } from "./assemble";
import { view } from "./boards";
import type { Project } from "./model";

/**
 * The one thing to do next on a board, for the NEXT button in the project bar.
 * It reads the board as it is: no shots means write them, pictures that no
 * longer match their words come before new work, then pictures, then motion,
 * then the cut.
 */

export type Stage = "sheets" | "board" | "cut" | "media";
export type NextStep = { label: string; tab: Stage };
export type Progress = Record<Stage, boolean>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function nextStep(project: Project, boardId?: string | null): NextStep {
  const p = view(project, boardId);
  const shots = p.shots;
  if (!shots.length) return { label: "Write the shots", tab: "sheets" };
  const stale = staleShots(p).length;
  if (stale) return { label: `Remake ${plural(stale, "stale shot")}`, tab: "board" };
  const bare = shots.filter((s) => !s.render).length;
  if (bare) return { label: `Make ${plural(bare, "picture")}`, tab: "board" };
  const still = shots.filter((s) => s.render?.kind === "image" && !s.locked).length;
  if (still) return { label: `Animate ${plural(still, "shot")}`, tab: "board" };
  return { label: "Cut and render", tab: "cut" };
}

/** Which stages of the board already have something in them, for the marks on the project tabs. */
export function progress(project: Project, boardId?: string | null): Progress {
  const shots = view(project, boardId).shots;
  const made = shots.filter((s) => s.render);
  return {
    sheets: shots.length > 0,
    board: shots.length > 0 && made.length === shots.length,
    cut: shots.length > 0 && made.length === shots.length && made.every((s) => s.render!.kind === "video" || s.locked),
    media: made.length > 0,
  };
}
