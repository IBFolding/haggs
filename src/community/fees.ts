/**
 * Community apps: a creator may charge up to 12¢ each time someone runs
 * their app, on top of what the run costs on Comfy. The creator keeps 80%
 * (rounded down to a whole cent); haggs keeps the rest. The database applies
 * the same split; this is the copy the app shows and checks against.
 */

export const FEE_MAX_CENTS = 12;
export const CREATOR_SHARE = 0.8;

export function checkFee(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error("A fee is in whole cents.");
  if (cents < 0 || cents > FEE_MAX_CENTS) throw new Error(`A fee is free or up to ${FEE_MAX_CENTS}¢ a run.`);
  return cents;
}

export function split(cents: number): { creator: number; platform: number } {
  const creator = Math.floor(cents * CREATOR_SHARE);
  return { creator, platform: cents - creator };
}

export const feeLabel = (cents: number) => (cents === 0 ? "free to use" : `+ ${cents} credit${cents === 1 ? "" : "s"} to the creator`);
