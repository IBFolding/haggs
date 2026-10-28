import { brandWords, type BrandKit } from "./brand";
import type { Product } from "./ads";

/**
 * Marketing studio: one prompt bar for a product, with a brand kit, a person and a template pulled in.
 * The templates are ours: a direction written for open models, a shape, and a sample from our own
 * library where one fits. A template that matches a ready-made app opens that app instead.
 */

export const MODES = [
  { id: "ugc", label: "UGC", says: "A real person with your product, shot like a phone video" },
  { id: "product", label: "Product shot", says: "Your product alone, lit like a studio still" },
  { id: "motion", label: "Motion", says: "Your product moving: a short clip" },
  { id: "ads", label: "Ads", says: "A finished ad with room for a line of copy" },
  { id: "posters", label: "Posters", says: "Bold poster layouts with a headline" },
  { id: "marketplace", label: "Marketplace", says: "Clean listing photos for a shop page" },
  { id: "fashion", label: "Fashion", says: "Clothes on a person, editorial or try-on" },
] as const;
export type ModeId = (typeof MODES)[number]["id"];

export type Ratio = "1:1" | "4:5" | "9:16" | "16:9";
export type MarketingTemplate = {
  id: string;
  mode: ModeId;
  name: string;
  makes: "image" | "video";
  ratio: Ratio;
  /** The direction it adds, in plain words. */
  direction: string;
  /** A sample from our own library, or none (the tile is then drawn in the brand's colours). */
  sample?: string;
  /** Who made the sample when it was not haggs: shown on the tile, so a sample never passes for our own output. */
  madeWith?: "ChatGPT";
  /** A ready-made app that does this job end to end; the template opens it. */
  app?: string;
  /** Needs a person (a saved character or a photo). */
  person?: true;
};

