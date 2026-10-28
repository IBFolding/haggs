import { pick, type Rng } from "../rng";
import type { MatchSpec } from "../spec";
import type { Status } from "./types";

/**
 * Match: a grid of tile kinds. Swapping two neighbours that lines up three or
 * more clears them; tiles above fall, new ones drop in, and any lines that
 * makes clear too, each chain worth more. A swap that lines nothing up is
 * undone and costs no move. A board with no move left is dealt again.
 */

export type Cell = [row: number, col: number];
export type Grid = number[][];

export type MatchState = {
  template: "match";
  rng: Rng;
  t: number;
  status: Status;
  score: number;
  moves: number;
  grid: Grid;
  /** The cells the last swap cleared, for the renderer's pop, and when. */
  popped: Cell[];
  poppedAt: number;
  /** How far each cell fell in the last swap, for the renderer's drop. */
  fell: number[][];
  selected: Cell | null;
};

/** Every cell in a horizontal or vertical run of three or more of the same kind. */
export function findRuns(grid: Grid): Cell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const hit = new Set<string>();
  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      if (c < cols && grid[r]![c] === grid[r]![start] && grid[r]![c]! >= 0) continue;
      if (c - start >= 3 && grid[r]![start]! >= 0) for (let k = start; k < c; k++) hit.add(`${r},${k}`);
      start = c;
    }
  }
  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      if (r < rows && grid[r]![c] === grid[start]![c] && grid[r]![c]! >= 0) continue;
      if (r - start >= 3 && grid[start]![c]! >= 0) for (let k = start; k < r; k++) hit.add(`${k},${c}`);
      start = r;
    }
  }
  return [...hit].map((s) => s.split(",").map(Number) as Cell);
}

const swapIn = (grid: Grid, [ar, ac]: Cell, [br, bc]: Cell) => {
  const t = grid[ar]![ac]!;
  grid[ar]![ac] = grid[br]![bc]!;
  grid[br]![bc] = t;
};

export const adjacent = ([ar, ac]: Cell, [br, bc]: Cell) => Math.abs(ar - br) + Math.abs(ac - bc) === 1;

/** A swap that would line something up, or null when the board is stuck. */
export function findMove(grid: Grid): [Cell, Cell] | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
        const b: Cell = [r + dr, c + dc];
        if (b[0] >= rows || b[1] >= cols) continue;
        swapIn(grid, [r, c], b);
        const works = findRuns(grid).length > 0;
        swapIn(grid, [r, c], b);
        if (works) return [[r, c], b];
      }
    }
  }
  return null;
}

/** A fresh board with no runs already on it and at least one move. */
export function deal(rng: Rng, rows: number, cols: number, kinds: number): Grid {
  for (let attempt = 0; ; attempt++) {
    const grid: Grid = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const banned = new Set<number>();
        if (c >= 2 && row[c - 1] === row[c - 2]) banned.add(row[c - 1]!);
        if (r >= 2 && grid[r - 1]![c] === grid[r - 2]![c]) banned.add(grid[r - 1]![c]!);
        let k = pick(rng, kinds);
        while (banned.has(k)) k = (k + 1) % kinds;
        row.push(k);
      }
      grid.push(row);
    }
    // Three kinds on a small board can, rarely, deal a stuck one; deal again.
    if (findMove(grid) || attempt > 40) return grid;
  }
}

export function initMatch(spec: MatchSpec, seed: number): MatchState {
  const rng = { seed };
  const { rows, cols, kinds, moves } = spec.rules;
  return {
    template: "match", rng, t: 0, status: "playing", score: 0, moves,
    grid: deal(rng, rows, cols, kinds),
    popped: [], poppedAt: -1, fell: Array.from({ length: rows }, () => Array<number>(cols).fill(0)), selected: null,
  };
}

/** Points for clearing `n` tiles on chain `chain` (1 for the swap itself). */
export const points = (n: number, chain: number) => n * 10 * chain + Math.max(0, n - 3) * 10;

export type SwapResult = { ok: boolean; cleared: number; chains: number };

export function swapTiles(spec: MatchSpec, s: MatchState, a: Cell, b: Cell): SwapResult {
  const none = { ok: false, cleared: 0, chains: 0 };
  const { rows, cols, kinds } = spec.rules;
  const inside = ([r, c]: Cell) => r >= 0 && r < rows && c >= 0 && c < cols;
  if (s.status !== "playing" || !inside(a) || !inside(b) || !adjacent(a, b)) return none;
  swapIn(s.grid, a, b);
  let runs = findRuns(s.grid);
  if (!runs.length) {
    swapIn(s.grid, a, b);
    return none;
  }
  s.moves -= 1;
  s.popped = [];
  s.fell = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  let chains = 0;
  let cleared = 0;
  while (runs.length) {
    chains += 1;
    cleared += runs.length;
    s.score += points(runs.length, chains);
    if (chains === 1) s.popped = runs;
    for (const [r, c] of runs) s.grid[r]![c] = -1;
    // Each column falls, and new tiles drop in from above.
    for (let c = 0; c < cols; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (s.grid[r]![c]! < 0) continue;
        if (write !== r) {
          s.grid[write]![c] = s.grid[r]![c]!;
          s.fell[write]![c] = Math.max(s.fell[write]![c]!, write - r);
        }
        write--;
      }
      for (let r = write; r >= 0; r--) {
        s.grid[r]![c] = pick(s.rng, kinds);
        s.fell[r]![c] = write + 1;
      }
    }
    runs = findRuns(s.grid);
  }
  s.poppedAt = s.t;
  s.selected = null;
  if (!findMove(s.grid)) s.grid = deal(s.rng, rows, cols, kinds);
  if (s.score >= spec.rules.target) s.status = "won";
  else if (s.moves <= 0) s.status = "lost";
  return { ok: true, cleared, chains };
}

/** A tap on a cell: select it, swap it with the selected neighbour, or move the selection. */
export function tapCell(spec: MatchSpec, s: MatchState, cell: Cell): SwapResult | null {
  if (s.status !== "playing") return null;
  const picked = s.selected;
  if (!picked) {
    s.selected = cell;
    return null;
  }
  if (picked[0] === cell[0] && picked[1] === cell[1]) {
    s.selected = null;
    return null;
  }
  if (!adjacent(picked, cell)) {
    s.selected = cell;
    return null;
  }
  const result = swapTiles(spec, s, picked, cell);
  s.selected = null;
  return result;
}

export function stepMatch(_spec: MatchSpec, s: MatchState, dt: number): MatchState {
  s.t += Math.min(dt, 1 / 20);
  return s;
}

export function matchHud(spec: MatchSpec, s: MatchState): string[] {
  return [`${s.score} / ${spec.rules.target}`, `${s.moves} moves`];
}
