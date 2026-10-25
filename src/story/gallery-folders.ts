import type { Run } from "./runs";

/** Folders are names on runs: moving a run into a new name makes the folder, and a folder with nothing in it goes away. */

export const ALL = "All";
export const UNFILED = "Unfiled";

export const cleanFolder = (name: string): string | null => {
  const t = name.replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return t || null;
};

export const folderNames = (runs: Pick<Run, "folder">[]): string[] =>
  [...new Set(runs.map((r) => cleanFolder(r.folder ?? "")).filter((n): n is string => n !== null))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

export const inFolder = (run: Pick<Run, "folder">, folder: string): boolean =>
  folder === ALL ? true : folder === UNFILED ? !cleanFolder(run.folder ?? "") : cleanFolder(run.folder ?? "") === folder;