export const TEMPLATES: MarketingTemplate[] = [
  { id: "ugc-hold", mode: "ugc", name: "Holding it up", makes: "image", ratio: "9:16", person: true, sample: "/quick/ugc-hand.webp", app: "ugc-hand", direction: "Phone-camera selfie of a person holding the product up to the lens, natural window light, candid smile, slightly imperfect framing." },
  { id: "ugc-talk", mode: "ugc", name: "Talking to camera", makes: "video", ratio: "9:16", person: true, sample: "/templates/ugc-talking.mp4", direction: "A person talks to a phone camera about the product, holding it in frame, casual home setting, handheld, natural light." },
  { id: "ugc-unbox", mode: "ugc", name: "Unboxing", makes: "image", ratio: "9:16", sample: "/marketing/ugc-unbox.webp", madeWith: "ChatGPT", person: true, direction: "Top-down phone shot of hands opening a box and lifting the product out, tissue paper, a kitchen table, warm morning light." },
  { id: "ugc-mirror", mode: "ugc", name: "Mirror selfie", makes: "image", ratio: "9:16", sample: "/marketing/ugc-mirror.webp", madeWith: "ChatGPT", person: true, direction: "Mirror selfie of a person using the product, phone visible, bedroom or bathroom mirror, soft daylight, everyday and real." },
  { id: "ugc-before-after", mode: "ugc", name: "Before and after", makes: "image", ratio: "4:5", sample: "/marketing/ugc-before-after.webp", madeWith: "ChatGPT", person: true, direction: "Split frame, left before and right after using the product, the same person and pose, the same light, a clear honest difference." },
  { id: "shot-hero", mode: "product", name: "Studio hero", makes: "image", ratio: "4:5", sample: "/templates/product-hero.webp", direction: "Premium studio photograph, the product alone as the hero, soft directional key light, a gentle gradient backdrop in the brand colours, shallow depth of field." },
  { id: "shot-ice", mode: "product", name: "On ice", makes: "image", ratio: "4:5", sample: "/marketing/shot-ice.webp", madeWith: "ChatGPT", direction: "The product resting on crushed ice with cold condensation beading on it, crisp backlight, frosty blue shadows, macro detail." },
  { id: "shot-splash", mode: "product", name: "Splash", makes: "image", ratio: "4:5", sample: "/marketing/shot-splash.webp", madeWith: "ChatGPT", direction: "The product caught mid-splash, droplets frozen in the air around it, high-speed flash, a clean coloured backdrop." },
  { id: "shot-pedestal", mode: "product", name: "On a pedestal", makes: "image", ratio: "1:1", sample: "/marketing/shot-pedestal.webp", madeWith: "ChatGPT", direction: "The product on a stone pedestal, hard sunlight casting a long graphic shadow, a plain wall in the brand colour." },
  { id: "shot-nature", mode: "product", name: "In nature", makes: "image", ratio: "4:5", sample: "/marketing/shot-nature.webp", madeWith: "ChatGPT", direction: "The product placed on moss and stones in a forest clearing, dappled sunlight, shallow depth of field, a calm natural mood." },
  { id: "shot-hand", mode: "product", name: "In a hand", makes: "image", ratio: "4:5", person: true, sample: "/quick/product-in-hand.webp", app: "product-in-hand", direction: "A hand holding the product toward the camera, the product sharp and the background soft, natural light." },
  { id: "motion-orbit", mode: "motion", name: "Orbit", makes: "video", ratio: "9:16", sample: "/templates/product-orbit.mp4", direction: "The camera orbits slowly around the product on a turntable, studio light sweeping across it, a clean backdrop." },
  { id: "motion-placement", mode: "motion", name: "In a scene", makes: "video", ratio: "16:9", sample: "/templates/product-placement.mp4", direction: "The product sits in a lived-in scene while the camera drifts in slowly, gentle movement in the background, warm natural light." },
  { id: "motion-ad", mode: "motion", name: "Photo to ad clip", makes: "video", ratio: "9:16", sample: "/quick/product-ad.webp", app: "product-ad", direction: "Restage the product photo as an ad and animate it into a short clip." },
  { id: "motion-macro", mode: "motion", name: "Macro drift", makes: "video", ratio: "9:16", sample: "/marketing/motion-macro-still.webp", madeWith: "ChatGPT", direction: "Extreme close-up of the product's surface and texture, the camera drifting across it slowly, light glinting, shallow focus." },
  { id: "ads-grid", mode: "ads", name: "Nine-shot grid", makes: "image", ratio: "1:1", sample: "/quick/product-grid.webp", app: "product-grid", direction: "One product photo as a 3×3 grid of ad frames." },
  { id: "ads-swap", mode: "ads", name: "Into an ad you like", makes: "image", ratio: "4:5", sample: "/quick/swap-ad.webp", app: "swap-ad", direction: "Put the product into an existing ad, replacing theirs." },
  { id: "ads-sequence", mode: "ads", name: "Cinematic sequence", makes: "image", ratio: "16:9", sample: "/quick/product-sequence.webp", app: "product-sequence", direction: "A cinematic ad sequence of the product." },
  { id: "ads-social", mode: "ads", name: "Social ad", makes: "image", ratio: "4:5", sample: "/samples/ad-kettle.jpg", direction: "Scroll-stopping social ad, the product in a real everyday moment, natural light, clear space at the top for one short line of copy." },
  { id: "ads-callout", mode: "ads", name: "Feature callouts", makes: "image", ratio: "4:5", sample: "/marketing/ads-callout.webp", madeWith: "ChatGPT", direction: "The product centred on a clean backdrop with three thin callout lines pointing to its best features, short labels in a simple sans-serif." },
  { id: "poster-bold", mode: "posters", name: "Bold headline", makes: "image", ratio: "4:5", sample: "/marketing/poster-bold.webp", madeWith: "ChatGPT", direction: "Bold advertising poster, the product large and dramatic, one short punchy headline in heavy type, the brand colours, plenty of space." },
  { id: "poster-pop", mode: "posters", name: "Pop burst", makes: "image", ratio: "4:5", sample: "/marketing/poster-pop.webp", madeWith: "ChatGPT", direction: "Retro pop-art poster, the product over a starburst of bright colour, halftone dots, a big comic-style headline." },
  { id: "poster-mockups", mode: "posters", name: "In real scenes", makes: "image", ratio: "4:5", sample: "/quick/mockups.webp", app: "mockups", direction: "A poster shown in four real scenes." },
  { id: "poster-minimal", mode: "posters", name: "Minimal", makes: "image", ratio: "4:5", sample: "/marketing/poster-minimal.webp", madeWith: "ChatGPT", direction: "Minimal Swiss-style poster, the product small and precise, one line of type, a single brand colour field, lots of empty space." },
  { id: "market-white", mode: "marketplace", name: "White background", makes: "image", ratio: "1:1", sample: "/marketing/market-white.webp", madeWith: "ChatGPT", direction: "Marketplace listing photograph: the product centred on a pure white background, even soft light, true colours, no props, no text." },
  { id: "market-angles", mode: "marketplace", name: "Three angles", makes: "image", ratio: "1:1", sample: "/marketing/market-angles.webp", madeWith: "ChatGPT", direction: "The product shown from the front, the side and the back on a pure white background, even light, true colours, no text." },
  { id: "market-lifestyle", mode: "marketplace", name: "Lifestyle", makes: "image", ratio: "1:1", sample: "/marketing/market-lifestyle.webp", madeWith: "ChatGPT", direction: "The product in use in a bright, tidy home, natural light, the product clearly the subject, no text." },
  { id: "market-scale", mode: "marketplace", name: "Shows its size", makes: "image", ratio: "1:1", sample: "/marketing/market-scale.webp", madeWith: "ChatGPT", direction: "The product beside an everyday object that shows its size, on a white surface, even light, no text." },
  { id: "fashion-try", mode: "fashion", name: "Try it on", makes: "image", ratio: "4:5", person: true, sample: "/quick/try-on.webp", app: "try-on", direction: "A person wearing the garment." },
  { id: "fashion-editorial", mode: "fashion", name: "Editorial", makes: "image", ratio: "4:5", person: true, sample: "/quick/editorial.webp", app: "editorial", direction: "Fashion editorial frames of a person, a place and the product." },
  { id: "fashion-flat", mode: "fashion", name: "Flat lay to shoot", makes: "image", ratio: "4:5", person: true, sample: "/quick/flat-lay.webp", app: "flat-lay", direction: "A flat lay of clothes becomes a studio shoot." },
  { id: "fashion-video", mode: "fashion", name: "Fashion clip", makes: "video", ratio: "9:16", person: true, sample: "/quick/fashion-video.webp", app: "fashion-video", direction: "A person and an outfit become a short fashion clip." },
];

export type Brief = { words: string; template?: MarketingTemplate | null; product?: Pick<Product, "name" | "words"> | null; kit?: BrandKit | null; person?: string | null };

/** The prompt for a brief, in plain words: what you typed, the template's direction, the product, the brand and the person. */
export function marketingPrompt(b: Brief): string {
  const item = b.product ? (b.product.words.trim() || b.product.name.trim()).replace(/[.\s]+$/, "") : "";
  return [
    b.words.trim().replace(/[.\s]+$/, "") ? `${b.words.trim().replace(/[.\s]+$/, "")}.` : "",
    b.template?.direction ?? "",
    b.product ? `The product is ${b.product.name.trim()}: ${item}. Keep it exactly as in the reference picture.` : "",
    b.person ? `The person: ${b.person}` : "",
    b.kit ? brandWords(b.kit) : "",
    "No watermark.",
  ].filter(Boolean).join(" ");
}

/** Templates for a mode and a kind, in their order. */
export function templatesFor(mode: ModeId | "all", makes: "all" | "image" | "video"): MarketingTemplate[] {
  return TEMPLATES.filter((t) => (mode === "all" || t.mode === mode) && (makes === "all" || t.makes === makes));
}
