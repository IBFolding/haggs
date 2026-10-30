import type { ApiPrompt } from "./convert";

/**
 * Cuts chosen people out of a video with SAM3 on Comfy: describe who stays,
 * and/or click them, and the result is a WebM with a transparent background.
 * The footage goes in at the `LoadVideo` node; the frame rate is the footage's own.
 *
 * A text description is found again in every frame, so it follows an actor
 * who moves. A clicked point is the same pixel in every frame, so it suits an
 * actor who stays roughly in place.
 */

export type Point = { x: number; y: number };

export const MATTE_INPUT = "1/file";

export function actorMattePrompt({ describe, points = [] }: { describe: string; points?: Point[] }): ApiPrompt {
  const words = describe.trim().slice(0, 120) || "person";
  const detect: Record<string, unknown> = {
    model: ["3", 0],
    image: ["2", 0],
    conditioning: ["4", 0],
    threshold: 0.5,
    refine_iterations: 2,
    individual_masks: false,
  };
  if (points.length) detect.positive_coords = JSON.stringify(points.slice(0, 12).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })));
  return {
    "1": { class_type: "LoadVideo", inputs: { file: "footage.mp4" } },
    "2": { class_type: "GetVideoComponents", inputs: { video: ["1", 0] } },
    "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sam3.1_multiplex_fp16.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: words, clip: ["3", 1] } },
    "5": { class_type: "SAM3_Detect", inputs: detect },
    "6": { class_type: "JoinImageWithAlpha", inputs: { image: ["2", 0], alpha: ["5", 0] } },
    "7": { class_type: "SaveWEBM", inputs: { images: ["6", 0], filename_prefix: "haggs/matte", codec: "vp9", fps: ["2", 2], crf: 24 } },
  } as unknown as ApiPrompt;
}

/** A selected surface in a still photo, saved with alpha as PNG. */
export const IMAGE_MATTE_INPUT = "1/image";
export function imageMattePrompt(describe: string): ApiPrompt {
  const video = actorMattePrompt({ describe });
  const { "2": _frames, "7": _videoSave, ...nodes } = video;
  return {
    ...nodes,
    "1": { class_type: "LoadImage", inputs: { image: "room.png" } },
    "5": { ...video["5"]!, inputs: { ...video["5"]!.inputs, image: ["1", 0] } },
    "6": { class_type: "JoinImageWithAlpha", inputs: { image: ["1", 0], alpha: ["5", 0] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "haggs/surface" } },
  };
}
