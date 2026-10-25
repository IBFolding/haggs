import { createProject, newShot, type Board, type Media, type Note, type Project, type Shot } from "./model";
import { membersOf, type Layout } from "./workspace";

/**
 * Starts a project from a workspace and puts everything where it belongs: each
 * group is a board, the loose pictures go on Main, notes sit on the board they
 * were next to, and reference pictures go to Media as references, not shots.
 */

export type WorkPicture = { id: string; src: string; kind: "image" | "video"; prompt?: string; usd?: number | null; at?: number; reference?: boolean };

const ROW = 120;

/** Reading order: rows from the top, left to right inside a row. */
function reading(layout: Layout, ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const pa = layout.cards[a]!;
    const pb = layout.cards[b]!;
    const ra = Math.round(pa.y / ROW);
    const rb = Math.round(pb.y / ROW);
    return ra - rb || pa.x - pb.x;
  });
}

export function projectFromWorkspace(name: string, layout: Layout, pictures: WorkPicture[]): Project | null {
  const byId = new Map(pictures.map((p) => [p.id, p]));
  const placed = pictures.filter((p) => layout.cards[p.id]);
  if (placed.length === 0) return null;

  const media: Media[] = [];
  const shotFor = (pic: WorkPicture, at: number): Shot => {
    const shot: Shot = {
      ...newShot(),
      beat: (pic.prompt ?? "").slice(0, 200),
      seconds: pic.kind === "video" ? 4 : 3,
      render: { url: pic.src, kind: pic.kind, usd: pic.usd ?? null, promptHash: "", at: pic.at ?? at },
    };
    media.push({ id: crypto.randomUUID(), url: pic.src, kind: pic.kind, name: (pic.prompt ?? "").slice(0, 60) || "Workspace picture", origin: "Workspace", status: "approved", note: "", shotId: shot.id });
    return shot;
  };

  // References are for the cast and the look; they live in Media, not on the board.
  for (const r of placed.filter((p) => p.reference)) {
    media.push({ id: crypto.randomUUID(), url: r.src, kind: r.kind, name: (r.prompt ?? "").slice(0, 60) || "Reference", origin: "Workspace", status: "reference", note: "" });
  }
  const shotsIds = placed.filter((p) => !p.reference).map((p) => p.id);

  const now = Date.now();
  const taken = new Set<string>();
  const unique = (raw: string) => {
    const base = raw.trim().slice(0, 60) || "Group";
    let n = base;
    for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${base} ${i}`;
    taken.add(n.toLowerCase());
    return n;
  };

  const inGroup = new Set<string>();
  const boards: Board[] = [];
  for (const f of layout.frames) {
    const ids = reading(layout, membersOf(layout, f.id).filter((id) => shotsIds.includes(id) && !inGroup.has(id)));
    ids.forEach((id) => inGroup.add(id));
    const notes: Note[] = layout.notes
      .filter((n) => n.x + 100 >= f.x && n.x + 100 <= f.x + f.w && n.y + 60 >= f.y && n.y + 60 <= f.y + f.h)
      .map((n) => ({ id: crypto.randomUUID(), text: n.text, x: Math.round(n.x - f.x), y: Math.round(n.y - f.y) }));
    boards.push({ id: crypto.randomUUID(), name: unique(f.name), kind: "board", shots: ids.map((id) => shotFor(byId.get(id)!, now)), notes });
  }

  const loose = reading(layout, shotsIds.filter((id) => !inGroup.has(id)));
  const keptNotes = new Set(boards.flatMap((b) => b.notes.map((n) => n.text + n.x + n.y)));
  const looseNotes: Note[] = layout.notes
    .filter((n) => !layout.frames.some((f) => n.x + 100 >= f.x && n.x + 100 <= f.x + f.w && n.y + 60 >= f.y && n.y + 60 <= f.y + f.h))
    .map((n) => ({ id: crypto.randomUUID(), text: n.text, x: Math.round(n.x), y: Math.round(n.y) }))
    .filter((n) => !keptNotes.has(n.text + n.x + n.y));
  if (loose.length > 0 || looseNotes.length > 0 || boards.length === 0) {
    boards.push({ id: crypto.randomUUID(), name: unique("Main"), kind: "board", shots: loose.map((id) => shotFor(byId.get(id)!, now)), notes: looseNotes });
  }

  return { ...createProject(name.trim().slice(0, 60) || "Workspace"), boards, media };
}
