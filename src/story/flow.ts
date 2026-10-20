import type { Project, Shot, Thread } from "./model";

/**
 * The board as a flow chart: the story runs left to right in shot order, and
 * each subplot gets its own lane, so a shot that belongs to the B plot sits
 * below the main line and the story line visibly dips into it and back.
 * Characters are threads too, but they are drawn as links between the shots
 * they appear in, not as lanes — a character crosses every plot.
 */

export type Lane = { id: string | null; name: string; color: string };
export type Node = { id: string; col: number; lane: number };
export type Edge = { from: string; to: string };
export type ThreadEdge = Edge & { thread: string; color: string };

const PLOT_COLORS = ["#7dd3fc", "#f5c451", "#f9a8d4", "#a78bfa", "#34d399", "#fb923c"];

export function lanes(project: Project): Lane[] {
  return [
    { id: null, name: "Main story", color: "#d4f83a" },
    ...project.threads.filter((t) => t.kind === "plot").map((t) => ({ id: t.id, name: t.name, color: t.color })),
  ];
}

export function laneOf(project: Project, shot: Shot): string | null {
  const plots = new Set(project.threads.filter((t) => t.kind === "plot").map((t) => t.id));
  return shot.threadIds.find((id) => plots.has(id)) ?? null;
}

export function layout(project: Project): { nodes: Node[]; story: Edge[]; threads: ThreadEdge[] } {
  const order = lanes(project).map((l) => l.id);
  const nodes = project.shots.map((s, col) => ({ id: s.id, col, lane: Math.max(0, order.indexOf(laneOf(project, s))) }));
  const story = project.shots.slice(1).map((s, i) => ({ from: project.shots[i]!.id, to: s.id }));
  // Plots first so their links sit under the character links when drawn.
  const ordered = [...project.threads].sort((a, b) => Number(a.kind !== "plot") - Number(b.kind !== "plot"));
  const threads: ThreadEdge[] = [];
  for (const thread of ordered) {
    const own = project.shots.filter((s) => s.threadIds.includes(thread.id));
    for (let i = 1; i < own.length; i++) threads.push({ from: own[i - 1]!.id, to: own[i]!.id, thread: thread.id, color: thread.color });
  }
  return { nodes, story, threads };
}

/** Drops a shot at a story position and into a lane (null for the main story). */
export function placeShot(project: Project, shotId: string, col: number, lane: string | null): Project {
  const from = project.shots.findIndex((s) => s.id === shotId);
  if (from < 0) throw new Error("That shot is not on the board any more.");
  const plots = new Set(project.threads.filter((t) => t.kind === "plot").map((t) => t.id));
  const shots = [...project.shots];
  const [moved] = shots.splice(from, 1);
  const threadIds = [...moved!.threadIds.filter((id) => !plots.has(id)), ...(lane ? [lane] : [])];
  shots.splice(Math.max(0, Math.min(shots.length, col)), 0, { ...moved!, threadIds });
  return { ...project, shots };
}

export function addSubplot(project: Project, name: string): Project {
  if (!name.trim()) throw new Error("Give the subplot a name.");
  const count = project.threads.filter((t) => t.kind === "plot").length;
  const thread: Thread = { id: "plot-" + crypto.randomUUID().slice(0, 8), name: name.trim(), color: PLOT_COLORS[count % PLOT_COLORS.length]!, kind: "plot" };
  return { ...project, threads: [...project.threads, thread] };
}
