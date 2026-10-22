import { clipSeconds } from "./cut";
import { newShot, type Project, type Shot } from "./model";

/**
 * Expanding a scene: a new shot made between two others, starting on the
 * last frame you see of one and ending on the first frame you see of the
 * next, so it splices in exactly where it goes. Extending is the same with
 * no end frame: the shot simply carries on.
 */

export type Frame = { url: string; kind: "image" | "video"; at: number };

export function bridgeFrames(project: Project, shotId: string, mode: "bridge" | "extend"): { start: Frame; end: Frame | null; insertAt: number; nextBeat: string | null } {
  const at = project.shots.findIndex((s) => s.id === shotId);
  const shot = project.shots[at];
  if (!shot) throw new Error("That shot is not on the board any more.");
  if (!shot.render) throw new Error("This shot has nothing to show yet, so there's no frame to start from.");
  const from = shot.trimIn ?? 0;
  // A hair before the end, so the frame is one that really plays.
  const start: Frame = shot.render.kind === "video" ? { url: shot.render.url, kind: "video", at: Math.round((from + clipSeconds(shot) - 0.05) * 1000) / 1000 } : { url: shot.render.url, kind: "image", at: 0 };
  if (mode === "extend") return { start, end: null, insertAt: at + 1, nextBeat: null };
  const next = project.shots.slice(at + 1).find((s) => s.render);
  if (!next) throw new Error("There's no shot after this one to bridge to.");
  const end: Frame = { url: next.render!.url, kind: next.render!.kind, at: next.render!.kind === "video" ? (next.trimIn ?? 0) : 0 };
  return { start, end, insertAt: at + 1, nextBeat: next.beat || next.heading || null };
}

const cut = (s: string) => (s.split(" — ")[0] ?? s).slice(0, 80);

export function bridgingShot(from: Shot, start: { url: string }, end: { url: string } | null, nextBeat?: string | null): Shot {
  return {
    ...newShot(),
    heading: from.heading,
    beat: end ? `Bridge: from ${cut(from.beat || "the shot before")} into ${cut(nextBeat || "the next shot")}. One continuous move, nothing new appears.` : `${cut(from.beat || "The shot")} continues: the same moment carries on, same people, same place, same light.`,
    threadIds: [...from.threadIds],
    seconds: 4,
    model: { id: "minimax/minimax-h3", settings: { resolution: "768P" } },
    render: { url: start.url, kind: "image", usd: null, promptHash: "", at: Date.now() },
    ...(end ? { endsOn: end.url } : {}),
    ...(from.refs?.length ? { refs: [...from.refs] } : {}),
  };
}
