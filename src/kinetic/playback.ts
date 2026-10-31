import { blockAt, type Timeline, type Zoom } from "./beats";

export type ClipAt = {
  name: string;
  offsetSeconds: number;
  zoom?: Zoom;
  beats: number;
  totalBeats: number;
};

/** A preview time on a drawable frame, never beyond the end of the film. */
export function seekSeconds(timeline: Timeline, seconds: number) {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(0, seconds), Math.max(0, timeline.totalSeconds - 0.001));
}

/** The clip frame belonging to one film-clock instant, independent of playback rate or dropped frames. */
export function clipAt(timeline: Timeline, seconds: number): ClipAt | null {
  const at = blockAt(timeline, seconds);
  if (!at || at.item.block.kind !== "clip") return null;
  const block = at.item.block;
  return {
    name: block.name,
    offsetSeconds: seconds - at.item.startSeconds,
    ...(block.zoom ? { zoom: block.zoom } : {}),
    beats: at.beats,
    totalBeats: block.beats,
  };
}

export type SyncClip = {
  currentTime: number;
  duration: number;
  paused: boolean;
  play: () => Promise<void>;
  pause: () => void;
};

/** Keeps every clip on the film clock. Paused seeks are exact; playing seeks only correct visible drift. */
export function syncClips(clips: Record<string, SyncClip>, timeline: Timeline, seconds: number, playing: boolean) {
  const active = clipAt(timeline, seconds);
  for (const [name, clip] of Object.entries(clips)) {
    if (!playing || name !== active?.name) clip.pause();
  }
  if (!active) return;
  const clip = clips[active.name];
  if (!clip) return;
  const wanted = Math.min(Math.max(0, active.offsetSeconds), Number.isFinite(clip.duration) && clip.duration >= 0 ? clip.duration : Infinity);
  const complete = Number.isFinite(clip.duration) && clip.duration >= 0 && active.offsetSeconds >= clip.duration;
  if (!playing || Math.abs(clip.currentTime - wanted) > 0.12) clip.currentTime = wanted;
  if (playing && clip.paused && !complete) void clip.play().catch(() => undefined);
}
