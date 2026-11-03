import { NEUTRAL, type Look } from "./grey-scene";

/** The one-click looks, shared by the Grey Room card and by MCP proposals. */
export const LOOKS: { name: string; look: Look }[] = [
  { name: "Neutral", look: NEUTRAL },
  { name: "Warm evening", look: { exposure: -0.1, contrast: 0.15, warmth: 0.6, saturation: 0.1, vignette: 0.3 } },
  { name: "Cold night", look: { exposure: -0.25, contrast: 0.2, warmth: -0.7, saturation: -0.2, vignette: 0.45 } },
  { name: "Faded film", look: { exposure: 0.05, contrast: -0.2, warmth: 0.2, saturation: -0.35, vignette: 0.2 } },
];
export const LOOK_NAMES = LOOKS.map((l) => l.name) as [string, ...string[]];
