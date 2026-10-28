import type { GameSpec, Slot } from "./spec";

/**
 * Prompts for a game's art. Sprites are asked for on flat magenta, which the
 * renderer keys out, because image models don't reliably give transparency.
 * Backgrounds are wide and empty, so the game reads on top of them.
 */

/** The image model art is made with: the cheapest Comfy Cloud picture model. */
export const ART_MODEL = "google/nano-banana-2-lite";
export const KEY_COLOUR = "#ff00ff";

/** With `follow`, the request carries a reference picture (a character, a place, an upload) to base the art on. */
export function artPrompt(spec: GameSpec, slot: Slot, follow = false): string {
  const look = `${spec.title}: ${spec.pitch}`;
  if (slot.kind === "background") {
    return [
      slot.art.prompt,
      ...(follow ? ["Base the place, its light and its colours on the reference picture."] : []),
      `Wide 16:9 2D game background for "${look}".`,
      "Flat, clean, readable shapes, nothing in the foreground, no characters, no text, no UI, no border.",
    ].join(" ");
  }
  return [
    `A single 2D game sprite: ${slot.art.prompt}.`,
    ...(follow ? ["Base it on the reference picture: the same subject, face, shape, outfit and colours, simplified into a sprite."] : []),
    `For the game "${look}".`,
    `Centred, the whole subject in frame, bold outline, flat colours, on a perfectly flat solid magenta (${KEY_COLOUR}) background with no shadow, no ground, no text and no border.`,
  ].join(" ");
}

/** Settings for the art model: square sprites, wide backgrounds, the smallest resolution. */
export function artSettings(slot: Slot): Record<string, unknown> {
  return { aspect_ratio: slot.kind === "background" ? "16:9" : "1:1", resolution: "1K", thinking: "MINIMAL" };
}

/**
 * How near a pixel is to the key colour, 0 (exactly it) to 1 (far). Magenta
 * is high red, high blue, low green; edges blend towards it, so a soft band
 * fades out rather than leaving a pink fringe.
 */
export function keyDistance(r: number, g: number, b: number): number {
  const magenta = Math.min(r, b) - g;
  return magenta > 120 ? 0 : magenta < 40 ? 1 : (120 - magenta) / 80;
}

/** Keys an RGBA buffer in place: magenta goes transparent, near-magenta goes partly so. */
export function keyOut(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const d = keyDistance(data[i]!, data[i + 1]!, data[i + 2]!);
    if (d < 1) data[i + 3] = Math.round(data[i + 3]! * d);
  }
}
