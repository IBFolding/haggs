import type { AspectRatio } from "../../providers/types";

/**
 * The ten modes, and the routing rules that pick between them, are lifted from
 * `higgsfield-ai/skills` (MIT) — that repo publishes the taxonomy and the
 * trigger vocabulary in full.
 *
 * What it does NOT publish is the prompt. Their skill is explicit about it:
 *
 *   "Never write the gpt_image_2 prompt yourself — backend assembles it."
 *   — higgsfield-product-photoshoot/SKILL.md:45
 *
 * and the README calls the marketplace equivalents "hidden prompt templates".
 * The taxonomy is the map; the prompts are the territory, and they kept the
 * territory. So the `direction` field below is ours: the photographic
 * vocabulary that a hosted enhancer would otherwise hold. It is the one part
 * of this workflow that is genuinely new work, and it is also the part that
 * stopped being a moat the moment a frontier model could write it per-request.
 */

export type ModeId =
  | "product_shot"
  | "lifestyle_scene"
  | "closeup_product_with_person"
  | "moodboard_pin"
  | "hero_banner"
  | "social_carousel"
  | "ad_creative_pack"
  | "virtual_model_tryout"
  | "conceptual_product"
  | "restyle";

export type Mode = {
  id: ModeId;
  /** One line, as the picker shows it. From the MIT skill's own mode table. */
  summary: string;
  /** Words that route a free-text request here. From the MIT skill. */
  triggers: string[];
  defaultAspect: AspectRatio;
  /** Our photographic direction — the part their backend keeps. */
  direction: {
    camera: string;
    light: string;
    staging: string;
    /** Held constant across a batch so variants read as one shoot. */
    constants: string;
  };
};

