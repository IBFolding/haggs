import type { Marker, Project } from "./model";

/** Review markers: notes at moments on the timeline, so a cut can be walked through and fixed note by note. */

const round = (n: number) => Math.round(n * 10) / 10;

export function addMarker(project: Project, at: number, text: string, total: number): Project {
  if (!(at >= 0) || !Number.isFinite(at)) throw new Error("A marker goes inside the cut.");
  const marker: Marker = { id: crypto.randomUUID(), at: round(Math.min(at, total)), text: text.trim().slice(0, 200) };
  return { ...project, markers: [...(project.markers ?? []), marker].sort((a, b) => a.at - b.at) };
}

export function editMarker(project: Project, id: string, text: string): Project {
  return { ...project, markers: (project.markers ?? []).map((m) => (m.id === id ? { ...m, text: text.trim().slice(0, 200) } : m)) };
}

export function removeMarker(project: Project, id: string): Project {
  const left = (project.markers ?? []).filter((m) => m.id !== id);
  const { markers: _gone, ...rest } = project;
  return left.length ? { ...rest, markers: left } : rest;
}

/** The time of the next (1) or previous (-1) marker, or null when there isn't one. */
export function stepMarker(project: Project, from: number, dir: 1 | -1): number | null {
  const marks = (project.markers ?? []).map((m) => m.at);
  const found = dir === 1 ? marks.find((t) => t > from + 0.05) : [...marks].reverse().find((t) => t < from - 0.05);
  return found ?? null;
}
