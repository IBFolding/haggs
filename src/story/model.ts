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
  /** A character's reference picture, shown as their face on the board. */
  ref?: string;
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
  /** The endpoint and the settings it declared, as this shot will run. */
  model: { id: string; settings: Record<string, string | number | boolean> };
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
  /** The shot-list row this shot was sent from, so a re-send updates it in place. */
  sheetShotId?: string;
  /** Every take this shot has had. `render` is the one on the shot. */
  takes?: Take[];
  /** Seconds into the take where the shot starts, after a trim or a split. */
  trimIn?: number;
  /** Reference images for the cast and place in this shot, sent with it when it is generated. */
  refs?: string[];
  /** A picture this shot should end on: the next shot's first frame, when it bridges two shots. */
  endsOn?: string;
  /** Voice-over lines spoken over this shot; they move with it when the board is reordered. */
  voices?: VoiceLine[];
};

/** One spoken line, placed from the start of its shot. `url` is empty until it has been spoken. */
export type VoiceLine = {
  id: string;
  text: string;
  /** Who says it, as the script names them: ELLIS, VOICE. */
  speaker: string;
  /** The ElevenLabs voice it is spoken in. */
  voice: string;
  url?: string;
  /** Seconds after the shot starts. */
  offset: number;
  /** Loudness change in dB. */
  gain?: number;
};

/** A board's soundtrack: one file under the whole cut, dipped under the voices. */
export type Music = { url: string; name: string; gain: number };

/** One version of a shot's footage — a generation, a reroll, an import. */
export type Take = {
  id: string;
  url: string;
  kind: "image" | "video";
  usd: number | null;
  promptHash: string;
  at: number;
  favorite?: boolean;
  /** For a person: "MiniMax H3", "v011 take", "dropped picture". */
  origin?: string;
};

/**
 * A still, take or cut that belongs to the project but was not generated on
 * the board — imported footage, references, earlier cuts. It sits in the
 * project's Media tab until it is put on a shot.
 */
export type Media = {
  id: string;
  url: string;
  kind: "image" | "video";
  name: string;
  /** Where it came from, for a person to read: "v014 takes", "v011 journey cut". */
  origin: string;
  status: "review" | "approved" | "rejected" | "reference";
  /** Why it was rejected or what to check, carried over from the review it came from. */
  note: string;
  /** The board shot it is meant for, if any. */
  shotId?: string;
  seconds?: number;
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
  media?: Media[];
  /** The project's storyboards. `shots`/`notes` above are only read from projects saved before boards existed. */
  boards?: Board[];
  /** The soundtrack of the board being viewed. Stored on the board; only a view carries it here. */
  music?: Music;
  /** Set by an import tool; a later file with the same key offers to replace this project. */
  importKey?: string;
  source?: { templateId: string; name: string; author?: string };
};

/**
 * One storyboard inside a project: a sizzle reel, an episode, a version.
 * Characters, places, media and direction belong to the project and are
 * shared; shots and notes belong to the board.
 */
export type Board = {
  id: string;
  name: string;
  kind: "reel" | "episode" | "board";
  /** Array order IS story order. */
  shots: Shot[];
  notes: Note[];
  music?: Music;
};

/** What the library list needs, without loading every project in full. */
export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
  shotCount: number;
  boardCount?: number;
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
    shotCount: project.boards ? project.boards.reduce((n, b) => n + b.shots.length, 0) : project.shots.length,
    boardCount: project.boards?.length ?? 1,
  };
}

const DEFAULT_MODEL_ID = "fal-ai/flux/schnell";

export function newShot(): Shot {
  return {
    id: crypto.randomUUID(),
    heading: "",
    beat: "",
    threadIds: [],
    seconds: null,
    model: { id: DEFAULT_MODEL_ID, settings: {} },
  };
}

/**
 * Moves a shot to a new position. Array order is story order, so this is the
 * whole of "reorder" — there is no rank to renumber and nothing to keep in
 * step with it.
 */
export function moveShot(shots: readonly Shot[], from: number, to: number): Shot[] {
  if (from === to) return [...shots];
  const next = [...shots];
  const [moved] = next.splice(from, 1);
  if (!moved) return [...shots];
  next.splice(to, 0, moved);
  return next;
}
