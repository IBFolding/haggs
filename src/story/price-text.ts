/**
 * How a price is shown: in credits. A run's credits are its Comfy price in cents, rounded up, which is what the
 * platform charges (see creditsFor in the billing code), so what a button says is what a run takes.
 */

const group = (n: number) => n.toLocaleString("en-US");

/** The credits a price turns into: cents, rounded up, never less than one. */
export const creditsOf = (usd: number) => Math.max(1, Math.ceil(usd * 100 - 1e-9));

const words = (n: number) => `${group(n)} credit${n === 1 ? "" : "s"}`;

/** "78 credits", "1 credit", "free" for nothing and "···" for a price that isn't known yet. */
export function creditsText(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return "···";
  if (usd <= 0) return "free";
  return words(creditsOf(usd));
}

/** Several runs add up one run at a time, because each is charged on its own. */
export const totalText = (prices: number[]): string => words(prices.filter((p) => p > 0).reduce((sum, p) => sum + creditsOf(p), 0));

/** A rate such as a price per second keeps the fraction of a credit that matters: "0.23 credits". */
export function rateText(usd: number): string {
  const cents = usd * 100;
  const n = cents >= 10 ? Math.round(cents) : cents >= 1 ? Math.round(cents * 10) / 10 : Math.round(cents * 100) / 100;
  return n === 1 ? "1 credit" : `${group(n)} credits`;
}

/** "0.23 credits a second". */
export function perUnitText(usd: number, unit: string): string {
  return `${rateText(usd)} ${/^[aeiou]/i.test(unit) ? "an" : "a"} ${unit}`;
}
