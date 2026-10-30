import type { Series } from "./series";

/** Count only current shots, not stale result keys from a previous draft. */
export function seriesProgress(series: Series, pictures: Record<string, string>, clips: Record<string, string>, spoken: Record<string, string>) {
  return series.episodes.map((episode, e) => {
    let images = 0, videos = 0, narration = 0, narrationTotal = 0;
    episode.shots.forEach((shot, s) => {
      const key = `${e}.${s}`;
      if (pictures[key]) images++;
      if (clips[key]) videos++;
      if (shot.narration.trim()) { narrationTotal++; if (spoken[key]) narration++; }
    });
    return { total: episode.shots.length, images, videos, narration, narrationTotal };
  });
}
