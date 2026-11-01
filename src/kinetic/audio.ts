/** Helpers for making a track longer than the music model allows: split the length, join the parts, write a wav. */

const MAX_PART = 180;
const MIN_PART = 5;

/** The lengths to ask for: one track when it fits, else equal parts that each fit (a little over, so the crossfades don't shorten it). */
export function musicParts(seconds: number): number[] {
  const total = Math.max(MIN_PART, Math.ceil(seconds));
  if (total <= MAX_PART) return [total];
  const n = Math.ceil(total / (MAX_PART - 10));
  const each = Math.min(MAX_PART, Math.max(MIN_PART, Math.ceil((total + (n - 1) * 2) / n)));
  return Array.from({ length: n }, () => each);
}

/** Joins sample parts end to end, crossfading across each join. */
export function joinSamples(parts: Float32Array[], sampleRate: number, fadeSeconds: number): Float32Array {
  if (parts.length === 1) return parts[0]!;
  const fade = Math.floor(fadeSeconds * sampleRate);
  const total = parts.reduce((a, p) => a + p.length, 0) - fade * (parts.length - 1);
  const out = new Float32Array(total);
  let at = 0;
  parts.forEach((p, k) => {
    for (let i = 0; i < p.length; i++) {
      const pos = at + i;
      const inFade = k > 0 && i < fade;
      const outFade = k < parts.length - 1 && i >= p.length - fade;
      const gain = inFade ? i / fade : outFade ? (p.length - i) / fade : 1;
      out[pos] = (out[pos] ?? 0) + p[i]! * gain;
    }
    at += p.length - fade;
  });
  return out;
}

/** A mono 16-bit wav file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const dv = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); dv.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, "data"); dv.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const v = Math.max(-1, Math.min(1, samples[i]!)); dv.setInt16(44 + i * 2, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true); }
  return out;
}
