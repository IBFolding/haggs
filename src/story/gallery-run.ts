import type { NewRun } from "./runs";

/** What one 1K picture costs on Comfy Cloud, in dollars, the same figure the picture maker quotes. */
const STILL_USD = 0.0686;

/** A finished picture from a maker that returns one link (Comic, Series, Accessories), as a Gallery run. */
export function runFromStill(prompt: string, origin: string, result: { ok: boolean; url?: string }): NewRun | null {
  if (!result.ok || !result.url) return null;
  return { modelId: "still", modelName: origin, prompt, settings: {}, url: result.url, kind: "image", usd: STILL_USD };
}
