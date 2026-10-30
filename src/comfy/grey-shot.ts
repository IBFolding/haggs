import type { ApiPrompt } from "./convert";
import graph from "./grey-shot.workflow.json";

/**
 * The grey blockout turned into the finished shot, on open weights (LTX 2.3 with its IC-LoRA union control):
 * a styled first frame sets the look, and a grey control video sets the camera and where everyone stands.
 * Comfy works out the depth of the control video itself. This is the graph Comfy Cloud ran for the
 * "LTX 2.3 IC-LoRA Union Control" template, with its inputs gathered in one place.
 */

/** The node that saves the finished video. */
export const GREY_SHOT_OUTPUT = "68";
/** The control video can be at most this long: the graph trims anything longer. */
export const GREY_SHOT_SECONDS = 5;
export const GREY_SHOT_FPS = 25;

export function greyShotWorkflow({ prompt, image, video, seed = 0, vertical = false }: { prompt: string; image: string; video: string; seed?: number; vertical?: boolean }): ApiPrompt {
  const g = JSON.parse(JSON.stringify(graph)) as Record<string, { inputs: Record<string, unknown> }>;
  g["200"]!.inputs.image = image;
  g["199"]!.inputs.file = video;
  // With prompt enhance off the switch reads this text; the enhancer's own prompt box is never used.
  g["129:211"]!.inputs.on_false = prompt.trim().slice(0, 1500);
  g["129:704"]!.inputs.seed = Math.max(0, Math.floor(seed));
  g["129:113"]!.inputs.value = vertical ? 704 : 1280;
  g["129:98"]!.inputs.value = vertical ? 1280 : 704;
  return g as unknown as ApiPrompt;
}

/** What a shot costs in partner credits: nothing, it runs on open weights. The GPU time is billed to the account by Comfy; this is only an estimate of it, for the price on the button. */
export const GREY_SHOT_USD = 0.2;
