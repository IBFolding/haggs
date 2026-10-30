/** Published MiniMax H3 USD rates, verified 2026-10-30 against Comfy's node source.
 * https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_api_nodes/nodes_minimax.py
 * Estimates only. Preserve precision for conversion to provider credit units. */
type CloudPriceOptions = { seconds: number; resolution: string; references: number };

export function cloudEstimateUsd({ seconds, resolution, references }: CloudPriceOptions): number {
  const rate = resolution === "2K" ? 0.1859 : 0.1287;
  return rate * seconds + Math.max(0, references - 5) * 0.0572;
}

/** Existing plan-accounting estimate; rounding intentionally unchanged. */
export function cloudEstimate(options: CloudPriceOptions): number {
  return Math.round(cloudEstimateUsd(options) * 1000) / 1000;
}
