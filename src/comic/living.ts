import type { Panel } from "./comic";

export type PanelAnimation = { url: string; source: string; prompt: string; model: string };
export const COMIC_VIDEO_MODEL = "minimax/minimax-h3";
export function animationRequest(panel: Panel, picture: string) {
  const seconds = Math.min(15, Math.max(4, Math.round(Number.isFinite(panel.seconds) ? panel.seconds! : 4)));
  const prompt = `${panel.action}. ${panel.motion?.trim() || "Subtle natural movement, steady camera"}. Preserve the illustrated style, characters and composition of the starting panel. No cuts, text, captions or speech bubbles.`;
  return { model: COMIC_VIDEO_MODEL, prompt, images: [picture], settings: { duration: seconds, resolution: "768P", ratio: panel.shape === "square" ? "1:1" : panel.shape === "tall" ? "9:16" : "16:9" } };
}

/** An old clip must never silently play over replacement artwork. */
export function currentAnimation(animation: PanelAnimation | undefined, picture: string | undefined) {
  return picture && animation?.source === picture ? animation : undefined;
}
