import { cloudEstimate, cloudEstimateUsd } from "../providers/cloud-price";
import { creditsOf } from "./price-text";

/** Display units only. Never use these amounts to debit or rewrite a balance. */
export const COMFY_CREDITS_PER_USD = 211;
export const H3_RATE_CHECKED = "2026-10-30";
export const H3_RATE_SOURCE = "https://docs.comfy.org/tutorials/partner-nodes/pricing";
export const COMFY_UNIT_SOURCE = "https://support.comfy.org/articles/5846341390-how-credits-work-in-comfy";

const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const creditLabel = (credits: number) => `Est. ${number(credits)} credit${credits === 1 ? "" : "s"}`;

export type StudioPrice = {
  label: string;
  detail: string;
  usd: number | null;
  comfyCredits: number | null;
  haggsCredits: number | null;
};

const unavailable = (): StudioPrice => ({
  label: "Estimate unavailable",
  detail: "The price for these settings has not been verified. Check the provider before generating; no spending limit is guaranteed.",
  usd: null, comfyCredits: null, haggsCredits: null,
});

/** Synchronous: a previous configuration's quote can never win an async race. */
export function studioPrice(input: {
  modelId: string;
  settings: Record<string, unknown>;
  firstFrame: boolean;
  referenceCount: number;
  /** Optional current-settings estimate for another model; never a default picker rate. */
  otherUsd?: number | null;
}): StudioPrice {
  if (input.modelId !== "minimax/minimax-h3") {
    const usd = input.otherUsd;
    if (usd == null || !Number.isFinite(usd) || usd < 0) return unavailable();
    const haggsCredits = creditsOf(usd);
    return {
      label: creditLabel(haggsCredits),
      detail: "Model-table estimate for these settings; the current provider rate is unverified. Provider credits and Haggs credits have different values. This is not a spending limit.",
      usd, comfyCredits: null, haggsCredits,
    };
  }

  const seconds = Number(input.settings.duration);
  const resolution = input.settings.resolution;
  if (!Number.isInteger(seconds) || seconds < 4 || seconds > 15 ||
      (resolution !== "768P" && resolution !== "2K") ||
      !Number.isInteger(input.referenceCount) || input.referenceCount < 0) return unavailable();
  // Execution uploads only the first frame, or at most nine references.
  const references = input.firstFrame ? 0 : Math.min(9, input.referenceCount);
  const options = { seconds, resolution, references };
  const usd = cloudEstimateUsd(options);
  const comfyCredits = Math.round(usd * COMFY_CREDITS_PER_USD * 100) / 100;
  // Match existing plan accounting, including its USD rounding; do not change it.
  const haggsCredits = creditsOf(cloudEstimate(options));
  return {
    label: creditLabel(haggsCredits),
    detail: `${seconds}s at ${resolution}. Your Comfy key: ${number(comfyCredits)} Comfy credits. Haggs plan: ${number(haggsCredits)} Haggs credits. Rates checked ${H3_RATE_CHECKED}; estimates, not a spending limit.`,
    usd, comfyCredits, haggsCredits,
  };
}
