import type { Board, Project } from "./model";

/**
 * A project holds several boards — a sizzle, each episode — that share one
 * cast, one set of places and one media library.
 *
 * Everything that works on a board (prompt assembly, staleness, the cut, the
 * sheets hand-off) was written against a project with one list of shots. A
 * view keeps all of that unchanged: it is the project as one board sees it,
 * and commit writes the board's part back without touching the others.
 */

/** Moves a pre-boards project's shots onto a board named Main. Idempotent. */
export function normalize(project: Project): Project {
  if (project.boards?.length) return project.shots.length || project.notes.length ? { ...project, shots: [], notes: [] } : project;
  const main: Board = { id: "main", name: "Main", kind: "board", shots: project.shots, notes: project.notes };
  return { ...project, boards: [main], shots: [], notes: [] };
}

export function boardOf(project: Project, boardId?: string | null): Board {
  const boards = normalize(project).boards!;
  return boards.find((b) => b.id === boardId) ?? boards[0]!;
}

/** The project with this board's shots and notes in the places board code reads them. */
export function view(project: Project, boardId?: string | null): Project {
  const board = boardOf(project, boardId);
  const { music: _project, aspect: _shape, ...base } = normalize(project);
  return { ...base, shots: board.shots, notes: board.notes, ...(board.music ? { music: board.music } : {}), ...(board.aspect ? { aspect: board.aspect } : {}) };
}

/** Writes a view back: its shots and notes to the board, everything else to the project. */
export function commit(project: Project, boardId: string | null | undefined, seen: Project): Project {
  const base = normalize(project);
  const target = boardOf(base, boardId).id;
  const { music, aspect, ...rest } = seen;
  return {
    ...rest,
    shots: [],
    notes: [],
    boards: base.boards!.map((b) => {
      if (b.id !== target) return b;
      const { music: _old, aspect: _oldShape, ...kept } = b;
      return { ...kept, shots: seen.shots, notes: seen.notes, ...(music ? { music } : {}), ...(aspect ? { aspect } : {}) };
    }),
  };
}

export function addBoard(project: Project, name: string, kind: Board["kind"]): { project: Project; board: Board } {
  if (!name.trim()) throw new Error("Give the board a name.");
  const base = normalize(project);
  const board: Board = { id: crypto.randomUUID(), name: name.trim(), kind, shots: [], notes: [] };
  return { project: { ...base, boards: [...base.boards!, board] }, board };
}

export function renameBoard(project: Project, boardId: string, name: string): Project {
  const base = normalize(project);
  return { ...base, boards: base.boards!.map((b) => (b.id === boardId ? { ...b, name } : b)) };
}

export function removeBoard(project: Project, boardId: string): Project {
  const base = normalize(project);
  if (base.boards!.length === 1) throw new Error("A project keeps at least one board. This is the last board.");
  return { ...base, boards: base.boards!.filter((b) => b.id !== boardId) };
}
