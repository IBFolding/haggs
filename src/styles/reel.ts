import { addBoard } from "../story/boards";
import { newShot, type Board, type Project } from "../story/model";
import type { Style } from "./style";

/**
 * A style reel: the same footage redrawn in several looks, one labelled clip
 * per look, as a new board. Rendering it burns each look's name in.
 */
export type StyledClip = { style: Style; url: string; seconds: number; usd: number };

export function addStyleReel(project: Project, name: string, clips: StyledClip[]): { project: Project; board: Board } {
  if (!clips.length) throw new Error("There are no restyled clips to put in a reel.");
  const made = addBoard(project, name, "reel");
  const board: Board = {
    ...made.board,
    shots: clips.map((c) => ({
      ...newShot(),
      heading: c.style.name,
      beat: c.style.says,
      caption: c.style.name,
      seconds: c.seconds,
      render: { url: c.url, kind: "video" as const, usd: c.usd, promptHash: "", at: Date.now() },
    })),
  };
  return { project: { ...made.project, boards: made.project.boards!.map((b) => (b.id === board.id ? board : b)) }, board };
}
