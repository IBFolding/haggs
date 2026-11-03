"use client";

import { quoteGreyMedia, runGreyCloudMatte } from "./grey-shot-actions";

export type MatteWhere = "gpu" | "cloud";

/**
 * Runs a cut-out or area finder on Your GPU (as before) or on Comfy Cloud. Cloud asks you to approve
 * the estimated maximum first; the server holds that amount against your Grey Room cap and refuses
 * to run without it. Nothing here retries or falls back to the other place.
 */
export async function runMatte<T extends { ok: boolean }>(where: MatteWhere, prompt: string, files: Record<string, string>, runOnGpu: () => Promise<T>): Promise<T | { ok: false; reason: string; needsKey?: false }> {
  if (where === "gpu") return runOnGpu();
  const input = { prompt, files };
  const quote = await quoteGreyMedia("matte", input);
  if (!quote.ok) return { ok: false, reason: quote.reason };
  const agreed = window.confirm(`Comfy Cloud will run this.\n\nEstimated maximum spend: $${quote.estimateUsd.toFixed(2)}.\nThis amount is held against your Grey Room spending cap while it runs.\n\nContinue?`);
  if (!agreed) return { ok: false, reason: "Cancelled. Nothing was run and nothing was charged." };
  const result = await runGreyCloudMatte(input, { quoteId: quote.id, consent: true });
  return result as T | { ok: false; reason: string };
}
