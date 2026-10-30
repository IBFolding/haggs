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
export function adPrompt(format: AdFormat, product: Pick<Product, "name" | "words"> & Partial<Pick<Product, "price" | "picture">>, kit: BrandKit | null, audience: string, brief: AdBrief = EMPTY_AD_BRIEF): string {
  const item = product.words.trim() || product.name.trim();
  return [
    `${format.name === "Poster" ? "Poster" : "Advertisement"} for ${product.name.trim()}: ${item.replace(/[.\s]+$/, "")}.`,
    format.text && brief.direction.trim() ? `Creative direction: ${brief.direction.trim()}` : format.direction,
    brief.notes.trim() ? `Campaign brief: ${brief.notes.trim()}` : "",
    format.text && brief.headline.trim() ? `Use this headline: ${JSON.stringify(brief.headline.trim())}.` : "",
    format.text && brief.cta.trim() ? `Call to action: ${JSON.stringify(brief.cta.trim())}.` : "",
    format.text && product.price?.trim() ? `The supplied price or offer is ${JSON.stringify(product.price.trim())}.` : "",
    "Do not invent prices, discounts, testimonials, certifications or performance claims.",
    audience.trim() ? `Made for ${audience.trim()}: set the scene, people and mood to speak to them.` : "",
    kit ? brandWords(kit) : "",
    product.picture ? "Keep the product exactly as in the reference picture." : "Draw the product from its supplied description; no product reference photo was supplied.",
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

/** Shared campaign direction; optional so existing saved drafts keep working. */
export type AdBrief = { templateId: string; direction: string; headline: string; cta: string; notes: string };
export const EMPTY_AD_BRIEF: AdBrief = { templateId: "", direction: "", headline: "", cta: "", notes: "" };

export function plannedAdCount(products: number, formats: number, audiences: string[]): number {
  return products * formats * Math.max(1, audiences.filter((a) => a.trim()).length);
}
