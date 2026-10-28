import { MAX_BATCH, type AdFormat } from "./ads";

/**
 * The Ad Multiplier: take an ad that already works and remake it for other audiences and other
 * languages, keeping the product, layout and brand and changing only what has to change.
 */

type Ratio = AdFormat["ratio"];
const SHAPES: { ratio: Ratio; value: number }[] = [
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "1:1", value: 1 },
  { ratio: "16:9", value: 16 / 9 },
];

/** The shape the picture model offers that is closest to a picture's own. */
export function nearestRatio(width: number, height: number): Ratio {
  if (!(width > 0 && height > 0)) return "1:1";
  const r = width / height;
  return SHAPES.reduce((best, s) => (Math.abs(Math.log(s.value / r)) < Math.abs(Math.log(best.value / r)) ? s : best)).ratio;
}

/** What else to change in every version: a product of yours in place of theirs, a new headline or call to action, a note. */
export type Swap = { product?: { name: string; words: string; picture: boolean }; hook?: string; cta?: string; notes?: string };

/** True when a swap changes anything, so one version is worth making even with no audience or language. */
export function swaps(swap: Swap): boolean {
  return Boolean(swap.product || swap.hook?.trim() || swap.cta?.trim() || swap.notes?.trim());
}

/** The instruction that remakes image 1 for an audience and/or in a language, with anything swapped in. */
export function multiplyPrompt(audience: string, language: string, swap: Swap = {}): string {
  const who = audience.trim();
  const lang = language.trim();
  const hook = swap.hook?.trim().slice(0, 120);
  const cta = swap.cta?.trim().slice(0, 60);
  const notes = swap.notes?.trim().slice(0, 300);
  const product = swap.product;
  return [
    "Recreate the advertisement in image 1.",
    product
      ? `Replace the product with ${product.name}${product.words.trim() ? ` (${product.words.trim()})` : ""}${product.picture ? ", exactly as it looks in image 2" : ""}, in the same place and at the same size. Keep the same layout, the same brand colours, typography and style.`
      : "Keep the same product exactly, the same layout, the same brand colours, typography and style.",
    who ? `Remake it for ${who}: change the people, the setting and the mood so it speaks to them, and keep everything else.` : "Keep the same people, setting and mood.",
    hook ? `Change the headline to "${hook}".` : "",
    cta ? `Change the call to action to "${cta}".` : "",
    lang ? `Translate all the text on the ad into ${lang}, spelled correctly, in the same place and style.` : hook || cta ? "" : "Keep the text as it is.",
    notes ? `Also: ${notes}` : "",
    "No watermark.",
  ].filter(Boolean).join(" ");
}

export type MultiplyJob = { audience: string; language: string };

/** Every audience with every language, in reading order, never more than a batch. Either list may be empty; with both empty, one version when something is swapped. */
export function multiplierJobs(audiences: string[], languages: string[], swapped = false): MultiplyJob[] {
  const who = audiences.map((a) => a.trim()).filter(Boolean);
  const langs = languages.map((l) => l.trim()).filter(Boolean);
  if (!who.length && !langs.length) return swapped ? [{ audience: "", language: "" }] : [];
  const out: MultiplyJob[] = [];
  for (const audience of who.length ? who : [""]) for (const language of langs.length ? langs : [""]) out.push({ audience, language });
  return out.slice(0, MAX_BATCH);
}
