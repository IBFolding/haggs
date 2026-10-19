import type { AspectRatio } from "../../providers/types";
import { getMode, routeMode, type Mode, type ModeId } from "./modes";

/**
 * The local replacement for Higgsfield's hosted prompt enhancer.
 *
 * Their CLI sends a short brief and a mode; their server expands it into the
 * real generation prompt and never shows you what it sent. That hosted step is
 * the product — and it is also the reason you cannot take a Higgsfield
 * workflow anywhere else, or audit why a shot came out wrong, or version a
 * prompt alongside the brand it belongs to.
 *
 * Here the expansion is a pure function: same brief in, same prompt out, fully
 * inspectable and diffable. That is the actual trade. Theirs is probably
 * tuned on more outputs than ours; ours is one you can read, fork and pin.
 */

export type ShootBrief = {
  /** What the user typed. Routes the mode when one is not given. */
  brief: string;
  mode?: ModeId;
  /** Product name as it should read in frame, e.g. "matte black water bottle". */
  product?: string;
  count?: number;
  aspectRatio?: AspectRatio;
  /** Brand palette, tone or rules that must hold across the whole set. */
  brand?: string;
};

export type EnhancedPrompt = {
  index: number;
  mode: ModeId;
  aspectRatio: AspectRatio;
  prompt: string;
  /** The scene angle that distinguishes this frame from its siblings. */
  variant: string;
};

/**
 * Variant axes per mode. A batch that varies nothing is five copies of one
 * photo; a batch that varies everything is five unrelated photos. These move
 * exactly one thing — the situation — while `direction.constants` pins craft,
 * which is what makes a set read as one shoot.
 */
const VARIANTS: Record<ModeId, readonly string[]> = {
  product_shot: [
    "straight-on hero angle",
    "three-quarter turn revealing depth",
    "low angle looking slightly up for presence",
    "top-down flat orientation",
    "tight crop on the material and finish",
  ],
  lifestyle_scene: [
    "morning light on a kitchen counter",
    "on a desk mid-work, hands nearby",
    "outdoors on a café table",
    "in a gym bag, gear around it",
    "evening, warm lamp, wind-down moment",
  ],
  closeup_product_with_person: [
    "mid-application, product tilted to camera",
    "held at rest between both hands",
    "one hand lifting it from a surface",
    "fingers on the cap or closure",
    "product against the collarbone, face cropped",
  ],
  moodboard_pin: [
    "flat-lay with three supporting objects",
    "single object on textured linen",
    "two products in a tonal pair",
    "product with dried botanicals",
    "product beside an open notebook",
  ],
  hero_banner: [
    "product right third, copy space left",
    "product left third, copy space right",
    "product low in frame, sky-like gradient above",
    "product at the vanishing point of a long surface",
    "product partially cropped at the frame edge",
  ],
  social_carousel: [
    "slide 1, wide establishing shot",
    "slide 2, mid-distance in context",
    "slide 3, detail on the key feature",
    "slide 4, in-hand for scale",
    "slide 5, final beauty shot",
  ],
  ad_creative_pack: [
    "product centred, maximum scale",
    "product with a bold colour-block ground",
    "product mid-air against flat colour",
    "product with an implied before-and-after split",
    "product held toward camera, arm extended",
  ],
  virtual_model_tryout: [
    "full figure, relaxed stance",
    "three-quarter turn, product toward camera",
    "seated, product resting naturally",
    "walking mid-stride",
    "close three-quarter, product at chest height",
  ],
  conceptual_product: [
    "levitating above a mirrored plane",
    "emerging from a liquid splash crown",
    "embedded in a geometric sculptural form",
    "orbited by its own ingredients",
    "scaled monumentally against a plain horizon",
  ],
  restyle: [
    "cool winter palette",
    "warm autumn palette",
    "high-summer daylight",
    "muted editorial monochrome",
    "saturated tropical colour",
  ],
};

function sentence(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(". ");
}

function assemble(mode: Mode, brief: ShootBrief, variant: string): string {
  const subject = brief.product ?? brief.brief;
  return sentence([
    `${subject}, ${variant}`,
    `Camera: ${mode.direction.camera}`,
    `Light: ${mode.direction.light}`,
    `Staging: ${mode.direction.staging}`,
    brief.brand ? `Brand: ${brief.brand}` : undefined,
    `Consistency: ${mode.direction.constants}`,
    "Photographic, not illustrated. No text, watermark or logo overlay unless it is physically printed on the product itself",
  ]);
}

export function enhance(brief: ShootBrief): EnhancedPrompt[] {
  const mode = brief.mode ? getMode(brief.mode) : routeMode(brief.brief);
  const aspectRatio = brief.aspectRatio ?? mode.defaultAspect;
  const count = Math.max(1, Math.min(brief.count ?? 1, 10));
  const axis = VARIANTS[mode.id];

  return Array.from({ length: count }, (_unused, index) => {
    // Cycling past the axis length repeats a situation rather than inventing
    // one; a repeated situation still differs by seed, which is honest.
    const variant = axis[index % axis.length] ?? "hero angle";
    return {
      index,
      mode: mode.id,
      aspectRatio,
      prompt: assemble(mode, brief, variant),
      variant,
    };
  });
}
