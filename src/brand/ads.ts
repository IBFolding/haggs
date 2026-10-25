import { brandWords, type BrandKit } from "./brand";

/**
 * Ad formats: what to make from one product and one brand. Each format is a shape and a direction;
 * a batch is every product in every chosen format, once for each audience.
 */

export type Product = { id: string; name: string; words: string; picture: string | null; price: string };
export type AdFormat = { id: "product" | "poster" | "marketplace" | "social" | "story"; name: string; ratio: "1:1" | "4:5" | "9:16" | "16:9"; direction: string; text: boolean };

export const AD_FORMATS: AdFormat[] = [
  { id: "product", name: "Product shot", ratio: "16:9", text: false, direction: "Premium studio product photograph, the product alone as the hero, soft directional light, shallow depth of field, a surface and backdrop that suit the brand colours." },
  { id: "poster", name: "Poster", ratio: "9:16", text: true, direction: "Bold advertising poster, the product large and dramatic, a short punchy headline in the brand typography, confident layout with room to breathe." },
  { id: "marketplace", name: "Marketplace listing", ratio: "1:1", text: false, direction: "Marketplace listing photograph: the product centred on a pure white background, even soft light, true colours, no props, no text, no watermark." },
  { id: "social", name: "Social post", ratio: "4:5", text: true, direction: "Scroll-stopping social media ad, the product in a lived-in real-world moment, natural light, a short caption-style line of text in the brand typography." },
  { id: "story", name: "Story ad", ratio: "9:16", text: true, direction: "Vertical story ad, the product held or in use in a candid, handheld-feeling moment, one short line of text near the top." },
];

export const MAX_BATCH = 20;

/** The picture prompt for one product in one format, for one audience (or everyone, when it is empty). */
export function adPrompt(format: AdFormat, product: Pick<Product, "name" | "words">, kit: BrandKit | null, audience: string): string {
  const item = product.words.trim() || product.name.trim();
  return [
    `${format.name === "Poster" ? "Poster" : "Advertisement"} for ${product.name.trim()}: ${item.replace(/[.\s]+$/, "")}.`,
    format.direction,
    audience.trim() ? `Made for ${audience.trim()}: set the scene, people and mood to speak to them.` : "",
    kit ? brandWords(kit) : "",
    "Keep the product exactly as in the reference picture.",
    format.text ? "" : "No text, no watermark.",
  ].filter(Boolean).join(" ");
}

export type AdJob = { product: Product; format: AdFormat; audience: string };

/** Every product in every format, once per audience, in reading order, never more than a batch. */
export function adJobs(products: Product[], formats: AdFormat[], audiences: string[]): AdJob[] {
  const who = audiences.map((a) => a.trim()).filter(Boolean);
  const list = who.length ? who : [""];
  const out: AdJob[] = [];
  for (const product of products) for (const audience of list) for (const format of formats) out.push({ product, format, audience });
  return out.slice(0, MAX_BATCH);
}
