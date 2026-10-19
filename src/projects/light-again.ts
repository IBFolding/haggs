/**
 * LIGHT AGAIN — shot list, transcribed from the approved package.
 *
 * Source: LIGHT_AGAIN_APPROVED_MUSIC_VIDEO_PACKAGE.zip
 * Track:  LIGHT_AGAIN_MOTH1.mp3 — 191.2s (3:11), 190kbps
 *
 * Panels are transcribed from the five main storyboard pages as drawn. The
 * three dance-break pages are not transcribed here; the package describes them
 * as an expansion inserted at the Lamp Cathedral section rather than new story.
 */

export type Panel = {
  page: number;
  panel: number;
  slug: string;
  act: Act;
  /** Which of the locked locations this sits in. */
  location: Location;
};

export type Act = 1 | 2 | 3 | 4 | 5 | 6;

export type Location =
  | "alley"
  | "neon-streets"
  | "transit"
  | "cathedral"
  | "rooftops"
  | "montage";

const P = (page: number, panel: number, slug: string, act: Act, location: Location): Panel => ({
  page,
  panel,
  slug,
  act,
  location,
});

export const PANELS: readonly Panel[] = [
  // ── Page 1 — Act 1–2: call, recognition, chase ──────────────────────
  P(1, 1, "INT. ALLEY — NIGHT — ESTABLISHING", 1, "alley"),
  P(1, 2, "INT. ALLEY — THE SINGER TURNS", 1, "alley"),
  P(1, 3, "INT. DOORWAY — THE LIGHT", 1, "alley"),
  P(1, 4, "INT. ALLEY — CLOSE-UP", 1, "alley"),
  P(1, 5, "EXT. NEON CITY — WALK", 2, "neon-streets"),
  P(1, 6, "MONTAGE — NOW / THEN / FUTURE / PAST", 2, "montage"),
  P(1, 7, "EXT. CITY — THE CHASE BEGINS", 2, "neon-streets"),
  P(1, 8, "EXT. ROOFTOP — VANISH / REAPPEAR", 2, "rooftops"),
  P(1, 9, "EXT. VERTICAL — THE CLIMB", 2, "rooftops"),
  P(1, 10, "EXT. ROOFTOP — UNDER THE LAMP", 2, "rooftops"),

  // ── Page 2 — compressed full arc. Overlaps pages 3–5. ───────────────
  P(2, 1, "VERSE 2 — THE PULL", 2, "neon-streets"),
  P(2, 2, "MOTHS GATHER", 2, "transit"),
  P(2, 3, "BREAKDOWN — FLASHBACKS", 2, "montage"),
  P(2, 4, "CONNECTION", 3, "montage"),
  P(2, 5, "TRANSITION — ANOTHER LOCATION", 3, "neon-streets"),
  P(2, 6, "DANCE BREAK — THE NEON BALLROOM", 4, "cathedral"),
  P(2, 7, "FULL PERFORMANCE", 4, "cathedral"),
  P(2, 8, "BUILD — FRAGMENTS", 4, "montage"),
  P(2, 9, "FINAL DROP — TRANSFORMATION", 6, "rooftops"),
  P(2, 10, "REUNION — ON THE EDGE", 5, "rooftops"),
  P(2, 11, "END — THE CYCLE", 6, "alley"),

  // ── Page 3 — Act 3: descent and assembly ────────────────────────────
  P(3, 1, "ALLEY — THE CALL AGAIN", 3, "alley"),
  P(3, 2, "THE TRAIL", 3, "neon-streets"),
  P(3, 3, "INTO THE UNDERGROUND", 3, "transit"),
  P(3, 4, "NEON PLATFORM", 3, "transit"),
  P(3, 5, "THROUGH THE TUNNEL", 3, "transit"),
  P(3, 6, "THE LEAP", 3, "rooftops"),
  P(3, 7, "THE LAMP CATHEDRAL", 3, "cathedral"),
  P(3, 8, "CREW ASSEMBLES", 3, "cathedral"),
  P(3, 9, "ALMOST TOUCH", 3, "cathedral"),
  P(3, 10, "READY", 3, "cathedral"),
  P(3, 11, "IGNITION", 3, "cathedral"),

  // ── Page 4 — Act 4: the dance break ─────────────────────────────────
  P(4, 1, "INT. UNDERGROUND BALLROOM — ESTABLISHING", 4, "cathedral"),
  P(4, 2, "INT. BALLROOM — BUILD", 4, "cathedral"),
  P(4, 3, "INT. BALLROOM — DANCE BREAK (FULL PERFORMANCE)", 4, "cathedral"),
  P(4, 4, "DETAILS — MOTION", 4, "cathedral"),
  P(4, 5, "RUNNER 02 — THE VAULT", 4, "cathedral"),
  P(4, 6, "CLUB-KID — ACTIVATE", 4, "cathedral"),
  P(4, 7, "THE LIGHT — AMONG US", 4, "cathedral"),
  P(4, 8, "EXT. OVERPASS — DANCE BREAK CUTAWAY", 4, "rooftops"),
  P(4, 9, "FRAGMENTS — NOW / THEN / FUTURE / PAST", 4, "montage"),
  P(4, 10, "CIRCLE — ONE LIGHT", 4, "cathedral"),
  P(4, 11, "BREAKTHROUGH — TO THE CHASE", 4, "cathedral"),

  // ── Page 5 — Act 5–6: reunion, transformation, loop ─────────────────
  P(5, 1, "ESCAPE — ABOVE THE BALLROOM", 5, "rooftops"),
  P(5, 2, "ROOFTOP RUN — GUIDED BY MOTHS", 5, "rooftops"),
  P(5, 3, "THE MOTH CREW — SUPPORT", 5, "rooftops"),
  P(5, 4, "THE LIGHT APPEARS", 5, "rooftops"),
  P(5, 5, "THE CLIMB — REACHING", 5, "rooftops"),
  P(5, 6, "REUNION", 5, "rooftops"),
  P(5, 7, "TRANSFORMATION — WINGS UNFOLD", 6, "rooftops"),
  P(5, 8, "CITY IGNITION", 6, "rooftops"),
  P(5, 9, "TOGETHER — A BRIGHTER TOMORROW", 6, "rooftops"),
  P(5, 10, "AFTERMATH — QUIET MOMENT", 6, "alley"),
  P(5, 11, "THE CYCLE — ONE LAMP AGAIN", 6, "alley"),
];

export const TRACK_SECONDS = 191.2;

/**
 * Page 2 tells the whole story again — it reaches the transformation at panel
 * 09 and the loop ending at panel 11, both of which pages 3–5 then play out at
 * length. Cutting the pages in numerical order, as README_FIRST instructs,
 * resolves the film, restarts it, and resolves it a second time.
 *
 * The package's own master prompt forbids exactly this: "No restarting story
 * beats already completed." So page 2 reads as an earlier compressed treatment
 * that survived into an otherwise sequential set.
 */
export const OVERLAPPING_PAGE = 2;

export const SEQUENTIAL = PANELS.filter((panel) => panel.page !== OVERLAPPING_PAGE);
