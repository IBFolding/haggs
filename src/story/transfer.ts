import { importSheets, type Sheets } from "../sheets/sheets";
import { normalize } from "./boards";
import type { Direction, Media, Note, Project, Shot, Thread } from "./model";

/**
 * A project leaves as one readable file and comes back as a new project.
 *
 * Readable is a requirement, not a nicety: the argument for this app over a
 * hosted studio is that you can open what it produces, read it, diff it and
 * fix it. A format you need a tool to inspect would give that up.
 */

export const PROJECT_FORMAT = "haggs.project/1";

export class TransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferError";
  }
}

type Envelope = {
  format: string;
  exportedAt: number;
  project: Project;
  /** The project's script sheets, when it has any. Older files simply lack it. */
  sheets?: Sheets;
};

export function exportProject(project: Project, sheets?: Sheets): string {
  const envelope: Envelope = {
    format: PROJECT_FORMAT,
    exportedAt: Date.now(),
    project,
    ...(sheets ? { sheets } : {}),
  };
  return JSON.stringify(envelope, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function importProject(json: string): Project {
  return importBundle(json).project;
}

/** A project and, if the file carries them, its sheets. */
export function importBundle(json: string): { project: Project; sheets?: Sheets } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new TransferError("That file isn't valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new TransferError("That file isn't a haggs project.");
  }

  if (parsed.format !== PROJECT_FORMAT) {
    const found = typeof parsed.format === "string" ? parsed.format : "none";
    throw new TransferError(
      `That file is in an unrecognised format (expected ${PROJECT_FORMAT}, found ${found}).`,
    );
  }

  const project = parsed.project;
  if (!isRecord(project) || typeof project.name !== "string" || !project.name.trim()) {
    throw new TransferError("That project file is missing its name.");
  }

  // Array-ness alone let `shots: [null]` and `direction: "nope"` onto disk,
  // where they read back as a crash in whatever opens the project next — and
  // that crash would look like a bug in the canvas, not in this import.
  for (const field of ["shots", "threads", "notes"] as const) {
    const value = project[field];
    if (!Array.isArray(value)) {
      throw new TransferError(`That project file is missing its ${field}.`);
    }
    if (!value.every((entry) => isRecord(entry) && typeof entry.id === "string")) {
      throw new TransferError(`That project file has damaged ${field}.`);
    }
  }

  if (project.direction !== undefined && project.direction !== null && !isRecord(project.direction)) {
    throw new TransferError("That project file has a damaged direction.");
  }

  if (
    project.media !== undefined &&
    (!Array.isArray(project.media) ||
      !project.media.every((m) => isRecord(m) && typeof m.id === "string" && typeof m.url === "string" && (m.kind === "image" || m.kind === "video")))
  ) {
    throw new TransferError("That project file has damaged media.");
  }

  if (
    project.boards !== undefined &&
    (!Array.isArray(project.boards) ||
      !project.boards.every((b) => isRecord(b) && typeof b.id === "string" && Array.isArray(b.shots) && Array.isArray(b.notes)))
  ) {
    throw new TransferError("That project file has damaged boards.");
  }

  let sheets: Sheets | undefined;
  if (parsed.sheets !== undefined) {
    try {
      sheets = importSheets(JSON.stringify(parsed.sheets));
    } catch {
      throw new TransferError("That project file has damaged sheets.");
    }
  }

  // A fresh id and fresh timestamps, so importing a file you already have adds
  // a second project rather than silently overwriting the first.
  const now = Date.now();
  const imported: Project = {
    ...(project as unknown as Project),
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    shots: project.shots as Shot[],
    threads: project.threads as Thread[],
    notes: project.notes as Note[],
    direction: (project.direction ?? {
      camera: "",
      light: "",
      staging: "",
      constants: "",
    }) as Direction,
    ...(project.media ? { media: project.media as Media[] } : {}),
  };
  const ready = normalize(imported);
  return sheets ? { project: ready, sheets } : { project: ready };
}
