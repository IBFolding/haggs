import type { Capability } from "../providers/types";
import type { SettingFields } from "./settings";

/**
 * The model picker, mirroring Higgsfield's: name, badge, one-line description,
 * searchable. Theirs lists roughly fifty curated endpoints and shows no price.
 *
 * Two changes. The endpoint is a real fal model id, so the list is a window
 * onto ~1,500 rather than a fixed shelf. And every row carries a live price
 * pulled from the provider at request time, because "Generate ⚡ 6.5" tells
 * you nothing — 6.5 of what, bought at which tier, worth how many dollars?
 *
 * Each card declares the settings its endpoint actually accepts, and the
 * composer renders exactly those. The settings below are transcribed from
 * fal's published OpenAPI schema per endpoint, not assumed: the same idea is
 * `aspect_ratio` on Nano Banana, Kontext, Kling, Veo and Seedance but
 * `image_size` on every FLUX and on Z-Image. A single shared control sending
 * `aspect_ratio` to all of them is a control that silently does nothing on
 * four of these ten.
 */
export type ModelCard = {
  /** Which backend runs this. Comfy Router is the platform; fal stays available. */
  provider: "comfy" | "fal";
  /**
   * The request shape this endpoint accepts. Router models disagree: MiniMax H3
   * requires a `content` array, FLUX 3 and LTX take a plain `prompt`.
   */
  bodyStyle?: "content" | "prompt";
  id: string;
  name: string;
  blurb: string;
  badge?: "new" | "premium" | "fast";
  capability: Capability;
  /** How many images this endpoint accepts as input. 0 means text-only. */
  inputImages: number;
  settings: SettingFields;
};

/** fal's shared FLUX/Z-Image size vocabulary. Not aspect ratios — named sizes. */
const IMAGE_SIZE = [
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
] as const;

const imageSize = (): SettingFields["x"] => ({
  type: "enum",
  label: "Size",
  values: IMAGE_SIZE,
  default: "square_hd",
  input: "image_size",
});

const count = (max: number): SettingFields["x"] => ({
  type: "range",
  label: "Images",
  min: 1,
  max,
  default: 1,
  input: "num_images",
});

const format = (values: readonly string[]): SettingFields["x"] => ({
  type: "enum",
  label: "Format",
  values,
  default: values[0]!,
  input: "output_format",
});

const aspect = (values: readonly string[], fallback: string): SettingFields["x"] => ({
  type: "enum",
  label: "Aspect",
  values,
  default: fallback,
  input: "aspect_ratio",
});

const audio = (): SettingFields["x"] => ({
  type: "boolean",
  label: "Audio",
  default: false,
  input: "generate_audio",
});

const seconds = (values: readonly string[], fallback: string): SettingFields["x"] => ({
  type: "enum",
  label: "Duration",
  values,
  default: fallback,
  input: "duration",
});

/** fal stays built but is switched off until it is rolled out (NEXT_PUBLIC_ENABLE_FAL=1), so nobody is asked for a key it can't use yet. */
export const FAL_ENABLED = process.env.NEXT_PUBLIC_ENABLE_FAL === "1";

