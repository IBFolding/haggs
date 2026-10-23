import { summarize, type Project, type ProjectSummary } from "./model";
import type { Sheets } from "../sheets/sheets";

/**
 * Browser storage can start over (a new profile, cleared site data) while
 * the copy the app keeps on disk in development survives. These decide what
 * to offer back and how to put it back.
 */

export type OnDisk = { id: string; name: string; savedAt: number; boards: number; shots: number };

/** Disk copies the browser doesn't have, and that have something in them. */
export function backupsToOffer(here: { id: string }[], disk: OnDisk[]): OnDisk[] {
  const have = new Set(here.map((p) => p.id));
  return disk.filter((d) => !have.has(d.id) && d.shots > 0);
}

export function toRestore(snapshot: { project: Project; sheets: Sheets | null; savedAt?: number }): { project: Project; sheets: Sheets | null; summary: ProjectSummary } {
  const p = snapshot?.project;
  if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.shots)) throw new Error("That backup isn't a project.");
  return { project: p, sheets: snapshot.sheets ?? null, summary: summarize(p) };
}