export const MODES: readonly Mode[] = [
  {
    id: "product_shot",
    summary: "Product on a neutral, studio or catalog background",
    triggers: ["product photo", "studio shot", "catalog", "packshot", "white background"],
    defaultAspect: "1:1",
    direction: {
      camera: "85mm macro on a locked tripod, sensor parallel to the product face, f/8 for edge-to-edge sharpness",
      light: "large softbox key at 45 degrees camera-left, white bounce card opposite to lift the shadow side, controlled specular roll-off along any curved edge",
      staging: "seamless sweep, product centred with generous even margin, contact shadow grounding it to the surface",
      constants: "same sweep colour, same key position, same focal length across the set",
    },
  },
  {
    id: "lifestyle_scene",
    summary: "Product in a real environment — hands, action, atmosphere",
    triggers: ["lifestyle", "in use", "real world", "instagram", "everyday", "scene"],
    defaultAspect: "4:5",
    direction: {
      camera: "35mm at chest height, slight handheld tilt, f/2.0 so the background falls away but the label stays legible",
      light: "directional window daylight with visible falloff, practical lamps allowed in frame, no on-camera flash",
      staging: "product in mid-use rather than posed, lived-in surfaces, secondary objects that imply a person just left frame",
      constants: "one location, one time of day, one wardrobe palette across the set",
    },
  },
  {
    id: "closeup_product_with_person",
    summary: "Tight crop with hands or partial face — applying, holding, demonstrating",
    triggers: ["closeup", "hands", "holding", "applying", "demonstrating", "beauty"],
    defaultAspect: "4:5",
    direction: {
      camera: "100mm macro, f/2.8, focal plane on the point of contact between hand and product",
      light: "soft wraparound key close to the subject, faint rim to separate skin from background, no hard shadow across the label",
      staging: "hands in natural mid-gesture with relaxed fingers, face cropped at or above the lip, skin texture retained",
      constants: "same hands, same manicure, same skin tone and lighting temperature across the set",
    },
  },
  {
    id: "moodboard_pin",
    summary: "Vertical Pinterest-native aesthetic, moodboard feel",
    triggers: ["pinterest", "pin", "moodboard", "vertical pin", "aesthetic"],
    defaultAspect: "2:3",
    direction: {
      camera: "50mm slightly overhead, f/4, composed with deliberate negative space in the upper third for text overlay",
      light: "diffused overcast daylight, low contrast, gentle and even",
      staging: "flat-lay or low-relief arrangement on a textured surface, restrained props in a tight tonal family",
      constants: "one surface, one palette of at most three tones, consistent prop scale across the set",
    },
  },
  {
    id: "hero_banner",
    summary: "Wide-format website, email or campaign header",
    triggers: ["hero", "banner", "website header", "landing page", "email header", "wide"],
    defaultAspect: "21:9",
    direction: {
      camera: "wide 24mm with the product held off-centre, horizon level, f/5.6",
      light: "single dominant source with a long gradient across the frame, deep clean falloff into the copy side",
      staging: "product anchored to one third, the opposing two thirds deliberately quiet for headline and call to action",
      constants: "same gradient direction and copy side across every banner in the set",
    },
  },
  {
    id: "social_carousel",
    summary: "3–10 connected slides for Instagram, LinkedIn or Facebook",
    triggers: ["carousel", "slides", "multi-slide", "swipeable", "sequence"],
    defaultAspect: "1:1",
    direction: {
      camera: "consistent 50mm across every slide, varying only distance so the sequence reads as one shoot",
      light: "identical setup on every slide — a lighting change between slides breaks the swipe",
      staging: "one idea per slide, progressing from wide establishing to detail, composition alternating side to side to create swipe rhythm",
      constants: "identical background, palette and light on every slide; distance is the only variable",
    },
  },
  {
    id: "ad_creative_pack",
    summary: "Coordinated static ad variants for Meta, TikTok, Pinterest or Google",
    triggers: ["ad", "ads", "meta ads", "tiktok", "paid social", "creative pack", "ad pack"],
    defaultAspect: "4:5",
    direction: {
      camera: "punchy 40mm, product large in frame, f/4, composed so the subject survives an aggressive centre crop",
      light: "high-key and high-contrast for thumb-stop at small size, clean specular highlight on the logo",
      staging: "one unmistakable focal point, generous safe margin for overlaid copy, nothing important within 12% of any edge",
      constants: "same product angle and palette across variants so only the concept differs, never the craft",
    },
  },
  {
    id: "virtual_model_tryout",
    summary: "Product worn or used by an AI-rendered model",
    triggers: ["try on", "virtual try-on", "model wearing", "worn by", "on a model"],
    defaultAspect: "2:3",
    direction: {
      camera: "85mm at the model's eye level, f/2.8, full or three-quarter figure with the product unobstructed",
      light: "soft key with a subtle hair rim, even skin rendering, no colour cast onto the product",
      staging: "relaxed natural posture with weight on one leg, product worn correctly and clearly visible, hands away from the label",
      constants: "same model, wardrobe palette, background and light across the set",
    },
  },
  {
    id: "conceptual_product",
    summary: "Surreal, CGI-style, levitating, splash or sculptural",
    triggers: ["cgi", "surreal", "levitating", "floating", "splash", "sculptural", "conceptual"],
    defaultAspect: "1:1",
    direction: {
      camera: "macro-tight with an exaggerated low angle for scale, f/11 so the whole construction stays sharp",
      light: "hard directional key with sculpted rim light, saturated gel accents, physically plausible shadows however unreal the scene",
      staging: "product suspended or embedded in a physically impossible construction that still obeys real gravity and contact cues",
      constants: "one material language and one accent colour across the set",
    },
  },
  {
    id: "restyle",
    summary: "Transform an existing image's aesthetic, mood or season",
    triggers: ["restyle", "seasonal", "change the mood", "different style", "re-style"],
    defaultAspect: "1:1",
    direction: {
      camera: "preserve the source framing, focal length and subject geometry exactly",
      light: "replace only the lighting character — direction, colour temperature and contrast — never the subject",
      staging: "keep product geometry, label text and proportions pixel-faithful; restyle the world around it",
      constants: "the product itself is the constant; everything else is the variable",
    },
  },
];

export const DEFAULT_MODE: ModeId = "product_shot";

export function getMode(id: ModeId): Mode {
  const found = MODES.find((mode) => mode.id === id);
  if (!found) throw new Error(`Unknown mode: ${id}`);
  return found;
}

/**
 * Routes free text to a mode using the MIT skill's own trigger vocabulary.
 * Longer triggers win, so "virtual try-on" beats a bare "on" collision.
 */
export function routeMode(text: string): Mode {
  const haystack = text.toLowerCase();
  const hits = MODES.flatMap((mode) =>
    mode.triggers
      .filter((trigger) => haystack.includes(trigger))
      .map((trigger) => ({ mode, weight: trigger.length })),
  ).sort((a, b) => b.weight - a.weight);

  return hits[0]?.mode ?? getMode(DEFAULT_MODE);
}
