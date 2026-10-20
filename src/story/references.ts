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
  const still = shot.render?.kind === "image" ? shot.render.url : null;
  const images = [...(still ? [still] : []), ...(shot.refs ?? []).filter((url) => url !== still)].slice(0, Math.max(0, maxImages));
  return { images, firstFrame: Boolean(still) && images[0] === still };
}
