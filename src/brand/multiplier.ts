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

/** The instruction that remakes image 1 for an audience and/or in a language. */
export function multiplyPrompt(audience: string, language: string): string {
  const who = audience.trim();
  const lang = language.trim();
  return [
    "Recreate the advertisement in image 1.",
    "Keep the same product exactly, the same layout, the same brand colours, typography and style.",
    who ? `Remake it for ${who}: change the people, the setting and the mood so it speaks to them, and keep everything else.` : "Keep the same people, setting and mood.",
    lang ? `Translate all the text on the ad into ${lang}, spelled correctly, in the same place and style.` : "Keep the text as it is.",
    "No watermark.",
  ].join(" ");
}

export type MultiplyJob = { audience: string; language: string };

/** Every audience with every language, in reading order, never more than a batch. Either list may be empty. */
export function multiplierJobs(audiences: string[], languages: string[]): MultiplyJob[] {
  const who = audiences.map((a) => a.trim()).filter(Boolean);
  const langs = languages.map((l) => l.trim()).filter(Boolean);
  if (!who.length && !langs.length) return [];
  const out: MultiplyJob[] = [];
  for (const audience of who.length ? who : [""]) for (const language of langs.length ? langs : [""]) out.push({ audience, language });
  return out.slice(0, MAX_BATCH);
}
