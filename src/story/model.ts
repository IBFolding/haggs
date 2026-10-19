import type { AspectRatio } from "../providers/types";

/**
 * The craft constants that hold a set together — the same shape `direction`
 * takes on a product-photoshoot mode, promoted here because the storyboard
 * needs it too. A shot may override any of it; what it does not override, it
 * inherits from the project.
 */
export type Direction = {
  camera: string;
  light: string;
  staging: string;
  /** Held constant across the set, so variants read as one piece of work. */
  constants: string;
};

export type Thread = {
  id: string;
  name: string;
  color: string;
  kind: "character" | "plot" | "motif";
};

/** A free-floating annotation. Deliberately not part of the story order. */
export type Note = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type Shot = {
  id: string;
  /** "INT. ALLEY — NIGHT" */
  heading: string;
  /** One sentence: what happens. */
  beat: string;
  threadIds: string[];
  seconds: number | null;
  model: { id: string; ratio: AspectRatio; count: number };
  direction?: Partial<Direction>;
  render?: {
    url: string;
    kind: "image" | "video";
    usd: number | null;
    /**
     * The hash of the prompt this media was actually made from. A shot is stale
     * exactly when this disagrees with the prompt assembled now, so staleness
     * needs no flag of its own and cannot drift out of sync.
     */
    promptHash: string;
    at: number;
  };
  /** Excluded from reorder recompute, so a finished shot stays finished. */
  locked?: boolean;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Array order IS story order. There is deliberately no rank field. */
  shots: Shot[];
  threads: Thread[];
  notes: Note[];
  direction: Direction;
  slotValues?: Record<string, string>;
  source?: { templateId: string; name: string; author?: string };
};

/** What the library list needs, without loading every project in full. */
export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
  shotCount: number;
};

const EMPTY_DIRECTION: Direction = {
  camera: "",
  light: "",
  staging: "",
  constants: "",
};

export function createProject(name: string): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    shots: [],
    threads: [],
    notes: [],
    direction: { ...EMPTY_DIRECTION },
  };
}

export function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    shotCount: project.shots.length,
  };
}
