import { blockAt, type Timeline, type Zoom } from "./beats";
import { occurrenceKey } from "./media";

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

/** Half the 30 fps shutter: future samples may make the next clip visible before the central time crosses the cut. */
const SHUTTER_LOOKAHEAD_SECONDS = (1 / 30) * 0.9 / 2;

/** Keeps visible clips on the film clock. Paused and exact-sample seeks are exact; normal playing seeks correct visible drift. */
export function syncClips(clips: Record<string, SyncClip>, timeline: Timeline, seconds: number, playing: boolean, whipBeats = 0.4, lookAheadSeconds = SHUTTER_LOOKAHEAD_SECONDS, exact = false) {
  const active = clipAt(timeline, seconds);
  const at = blockAt(timeline, seconds);
  const whip = at ? Math.min(at.item.block.beats, Math.max(0, Math.min(1, whipBeats))) : 0;
  const shutterBeats = lookAheadSeconds / timeline.secondsPerBeat;
  const next = at && whip > 0 && at.beats + shutterBeats > at.item.block.beats - whip ? timeline.items[at.index + 1]?.block : undefined;
  const activeOccurrence = active && at ? occurrenceKey(at.index, active.name) : null;
  const activeKey = activeOccurrence && clips[activeOccurrence] ? activeOccurrence : active?.name;
  const activeTarget = active && activeKey ? { ...active, key: activeKey } : null;
  let incoming: { name: string; offsetSeconds: number; key: string } | null = null;
  if (at && next?.kind === "clip") {
    const occurrence = occurrenceKey(at.index + 1, next.name);
    const scoped = Boolean(clips[occurrence]);
    if (next.name !== active?.name || scoped) incoming = { name: next.name, offsetSeconds: 0, key: scoped ? occurrence : next.name };
  }
  for (const [key, clip] of Object.entries(clips)) {
    if (!playing || key !== activeKey) clip.pause();
  }
  const targets: { name: string; offsetSeconds: number; key: string }[] = [...(activeTarget ? [activeTarget] : []), ...(incoming ? [incoming] : [])];
  for (const target of targets) {
    const clip = clips[target.key];
    if (!clip) continue;
    const shouldPlay = playing && target === activeTarget;
    const wanted = Math.min(Math.max(0, target.offsetSeconds), Number.isFinite(clip.duration) && clip.duration >= 0 ? clip.duration : Infinity);
    const complete = Number.isFinite(clip.duration) && clip.duration >= 0 && target.offsetSeconds >= clip.duration;
    if (exact || !shouldPlay || Math.abs(clip.currentTime - wanted) > 0.12) clip.currentTime = wanted;
    if (shouldPlay && clip.paused && !complete) void clip.play().catch(() => undefined);
  }
}

/** Holds preroll on frame zero; only a nonnegative film clock may start clip playback. */
export function syncFilmClips(clips: Record<string, SyncClip>, timeline: Timeline, seconds: number, whipBeats: number, lookAheadSeconds = SHUTTER_LOOKAHEAD_SECONDS, exact = false) {
  syncClips(clips, timeline, Math.max(0, seconds), seconds >= 0, whipBeats, lookAheadSeconds, exact);
}
