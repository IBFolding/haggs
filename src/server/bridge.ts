import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Project } from "../story/model";
import type { Sheets } from "../sheets/sheets";

/**
 * The bridge between the app in your browser and Claude over MCP.
 *
 * Projects live in the browser. To let Claude read them, the app writes a
 * snapshot of each project here whenever it saves; to let Claude contribute,
 * Claude writes proposals into the project's inbox here, and the app shows
 * them for you to apply or dismiss. Nothing Claude sends changes a project
 * until you say so. It is one folder of JSON files on this machine.
 */

export type Snapshot = { project: Project; sheets: Sheets | null; savedAt?: number };
export type ProposalKind = "draft" | "fill" | "edits" | "board";
export type Proposal = {
  id: string;
  kind: ProposalKind;
  summary: string;
  payload: unknown;
  boardId?: string;
  formatId?: string;
  at: number;
};

const ID = /^[\w-]{1,80}$/;
const KINDS = new Set<ProposalKind>(["draft", "fill", "edits", "board"]);

function projectId(id: string): string {
  if (!ID.test(id)) throw new Error("That project id isn't valid.");
  return id;
}

async function writeAtomic(path: string, body: string) {
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, body);
  await rename(temp, path);
}

export async function writeSnapshot(root: string, snapshot: Snapshot): Promise<void> {
  const id = projectId(snapshot.project.id);
  await mkdir(join(root, "projects"), { recursive: true });
  await writeAtomic(join(root, "projects", `${id}.json`), JSON.stringify({ ...snapshot, savedAt: Date.now() }));
}

export async function readSnapshot(root: string, id: string): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(join(root, "projects", `${projectId(id)}.json`), "utf8")) as Snapshot;
  } catch (caught) {
    if (caught instanceof Error && /project id/.test(caught.message)) throw caught;
    return null;
  }
}

export async function removeSnapshot(root: string, id: string): Promise<void> {
  await rm(join(root, "projects", `${projectId(id)}.json`), { force: true });
}

export async function listSnapshots(root: string): Promise<{ id: string; name: string; savedAt: number; boards: number }[]> {
  let files: string[] = [];
  try {
    files = (await readdir(join(root, "projects"))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    const snap = await readSnapshot(root, file.slice(0, -5)).catch(() => null);
    if (snap) out.push({ id: snap.project.id, name: snap.project.name, savedAt: snap.savedAt ?? 0, boards: snap.project.boards?.length ?? 1 });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export async function propose(root: string, project: string, item: Omit<Proposal, "id" | "at">): Promise<Proposal> {
  const dir = join(root, "inbox", projectId(project));
  if (!KINDS.has(item.kind)) throw new Error("A proposal's kind is draft, fill, edits or board.");
  const made: Proposal = { ...item, id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, at: Date.now() };
  await mkdir(dir, { recursive: true });
  await writeAtomic(join(dir, `${made.id}.json`), JSON.stringify(made));
  return made;
}

export async function inbox(root: string, project: string): Promise<Proposal[]> {
  const dir = join(root, "inbox", projectId(project));
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const items: Proposal[] = [];
  for (const file of files) {
    try {
      items.push(JSON.parse(await readFile(join(dir, file), "utf8")) as Proposal);
    } catch {
      // A half-written file is skipped, not shown.
    }
  }
  return items;
}

export async function dismiss(root: string, project: string, proposalId: string): Promise<void> {
  if (!ID.test(proposalId)) throw new Error("That proposal id isn't valid.");
  await rm(join(root, "inbox", projectId(project), `${proposalId}.json`), { force: true });
}

/** The bridge folder: HAGGS_BRIDGE_DIR, or .haggs/bridge in the app's folder. */
export const bridgeRoot = (base: string) => process.env.HAGGS_BRIDGE_DIR || join(base, ".haggs", "bridge");
