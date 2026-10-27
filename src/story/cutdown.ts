import { addBoard, commit } from "./boards";
import { offsetReframe } from "./reframe";
import { buildCut } from "./cut";
import type { Board, Project } from "./model";

const round = (n: number) => Math.round(n * 1000) / 1000;
const MIN = 0.2;

/**
 * A window of the cut, from `from` to `to` seconds, as its own project view:
 * the shots that fall inside (the edge ones trimmed to the window), and the
 * effects, markers and titles moved to match. The music runs from its start.
 */
export function cutdown(project: Project, from: number, to: number): Project {
  const cut = buildCut(project);
  if (!(to - from >= MIN)) throw new Error(`Pick a window at least ${MIN}s long.`);
  const lo = Math.max(0, from);
  const hi = Math.min(cut.total, to);
  const shots = [];
  for (const clip of cut.clips) {
    const a = Math.max(lo, clip.start);
    const b = Math.min(hi, clip.start + clip.seconds);
    if (b - a < MIN) continue;
    const shot = project.shots.find((s) => s.id === clip.shotId);
    if (!shot) continue;
    const head = round(a - clip.start);
    const length = round(b - a);
    const { fadeIn, fadeOut, ...rest } = shot;
    shots.push({
      ...rest,
      id: crypto.randomUUID(),
      seconds: length,
      ...(shot.reframe ? {reframe:offsetReframe(shot.reframe,head)} : {}),
      ...(clip.from + head > 0 ? { trimIn: round(clip.from + head) } : {}),
      // Fades belong to the clip's own ends: keep one only if its end survived.
      ...(head === 0 && fadeIn ? { fadeIn } : {}),
      ...(round(clip.start + clip.seconds) <= round(hi) && fadeOut ? { fadeOut } : {}),
      voices: (shot.voices ?? []).flatMap((v) => {
        const offset = round(v.offset - head);
        return offset >= 0 && offset < length ? [{ ...v, offset }] : [];
      }),
    });
  }
  if (!shots.length) throw new Error("There is no footage in that window.");
  const length = round(Math.min(hi, cut.total) - lo);
  const move = <T extends { start: number }>(items: T[] | undefined) =>
    (items ?? []).flatMap((x) => (x.start >= lo - 1e-6 && x.start < lo + length ? [{ ...x, start: round(x.start - lo) }] : []));
  const next: Project = { ...project, shots };
  const effects = move(project.effects);
  const overlays = move(project.overlays);
  const markers = (project.markers ?? []).flatMap((m) => (m.at >= lo && m.at <= lo + length ? [{ ...m, at: round(m.at - lo) }] : []));
  delete next.effects;
  delete next.overlays;
  delete next.markers;
  return { ...next, ...(effects.length ? { effects } : {}), ...(overlays.length ? { overlays } : {}), ...(markers.length ? { markers } : {}) };
}

/** Put a cutdown on a new board of the same project, ready to open in the editor. */
export function addCutdown(full: Project, boardId: string | undefined, seen: Project, name: string, from: number, to: number): { project: Project; board: Board } {
  const window = cutdown(seen, from, to);
  const made = addBoard(full, name, "board");
  return { project: commit(made.project, made.board.id, window), board: made.board };
}
