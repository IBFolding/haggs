import type { Shot } from "./model";

/**
 * What a shot sends to the model besides its prompt.
 *
 * A still on the shot — a dropped picture, a storyboard frame — is the first
 * frame, so the video starts from the picture you chose. The cast and place
 * references come after it as references. Without a still, references are
 * sent as references only: a character sheet must never become the opening
 * frame of the shot.
 */
export function inputsFor(shot: Shot, maxImages: number): { images: string[]; firstFrame: boolean } {
  const still = shot.startsFrom?.frameUrl ?? (shot.render?.kind === "image" ? shot.render.url : null);
  const images = [...(still ? [still] : []), ...(shot.refs ?? []).filter((url) => url !== still)].slice(0, Math.max(0, maxImages));
  return { images, firstFrame: Boolean(still) && images[0] === still };
}

/**
 * The length to render a shot at: its own length, rounded up to a whole
 * second within the model's range. The cut trims anything longer, so a 3s
 * shot on a 4s-minimum model renders 4s and plays 3s. Null when the shot has
 * no length or the model has no duration setting.
 */
export function renderSeconds(shot: Shot, duration: { type: string; min?: number; max?: number } | undefined): number | null {
  if (!shot.seconds || !duration || duration.type !== "range") return null;
  const min = duration.min ?? 1;
  const max = duration.max ?? 60;
  return Math.min(max, Math.max(min, Math.ceil(shot.seconds)));
}
