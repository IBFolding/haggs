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

export type ShotReview = {
  id: string;
  shotId: string;
  at: number;
  text: string;
  fix: string;
  status: "open" | "approved" | "applied";
};

export type Shot = {
  /** Local 2D reframe, applied in preview and rendered exports. */
  reframe?: import("./reframe").ReframePath;
  /** Review stays with this stable shot, independent of timeline reordering. */
  review?: ShotReview[];
  generationPasses?: { draft?: Shot["model"]; final?: Shot["model"]; sourceImage?: string };
  /** Explicit first-frame dependency; selected media remains untouched until a new take is chosen. */
  startsFrom?: { shotId: string; sourceUrl: string; sourceAt: number; from: number; seconds: number; frameUrl: string };
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
  /** Camera, framing, move, light, film, era, look and grade picked by sight; its plain words go into the prompt. */
  look?: import("../catalog/look").LookChoice;
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
  /** The shot worked out in grey: camera, stand-ins and light, before anything real is made. */
  grey?: import("./grey").GreyFrame;
  /** The Grey Room's set for this shot: where it takes place, chosen from your saved places. */
  greyScene?: import("./grey-scene").GreyScene;
  /** A real take is locked against change until it is approved for it; this is that approval. */
  approved?: boolean;
  /** Seconds the picture and its own sound fade in from, and out to, black. */
  fadeIn?: number;
  fadeOut?: number;
  /** How the footage meets the frame: fit it whole (bars where the shapes differ) or fill it (crop), around a focal point 0–1. */
  fit?: "fit" | "fill";
  focus?: { x: number; y: number };
  /** A look burned into this shot's picture (see fx.ts). Anything unknown is ignored. */
  fx?: string;
  /** The shot-list row this shot was sent from, so a re-send updates it in place. */
  sheetShotId?: string;
  /** Every take this shot has had. `render` is the one on the shot. */
  takes?: Take[];
  /** Seconds into the take where the shot starts, after a trim or a split. */
  trimIn?: number;
  /** Reference images for the cast and place in this shot, sent with it when it is generated. */
  refs?: string[];
  /** The on-screen words for this shot (a hook, a line of text). */
  caption?: string;
  /** Seconds into the shot the caption appears (default: from the start). */
  captionAt?: number;
  /** How long it stays up, in seconds (default: to the end of the shot). */
  captionFor?: number;
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

/** How the voices sit in the mix. Each is optional; left out, that treatment is off. */
export type Sound = {
  /** Room around the voices, 0 dry … 1 a large hall. */
  room?: number;
  /** Body: dB of low warmth, −6…6. */
  warmth?: number;
  /** Clarity: dB of presence, −6…6 (negative softens harshness). */
  clarity?: number;
  /** Squeeze: how much the voices are levelled, 0…1. */
  squeeze?: number;
  /** How far the soundtrack dips under a voice, 0…1. */
  duck?: number;
  /** Bring the finished mix to −16 LUFS, the level streaming expects. */
  loud?: boolean;
  /** Track levels (dB, on top of each item's own) and mutes. */
  voiceGain?: number;
  voiceMute?: boolean;
  fxGain?: number;
  fxMute?: boolean;
  musicMute?: boolean;
  /** The video track's own sound. */
  clipGain?: number;
  clipMute?: boolean;
};

/** A review note on the timeline: a moment worth coming back to. */
export type Marker = { id: string; at: number; text: string };

/** Something shown over the picture for a while: a title, a logo. A transparent picture placed on the frame. */
export type Overlay = { id: string; name: string; url: string; start: number; seconds: number };

/** A sound effect on its own track, placed on the cut's clock. */
export type Effect = { id: string; name: string; url: string; /** Seconds from the start of the cut. */ start: number; /** Loudness change in dB. */ gain: number; /** How long the sound is, for drawing it. */ seconds: number };

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
  /** How the voices sit in the mix, for the board being viewed. */
  sound?: Sound;
  /** The effects track of the board being viewed. */
  effects?: Effect[];
  /** Review markers on the board being viewed. */
  markers?: Marker[];
  /** The overlay track (titles over the picture) of the board being viewed. */
  overlays?: Overlay[];
  /** The frame shape of the board being viewed. Stored on the board, like the soundtrack. */
  aspect?: "16:9" | "9:16";
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
  sound?: Sound;
  effects?: Effect[];
  markers?: Marker[];
  overlays?: Overlay[];
  /** The shape of its frame; vertical for social series. Landscape when left out. */
  aspect?: "16:9" | "9:16";
};

/** What the library list needs, without loading every project in full. */
export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
  shotCount: number;
  boardCount?: number;
  /** The first finished picture or clip, shown as the project's thumbnail. */
  cover?: { url: string; kind: "image" | "video" };
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

/** The first finished picture or clip in story order. */
export function coverOf(project: Project): ProjectSummary["cover"] {
  const shots = project.boards ? project.boards.flatMap((b) => b.shots) : project.shots;
  const made = shots.find((s) => s.render?.url);
  return made?.render ? { url: made.render.url, kind: made.render.kind } : undefined;
}

export function summarize(project: Project): ProjectSummary {
  const cover = coverOf(project);
  return {
    ...(cover ? { cover } : {}),
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

/** The shot with this look, or with none when nothing is picked, so an empty look never changes its prompt or file. */
export function setLook(shot: Shot, look: import("../catalog/look").LookChoice): Shot {
  const { look: _was, ...rest } = shot;
  return Object.keys(look).length ? { ...rest, look } : rest;
}
