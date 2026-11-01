/**
 * Finds the tempo of a track and where its first beat falls, from the sound alone, so a film can be cut to a song
 * you didn't make. It looks for sudden rises in loudness (onsets), then tries every tempo from 80 to 180 beats a
 * minute and every starting point, and keeps the grid the onsets land on best.
 */
export type Tempo = { bpm: number; firstBeat: number; confidence: number };

const HOP = 256;

export function detectTempo(samples: Float32Array, sampleRate: number): Tempo | null {
  const frames = Math.floor(samples.length / HOP);
  const fps = sampleRate / HOP;
  if (frames < fps * 8) return null;
  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { let s = 0; for (let k = i * HOP; k < (i + 1) * HOP; k++) s += samples[k]! * samples[k]!; env[i] = Math.sqrt(s / HOP); }
  const onset = new Float32Array(frames);
  let max = 0;
  for (let i = 1; i < frames; i++) { onset[i] = Math.max(0, env[i]! - env[i - 1]!); if (onset[i]! > max) max = onset[i]!; }
  if (max < 1e-4) return null;
  for (let i = 0; i < frames; i++) onset[i]! /= max;
  let total = 0; for (let i = 0; i < frames; i++) total += onset[i]!;
  const mean = total / frames;

  let best: { score: number; bpm: number; phase: number } | null = null;
  for (let bpm = 80; bpm <= 180; bpm += 0.25) {
    const lag = (fps * 60) / bpm;
    const teeth = Math.floor((frames - 1) / lag) - 1;
    if (teeth < 8) continue;
    // Each starting point, scored by the average onset strength on its grid (a little slack for timing jitter).
    for (let p = 0; p < lag; p += 1) {
      let s = 0;
      for (let n = 0; n < teeth; n++) {
        const i = Math.round(p + n * lag);
        s += Math.max(onset[i]!, onset[i + 1] ?? 0, onset[i - 1] ?? 0);
      }
      const score = s / teeth;
      if (!best || score > best.score) best = { score, bpm, phase: p };
    }
  }
  if (!best || best.score < mean * 4) return null;
  // The grid reaches back before the music starts, so the first beat is the first tooth with a real hit on it.
  const lag = (fps * 60) / best.bpm;
  let first = best.phase;
  for (let n = 0; ; n++) {
    const i = Math.round(best.phase + n * lag);
    if (i >= frames - 1) break;
    if (Math.max(onset[i]!, onset[i + 1] ?? 0, onset[i - 1] ?? 0) >= 0.35) { first = best.phase + n * lag; break; }
  }
  // An onset shows up the frame after the sound starts.
  return { bpm: Math.round(best.bpm * 4) / 4, firstBeat: Math.max(0, (first - 1) / fps), confidence: Math.min(1, best.score / (mean * 12)) };
}
