import type { AspectRatio, Capability } from "../providers/types";

/**
 * The model picker, mirroring Higgsfield's: name, badge, one-line description,
 * searchable. Theirs lists roughly fifty curated endpoints and shows no price.
 *
 * Two changes. The endpoint is a real fal model id, so the list is a window
 * onto ~1,500 rather than a fixed shelf. And every row carries a live price
 * pulled from the provider at request time, because "Generate ⚡ 6.5" tells
 * you nothing — 6.5 of what, bought at which tier, worth how many dollars?
 */
export type ModelCard = {
  id: string;
  name: string;
  blurb: string;
  badge?: "new" | "premium" | "fast";
  capability: Capability;
  /** Aspect ratios this endpoint actually accepts. */
  ratios: readonly AspectRatio[];
  maxCount: number;
};

const IMAGE_RATIOS = ["1:1", "4:5", "3:4", "2:3", "3:2", "4:3", "16:9", "9:16", "21:9"] as const;
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"] as const;

export const MODELS: readonly ModelCard[] = [
  {
    id: "fal-ai/nano-banana-2",
    name: "Nano Banana 2",
    blurb: "Google's fast generation and editing model",
    badge: "fast",
    capability: "text-to-image",
    ratios: IMAGE_RATIOS,
    maxCount: 4,
  },
  {
    id: "fal-ai/flux-2-pro",
    name: "FLUX.2 Pro",
    blurb: "High quality text-to-image, tiered by megapixel",
    badge: "premium",
    capability: "text-to-image",
    ratios: IMAGE_RATIOS,
    maxCount: 4,
  },
  {
    id: "fal-ai/flux/dev",
    name: "FLUX.1 Dev",
    blurb: "Widely used general-purpose workhorse",
    capability: "text-to-image",
    ratios: IMAGE_RATIOS,
    maxCount: 4,
  },
  {
    id: "fal-ai/flux/schnell",
    name: "FLUX.1 Schnell",
    blurb: "Distilled for speed, cheapest per image",
    badge: "fast",
    capability: "text-to-image",
    ratios: IMAGE_RATIOS,
    maxCount: 4,
  },
  {
    id: "fal-ai/z-image/turbo",
    name: "Z-Image Turbo",
    blurb: "Speed-oriented, with image-to-image variants",
    badge: "fast",
    capability: "text-to-image",
    ratios: IMAGE_RATIOS,
    maxCount: 4,
  },
  {
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX.1 Kontext",
    blurb: "Instruction-based editing of an existing image",
    capability: "image-edit",
    ratios: IMAGE_RATIOS,
    maxCount: 2,
  },
  {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    name: "Kling 3 Pro",
    blurb: "Cinematic quality with synchronised audio",
    badge: "premium",
    capability: "text-to-video",
    ratios: VIDEO_RATIOS,
    maxCount: 1,
  },
  {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    name: "Kling 3 Pro — Animate",
    blurb: "Animates an image you supply, audio optional",
    badge: "premium",
    capability: "image-to-video",
    ratios: VIDEO_RATIOS,
    maxCount: 1,
  },
  {
    id: "fal-ai/veo3.1",
    name: "Veo 3.1",
    blurb: "Google's video model, generates synced audio",
    badge: "premium",
    capability: "text-to-video",
    ratios: VIDEO_RATIOS,
    maxCount: 1,
  },
  {
    id: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    name: "Seedance 1 Pro",
    blurb: "ByteDance video model, lite and fast tiers too",
    badge: "new",
    capability: "text-to-video",
    ratios: VIDEO_RATIOS,
    maxCount: 1,
  },
];

export const DEFAULT_MODEL = MODELS[0]!.id;

export function getModelCard(id: string): ModelCard {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]!;
}

export function searchModels(query: string): readonly ModelCard[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return MODELS;
  return MODELS.filter(
    (model) =>
      model.name.toLowerCase().includes(needle) ||
      model.blurb.toLowerCase().includes(needle) ||
      model.id.toLowerCase().includes(needle),
  );
}