const ALL_MODELS: readonly ModelCard[] = [
  /* ── Comfy Router ──────────────────────────────────────────────────────
     Settings below are transcribed from each model's published Router schema
     at docs.comfy.org/router-schemas/<provider>/<model>.json, not assumed. */
  {
    provider: "comfy",
    bodyStyle: "content",
    id: "minimax/minimax-h3",
    name: "MiniMax H3",
    blurb: "Video with native audio, from text or a first frame",
    badge: "new",
    capability: "text-to-video",
    // One first frame, or up to nine cast and place references.
    inputImages: 9,
    settings: {
      duration: { type: "range", label: "Duration", min: 4, max: 15, default: 6, unit: "s" },
      resolution: { type: "enum", label: "Resolution", values: ["768P", "2K"], default: "768P" },
      ratio: aspect(["16:9", "9:16", "1:1"], "16:9"),
    },
  },
  {
    provider: "comfy",
    bodyStyle: "prompt",
    id: "bfl/flux-3-image",
    name: "FLUX 3",
    blurb: "Black Forest Labs' flagship image model",
    badge: "premium",
    capability: "text-to-image",
    inputImages: 4,
    settings: {
      aspectRatio: aspect(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], "auto"),
      resolution: { type: "enum", label: "Resolution", values: ["1k", "2k", "4k"], default: "1k" },
      safetyTolerance: { type: "range", label: "Safety", min: 0, max: 4, default: 2, input: "safety_tolerance" },
    },
  },
  {
    provider: "comfy",
    bodyStyle: "prompt",
    id: "bfl/flux-3-video",
    name: "FLUX 3 Video",
    blurb: "FLUX 3 moving, with audio",
    badge: "new",
    capability: "text-to-video",
    inputImages: 1,
    settings: {
      aspectRatio: aspect(["auto", "16:9", "9:16", "1:1"], "16:9"),
    },
  },
  {
    provider: "comfy",
    bodyStyle: "prompt",
    id: "ltx/ltx-2-5-pro",
    name: "LTX 2.5 Pro",
    blurb: "Long takes at high resolution, with audio",
    badge: "premium",
    capability: "text-to-video",
    inputImages: 0,
    settings: {
      duration: seconds(["2", "3", "4", "5", "6", "8", "10", "12", "14", "16", "18", "20"], "6"),
      resolution: {
        type: "enum",
        label: "Resolution",
        values: ["1280x720", "1920x1080", "2560x1440", "720x1280", "1080x1920"],
        default: "1280x720",
      },
      fps: { type: "enum", label: "FPS", values: ["24", "25", "48", "50"], default: "25" },
      generateAudio: audio(),
    },
  },
  {
    provider: "comfy",
    bodyStyle: "prompt",
    id: "ltx/ltx-2-5-fast",
    name: "LTX 2.5 Fast",
    blurb: "The quick LTX pass, for iterating",
    badge: "fast",
    capability: "text-to-video",
    inputImages: 0,
    settings: {
      duration: seconds(["2", "3", "4", "5", "6", "8", "10"], "4"),
      resolution: { type: "enum", label: "Resolution", values: ["1280x720", "720x1280"], default: "1280x720" },
      generateAudio: audio(),
    },
  },

  /* ── fal, reached directly ─────────────────────────────────────────── */
  {
    provider: "fal",
    id: "fal-ai/nano-banana-2",
    name: "Nano Banana 2",
    blurb: "Google's fast generation and editing model",
    badge: "fast",
    capability: "text-to-image",
    inputImages: 0,
    settings: {
      aspectRatio: aspect(
        ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
        "1:1",
      ),
      resolution: { type: "enum", label: "Resolution", values: ["0.5K", "1K", "2K", "4K"], default: "1K" },
      count: count(4),
      outputFormat: format(["jpeg", "png", "webp"]),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/flux-2-pro",
    name: "FLUX.2 Pro",
    blurb: "High quality text-to-image, tiered by megapixel",
    badge: "premium",
    capability: "text-to-image",
    inputImages: 0,
    settings: { imageSize: imageSize(), outputFormat: format(["jpeg", "png"]) },
  },
  {
    provider: "fal",
    id: "fal-ai/flux/dev",
    name: "FLUX.1 Dev",
    blurb: "Widely used general-purpose workhorse",
    capability: "text-to-image",
    inputImages: 0,
    settings: { imageSize: imageSize(), count: count(4), outputFormat: format(["jpeg", "png"]) },
  },
  {
    provider: "fal",
    id: "fal-ai/flux/schnell",
    name: "FLUX.1 Schnell",
    blurb: "Distilled for speed, cheapest per image",
    badge: "fast",
    capability: "text-to-image",
    inputImages: 0,
    settings: { imageSize: imageSize(), count: count(4), outputFormat: format(["jpeg", "png"]) },
  },
  {
    provider: "fal",
    id: "fal-ai/z-image/turbo",
    name: "Z-Image Turbo",
    blurb: "Very fast, very cheap, good for iteration",
    badge: "fast",
    capability: "text-to-image",
    inputImages: 0,
    settings: {
      imageSize: imageSize(),
      count: count(4),
      outputFormat: format(["jpeg", "png", "webp"]),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX.1 Kontext",
    blurb: "Edit an image with an instruction, keeping the rest",
    capability: "image-edit",
    inputImages: 1,
    settings: {
      aspectRatio: aspect(
        ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
        "1:1",
      ),
      count: count(4),
      outputFormat: format(["jpeg", "png"]),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    name: "Kling 3 Pro",
    blurb: "Premium text-to-video with strong motion",
    badge: "premium",
    capability: "text-to-video",
    inputImages: 0,
    settings: {
      aspectRatio: aspect(["16:9", "9:16", "1:1"], "16:9"),
      duration: seconds(["3", "4", "5", "6", "7", "8", "9", "10"], "5"),
      generateAudio: audio(),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    name: "Kling 3 Pro — Animate",
    blurb: "Bring a still image to life",
    badge: "premium",
    capability: "image-to-video",
    inputImages: 1,
    // No aspect here on purpose: the endpoint takes its framing from the image.
    settings: {
      duration: seconds(["3", "4", "5", "6", "7", "8", "9", "10"], "5"),
      generateAudio: audio(),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/veo3.1",
    name: "Veo 3.1",
    blurb: "Google's flagship video model, with native audio",
    badge: "new",
    capability: "text-to-video",
    inputImages: 0,
    settings: {
      aspectRatio: aspect(["16:9", "9:16"], "16:9"),
      resolution: { type: "enum", label: "Resolution", values: ["720p", "1080p", "4k"], default: "720p" },
      duration: seconds(["4s", "6s", "8s"], "8s"),
      generateAudio: audio(),
    },
  },
  {
    provider: "fal",
    id: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    name: "Seedance 1 Pro",
    blurb: "Fast, controllable video at a low rate",
    capability: "text-to-video",
    inputImages: 0,
    settings: {
      aspectRatio: aspect(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], "16:9"),
      resolution: { type: "enum", label: "Resolution", values: ["480p", "720p", "1080p"], default: "720p" },
      duration: seconds(["3", "4", "5", "6", "7", "8", "9", "10"], "5"),
    },
  },
];

export const MODELS: readonly ModelCard[] = ALL_MODELS.filter((m) => FAL_ENABLED || m.provider !== "fal");

export const DEFAULT_MODEL = MODELS[0]!.id;

export function getModelCard(id: string): ModelCard {
  const found = MODELS.find((model) => model.id === id);
  if (!found) throw new Error(`Unknown model: ${id}`);
  return found;
}

export function searchModels(hunt: string): readonly ModelCard[] {
  const needle = hunt.trim().toLowerCase();
  if (!needle) return MODELS;
  return MODELS.filter((model) =>
    `${model.name} ${model.blurb} ${model.id}`.toLowerCase().includes(needle),
  );
}

/** How many outputs a run will produce, for the cost on the button. */
export function outputCount(card: ModelCard, settings: Record<string, unknown>): number {
  const held = settings.count;
  if (!card.settings.count || typeof held !== "number") return 1;
  return held;
}
