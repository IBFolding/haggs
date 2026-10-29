import { ProviderError } from "./types";

/** Status codes are transport metadata, never arbitrary digits inside a job ID. */
export function generationFailure(caught: unknown, provider: string): { ok: false; reason: string; needsKey?: boolean } {
  const message = caught instanceof Error ? caught.message : String(caught);
  const status = caught instanceof ProviderError ? caught.status : undefined;
  if (status === 401) return { ok: false, reason: `That key was rejected by ${provider}.`, needsKey: true };
  if (status === 402) return { ok: false, reason: "Your Comfy workspace is out of credits.", needsKey: true };
  return { ok: false, reason: message };
}
