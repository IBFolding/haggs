import type { Project } from "./model";

/**
 * One-click targets for where a cut is going. Each sets the frame shape and the
 * loudness every platform expects (-14 LUFS), and the vertical one re-frames
 * every shot around where its subject is.
 */

export type Preset = { id: string; name: string; says: string; aspect: "16:9" | "9:16"; loudness: number; reframe: boolean };

export const PRESETS: Preset[] = [
  { id: "x", name: "X (Twitter)", says: "Wide 16:9, loudness set so it isn't turned down. Posts up to 2 minutes 20.", aspect: "16:9", loudness: -14, reframe: false },
  { id: "vertical", name: "TikTok, Reels, Shorts", says: "Tall 9:16. Every shot is re-framed around its subject, and the loudness is set.", aspect: "9:16", loudness: -14, reframe: true },
  { id: "youtube", name: "YouTube", says: "Wide 16:9 at the loudness YouTube plays at.", aspect: "16:9", loudness: -14, reframe: false },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

const unit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
/** A little above the middle: faces sit in the upper half of most shots. */
const MIDDLE = { x: 0.5, y: 0.4 };

/**
 * The project set up for a preset. A vertical preset fills the frame on every shot, around the focus you
 * set by hand if there is one, else the one found from the picture, else just above the middle.
 * Returns a new project; the one passed in is not changed.
 */
export function applyPreset(project: Project, preset: Preset, found: Record<string, { x: number; y: number }> = {}): Project {
  if (!preset.reframe) return { ...project, aspect: preset.aspect };
  return {
    ...project,
    aspect: preset.aspect,
    shots: project.shots.map((s) => {
      const own = s.fit === "fill" ? s.focus : undefined;
      const seen = found[s.id];
      const focus = own ?? (seen ? { x: unit(seen.x), y: unit(seen.y) } : MIDDLE);
      return { ...s, fit: "fill" as const, focus };
    }),
  };
}

/** The project with the focus found for each shot put in, filling the frame on those shots. Shots nothing was found for are left as they are. */
export function withFocus(project: Project, found: Record<string, { x: number; y: number }>): Project {
  return {
    ...project,
    shots: project.shots.map((s) => {
      const seen = found[s.id];
      return seen ? { ...s, fit: "fill" as const, focus: { x: unit(seen.x), y: unit(seen.y) } } : s;
    }),
  };
}
