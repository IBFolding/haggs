import type { ApiPrompt } from "./convert";

/** A prop picture from words: ask for the object alone on white, then cut it out with BiRefNet (open weights, GPU time only). */

export const PROP_INPUT = "1/image";

/** The words that make a picture easy to cut out: one whole object, alone, plain background, no shadow to cut around. */
export function propPrompt(words: string): string {
  const w = words.trim().slice(0, 300).replace(/[.\s]+$/, "");
  if (!w) return "";
  return `${w}. One single whole object, fully in frame, centered, isolated on a plain white background, soft even studio lighting, no shadow, no floor, no other objects, no text.`;
}

export function propCutoutPrompt(): ApiPrompt {
  return {
    "1": { class_type: "LoadImage", inputs: { image: "prop.png" } },
    "2": { class_type: "LoadBackgroundRemovalModel", inputs: { bg_removal_name: "birefnet.safetensors" } },
    "3": { class_type: "RemoveBackground", inputs: { image: ["1", 0], bg_removal_model: ["2", 0] } },
    "4": { class_type: "InvertMask", inputs: { mask: ["3", 0] } },
    "5": { class_type: "JoinImageWithAlpha", inputs: { image: ["1", 0], alpha: ["4", 0] } },
    "6": { class_type: "SaveImage", inputs: { images: ["5", 0], filename_prefix: "haggs/prop" } },
  } as unknown as ApiPrompt;
}
