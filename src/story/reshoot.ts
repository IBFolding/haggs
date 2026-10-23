import { clipSeconds } from "./cut";
import type { Shot } from "./model";

/**
 * Reshoot: the same scene from another angle, as coverage you can cut to.
 * A frame from the shot is the reference; the new still keeps the people,
 * wardrobe, place and light, and moves the camera.
 */

export const ANGLES = [
  { id: "reverse", label: "Reverse", words: "a reverse angle, the camera turned around to face the other way" },
  { id: "wide", label: "Wide", words: "a wide shot that shows the whole place around them" },
  { id: "close", label: "Close-up", words: "a close-up on the main person's face" },
  { id: "low", label: "Low angle", words: "a low angle looking up at them" },
  { id: "high", label: "High angle", words: "a high angle looking down on them" },
  { id: "ots", label: "Over the shoulder", words: "an over-the-shoulder shot from behind the other person" },
  { id: "profile", label: "Profile", words: "a side-on profile shot" },
  { id: "top", label: "Top-down", words: "a top-down shot from directly above" },
] as const;
export type AngleId = (typeof ANGLES)[number]["id"];

export function reshootPrompt(angle: AngleId, beat: string): string {
  const a = ANGLES.find((x) => x.id === angle);
  if (!a) throw new Error("Pick an angle to reshoot from.");
  // The beat without any spoken line a board put on it.
  const what = (beat.split(" — ")[0] ?? beat).trim();
  return `The same scene as image 1, at the same moment: the same people with the same faces, hair and clothes, the same place, props and light. Now seen from ${a.words}.${what ? ` The scene: ${what}.` : ""} Cinematic film still, natural, no text.`;
}

/** Where to take the reference frame: the middle of what you see of the shot. */
export function reshootFrameAt(shot: Shot): number {
  if (shot.render?.kind !== "video") return 0;
  return Math.round(((shot.trimIn ?? 0) + clipSeconds(shot) / 2) * 1000) / 1000;
}
