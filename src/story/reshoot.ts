import { clipSeconds } from "./cut";
import type { Shot } from "./model";

/**
 * Reshoot: the same scene from another camera. You move a dial — around the
 * subject, up or down, closer or wider — and a frame from the shot becomes a
 * new picture with the people, wardrobe, place and light kept and only the
 * camera moved.
 */

/** Where the camera has gone from where it was. az: degrees around the subject (+ right, − left, ±180 the reverse); el: degrees up (+) or down (−); zoom: −1 closer … +1 wider. */
export type Camera = { az: number; el: number; zoom: number };
export const SAME: Camera = { az: 0, el: 0, zoom: 0 };

export const sameCamera = (c: Camera) => Math.abs(c.az) < 12 && Math.abs(c.el) < 10 && Math.abs(c.zoom) < 0.25;

export const PRESETS: { id: string; label: string; move: Camera }[] = [
  { id: "reverse", label: "Reverse", move: { az: 180, el: 0, zoom: 0 } },
  { id: "profile", label: "Profile", move: { az: 90, el: 0, zoom: 0 } },
  { id: "three-quarter", label: "Three-quarter", move: { az: 40, el: 0, zoom: 0 } },
  { id: "low", label: "Low angle", move: { az: 0, el: -30, zoom: 0 } },
  { id: "high", label: "High angle", move: { az: 0, el: 40, zoom: 0 } },
  { id: "top", label: "Top-down", move: { az: 0, el: 75, zoom: 0 } },
  { id: "wide", label: "Wide", move: { az: 0, el: 0, zoom: 1 } },
  { id: "close", label: "Close-up", move: { az: 0, el: 0, zoom: -1 } },
];

/** The camera move as one plain sentence. */
export function cameraWords(c: Camera): string {
  const side = c.az > 0 ? "right" : "left";
  const a = Math.abs(c.az);
  const parts: string[] = [];
  if (a >= 150) parts.push("a reverse angle, the camera turned around to face the opposite way");
  else if (a >= 120) parts.push(`a three-quarter view from behind on the ${side}`);
  else if (a >= 65) parts.push(`a side-on profile from the ${side}`);
  else if (a >= 12) parts.push(`a three-quarter view from the ${side}`);
  if (c.el >= 60) parts.push("a top-down shot from directly above");
  else if (c.el >= 10) parts.push("a high angle looking down");
  else if (c.el <= -10) parts.push("a low angle looking up");
  if (c.zoom <= -0.25) parts.push("a closer, tighter framing");
  else if (c.zoom >= 0.25) parts.push("pulled back to a wider framing that shows more of the place");
  return parts.join(", ");
}

export function reshootPrompt(move: Camera, beat: string): string {
  if (sameCamera(move)) throw new Error("Move the camera first: drag it around the subject, or pick an angle.");
  // The beat without any spoken line a board put on it.
  const what = (beat.split(" — ")[0] ?? beat).trim();
  return `The same scene as image 1, at the same moment: the same people with the same faces, hair and clothes, the same place, props and light. Now seen from ${cameraWords(move)}.${what ? ` The scene: ${what}.` : ""} Cinematic film still, natural, no text.`;
}

/** Where to take the reference frame: the middle of what you see of the shot. */
export function reshootFrameAt(shot: Shot): number {
  if (shot.render?.kind !== "video") return 0;
  return Math.round(((shot.trimIn ?? 0) + clipSeconds(shot) / 2) * 1000) / 1000;
}

/** The open-weights route: Comfy's Qwen-Image-Edit multi-angle workflow, whose CameraAngle node takes the move as numbers. */
export const OPEN_RESHOOT = { template: "template_qwen_multiangle.app", node: "221", image: "1/image" } as const;

const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The dial as the CameraAngle node's three controls: 0–360 around the subject (0 front, 90 right, 180 back), −30…60 elevation, zoom 0 wide … 10 close. */
export function toCameraAngle(c: Camera): { horizontal_angle: number; vertical_angle: number; zoom: number } {
  return {
    horizontal_angle: ((Math.round(c.az) % 360) + 360) % 360,
    vertical_angle: clampN(Math.round(c.el), -30, 60),
    zoom: clampN(Math.round((5 - 5 * c.zoom) * 10) / 10, 0, 10),
  };
}
