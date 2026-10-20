/** Comfy's published MiniMax H3 rates (node price badges, checked by v1 on 2026-10-17). An estimate, not an invoice. */
export function cloudEstimate({ seconds, resolution, references }: { seconds: number; resolution: string; references: number }): number {
  const rate = resolution === "2K" ? 0.1859 : 0.1287;
  return Math.round((rate * seconds + Math.max(0, references - 5) * 0.0572) * 1000) / 1000;
}
