/**
 * The pitch, in a terminal.
 *
 * Prices every model in the picker against fal's live published rates and
 * sorts them by what they actually cost. No API key is used and nothing is
 * submitted — fal publishes prices openly, which is the whole point: you can
 * see the bill before you have an account.
 *
 * Run: npx tsx src/demo.ts
 */
import { MODELS } from "./catalog/models";
import { fetchPricing, formatRate, type ModelPricing } from "./catalog/pricing";

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const volt = (text: string) => `\x1b[38;5;190m${text}\x1b[0m`;

const priced = await Promise.all(
  MODELS.map(async (model) => ({ model, pricing: await fetchPricing(model.id) })),
);

/** Comparable rates only — a per-second video rate and a per-image rate are
    different units and ranking them against each other would be a lie. */
const byUnit = new Map<string, Array<{ name: string; pricing: ModelPricing; id: string }>>();
for (const { model, pricing } of priced) {
  const unit = pricing.unit ?? "unknown";
  const row = { name: model.name, pricing, id: model.id };
  byUnit.set(unit, [...(byUnit.get(unit) ?? []), row]);
}

console.log(`\n${bold("haggs")} ${dim("— live rates from fal, no key used")}\n`);

for (const [unit, rows] of [...byUnit].sort((a, b) => b[1].length - a[1].length)) {
  const sorted = [...rows].sort(
    (a, b) => (a.pricing.usdPerUnit ?? Infinity) - (b.pricing.usdPerUnit ?? Infinity),
  );
  console.log(`${dim(`per ${unit}`)}`);
  for (const row of sorted) {
    console.log(
      `  ${row.name.padEnd(24)} ${volt(formatRate(row.pricing).padEnd(24))} ${dim(row.id)}`,
    );
  }

  // The spread is the argument. Higgsfield's picker shows no rate at all, so
  // the difference between the cheapest and dearest model is invisible there.
  const rates = sorted.map((row) => row.pricing.usdPerUnit).filter((n): n is number => n !== null);
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  if (rates.length > 1 && low > 0) {
    console.log(
      dim(`  spread: ${(high / low).toFixed(0)}x between cheapest and dearest\n`),
    );
  } else {
    console.log();
  }
}

console.log(
  dim(
    "Higgsfield's picker shows no price, and its button reads credits — 6.5 of a\nunit you cannot value without knowing your tier. Every figure above is a\ndollar amount read from the provider at request time.\n",
  ),
);
