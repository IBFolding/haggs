import { hashPrompt, promptFor } from "./assemble";
import { addBoard, view } from "./boards";
import { newShot, type Board, type Project, type Shot } from "./model";

/**
 * A whole board sent by Claude over MCP: shots in order, each either reusing
 * a shot the project already has (with every take it has had) or starting
 * from a picture. It lands as a new board, so nothing already there changes.
 */

export type ProposedShot = {
  beat: string;
  seconds: number;
  heading?: string;
  /** A shot on any board of this project to reuse, takes and references included. */
  from?: string;
  /** A picture or take to start this shot from. */
  picture?: { url: string; kind: "image" | "video"; origin?: string };
  /** A line spoken over the shot: "ELLIS: Stop counting." */
  dialogue?: string;
};
export type BoardProposal = { name: string; kind?: Board["kind"]; shots: ProposedShot[] };

// Pictures come from this machine's media folder or a web address, never script URLs.
const PICTURE = /^(\/api\/local\/|https:\/\/)/;

export function validateBoardProposal(raw: unknown): BoardProposal {
  const p = raw as Partial<BoardProposal> | null;
  const name = typeof p?.name === "string" ? p.name.trim() : "";
  if (!name || name.length > 80) throw new Error("Give the board a name of up to 80 characters.");
  if (!Array.isArray(p?.shots) || p.shots.length < 1 || p.shots.length > 200) throw new Error("A board proposal has 1–200 shots.");
  const shots = p.shots.map((s, i): ProposedShot => {
    const n = `Shot ${i + 1}`;
    if (typeof s?.beat !== "string" || !s.beat.trim()) throw new Error(`${n} needs a beat.`);
    if (typeof s.seconds !== "number" || !(s.seconds >= 0.5 && s.seconds <= 60)) throw new Error(`${n} needs 0.5–60 seconds.`);
    if (s.picture && (typeof s.picture.url !== "string" || !PICTURE.test(s.picture.url) || !["image", "video"].includes(s.picture.kind))) throw new Error(`${n}'s picture must be an image or video on this machine or an https link.`);
    return {
      beat: s.beat.trim(),
      seconds: s.seconds,
      ...(typeof s.heading === "string" && s.heading.trim() ? { heading: s.heading.trim() } : {}),
      ...(typeof s.from === "string" && s.from ? { from: s.from } : {}),
      ...(s.picture ? { picture: { url: s.picture.url, kind: s.picture.kind, ...(s.picture.origin ? { origin: String(s.picture.origin) } : {}) } } : {}),
      ...(typeof s.dialogue === "string" && s.dialogue.trim() ? { dialogue: s.dialogue.trim() } : {}),
    };
  });
  return { name, kind: p.kind === "episode" || p.kind === "board" ? p.kind : "reel", shots };
}

export function applyBoardProposal(project: Project, proposal: BoardProposal): { project: Project; board: Board } {
  const made = addBoard(project, proposal.name, proposal.kind ?? "reel");
  const everyShot = new Map(made.project.boards!.flatMap((b) => b.shots.map((s) => [s.id, s] as const)));
  const pictured = new Set<number>();
  const shots: Shot[] = proposal.shots.map((p, i) => {
    let shot: Shot;
    if (p.from) {
      const source = everyShot.get(p.from);
      if (!source) throw new Error(`Shot ${i + 1} reuses a shot, but this project has no shot ${p.from}.`);
      const { sheetShotId: _row, ...rest } = structuredClone(source);
      shot = { ...rest, id: crypto.randomUUID() };
    } else {
      shot = newShot();
    }
    shot.beat = p.dialogue ? `${p.beat} — ${p.dialogue}` : p.beat;
    shot.seconds = p.seconds;
    if (p.heading) shot.heading = p.heading;
    if (p.picture) {
      const take = { id: "take-" + crypto.randomUUID().slice(0, 8), url: p.picture.url, kind: p.picture.kind, usd: null, promptHash: "", at: Date.now(), ...(p.picture.origin ? { origin: p.picture.origin } : {}) };
      shot.takes = [...(shot.takes ?? (shot.render ? [{ id: "take-first", ...shot.render }] : [])), take];
      pictured.add(i);
    }
    return shot;
  });
  const board: Board = { ...made.board, shots };
  let next: Project = { ...made.project, boards: made.project.boards!.map((b) => (b.id === board.id ? board : b)) };
  // What each shot shows was chosen for this board, so it is stamped with the
  // prompt it will be judged against here; only later changes make it stale.
  const seen = view(next, board.id);
  shots.forEach((shot, i) => {
    const hash = hashPrompt(promptFor(seen, i));
    if (pictured.has(i)) {
      shot.takes = shot.takes!.map((t, at) => (at === shot.takes!.length - 1 ? { ...t, promptHash: hash } : t));
      const t = shot.takes.at(-1)!;
      shot.render = { url: t.url, kind: t.kind, usd: null, promptHash: hash, at: t.at };
    } else if (shot.render) {
      shot.render = { ...shot.render, promptHash: hash };
    }
  });
  next = { ...next, boards: next.boards!.map((b) => (b.id === board.id ? { ...board, shots } : b)) };
  return { project: next, board: next.boards!.find((b) => b.id === board.id)! };
}
