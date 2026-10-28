import { UNFILED, cleanFolder } from "./gallery-folders";
import type { Run } from "./runs";

/** How the Gallery groups what it shows. */
export const GROUP_BY = ["Folder", "Kind", "Model", "None"] as const;
export type GroupBy = (typeof GROUP_BY)[number];

const KIND: Record<Run["kind"], string> = { image: "Images", video: "Video", audio: "Sounds" };

/** Runs in sections, newest section first by its newest run, keeping the order runs came in. Unfiled always comes first. */
export function groupRuns<R extends Pick<Run, "folder" | "kind" | "modelName" | "at">>(runs: R[], by: GroupBy): { name: string; runs: R[] }[] {
  if (by === "None") return runs.length ? [{ name: "Everything", runs }] : [];
  const name = (r: R) => (by === "Folder" ? cleanFolder(r.folder ?? "") ?? UNFILED : by === "Kind" ? KIND[r.kind] : r.modelName.trim() || "Unknown model");
  const groups = new Map<string, R[]>();
  for (const r of runs) {
    const key = name(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const newest = (rs: R[]) => Math.max(...rs.map((r) => r.at));
  return [...groups.entries()]
    .map(([n, rs]) => ({ name: n, runs: rs }))
    .sort((a, b) => (a.name === UNFILED ? -1 : b.name === UNFILED ? 1 : newest(b.runs) - newest(a.runs)));
}

/** Where auto-organise files an unfiled run: by what it is and what made it, such as "Video · Kling 3". */
export const autoFolder = (r: Pick<Run, "kind" | "modelName">): string => cleanFolder(`${KIND[r.kind]} · ${r.modelName.trim() || "Unknown model"}`)!;
