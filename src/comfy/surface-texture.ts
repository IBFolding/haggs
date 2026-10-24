/** The words for finding a wall or floor in the footage, and for making a material to put on it. */

export function surfaceWords(label: string, words: string): string {
  const w = words.trim().slice(0, 120);
  if (w) return w;
  const l = label.trim().toLowerCase();
  return l ? `the ${l}` : "the surface";
}

/** A flat, repeating material: no horizon, no objects, even light, so it tiles without a seam. */
export function texturePrompt(words: string): string {
  const w = words.trim().slice(0, 200).replace(/[.\s]+$/, "");
  if (!w) return "";
  return `Seamless tileable texture of ${w}. Flat, straight-on, even lighting, no perspective, no horizon, no objects, no text, the material fills the whole frame.`;
}
