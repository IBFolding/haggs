import type { ApiPrompt } from "./convert";

/**
 * Build your own workflow, as a chain of steps instead of a node graph:
 * each step adds real Comfy nodes and takes the picture or video the steps
 * before it made. The result is an ordinary Comfy workflow, so it opens as an
 * app, shows its nodes, prices itself and runs like any other.
 */

export type StepKind = "picture-in" | "video-in" | "make-picture" | "edit-picture" | "animate" | "recast" | "speak";
export type Step = { kind: StepKind; prompt?: string; seconds?: number; resolution?: string; voice?: string };
export type Recipe = { name: string; steps: Step[] };

type Kind = "image" | "video";
export type StepInfo = { kind: StepKind; label: string; blurb: string; needs: Kind[]; makes: Kind; asks: ("prompt" | "seconds" | "resolution" | "voice")[]; model?: string };

export const STEPS: StepInfo[] = [
  { kind: "picture-in", label: "A picture you add", blurb: "A product, a face, a frame: whoever runs the app drops it in.", needs: [], makes: "image", asks: [] },
  { kind: "video-in", label: "A video you add", blurb: "The clip to change. Whoever runs the app drops it in.", needs: [], makes: "video", asks: [] },
  { kind: "make-picture", label: "Make a picture", blurb: "From words, using the picture before it as a reference if there is one.", needs: [], makes: "image", asks: ["prompt"], model: "FLUX 3" },
  { kind: "edit-picture", label: "Edit the picture", blurb: "Change what you say and keep the rest.", needs: ["image"], makes: "image", asks: ["prompt"], model: "FLUX Kontext" },
  { kind: "animate", label: "Animate it", blurb: "The picture becomes the first frame of a clip, with sound.", needs: ["image"], makes: "video", asks: ["prompt", "seconds", "resolution"], model: "MiniMax H3" },
  { kind: "recast", label: "Recast the video", blurb: "Keep its motion, camera and sound; put the picture's person in it.", needs: ["video", "image"], makes: "video", asks: ["prompt", "resolution"], model: "Higgsfield Genjutsu" },
  { kind: "speak", label: "Speak a line onto it", blurb: "A voice says your words and the lips move with them.", needs: ["video"], makes: "video", asks: ["prompt", "voice"], model: "ElevenLabs + Sync" },
];

const info = (k: StepKind) => STEPS.find((s) => s.kind === k)!;

/** What the steps so far have made, newest last. */
function made(steps: Step[]): Set<Kind> {
  return new Set(steps.map((s) => info(s.kind).makes));
}

/** The steps that can come next: their needs are met by what's been made. */
export function nextSteps(steps: Step[]): StepInfo[] {
  const have = made(steps);
  return STEPS.filter((s) => s.needs.every((n) => have.has(n)));
}

const words = (s: Step, fallback: string) => (s.prompt?.trim() || fallback).slice(0, 4000);

export type Ref = [string, number];
export type Inputs = { image?: Ref; video?: Ref };

/** Adds one step's nodes to the workflow and returns what it makes. Inputs come from wherever the caller wired them. */
export function addStep(w: ApiPrompt, id: () => string, step: Step, inp: Inputs, seed: number): Inputs {
  switch (step.kind) {
    case "picture-in": {
      const k = id();
      w[k] = { class_type: "LoadImage", inputs: { image: "your-picture.png" }, _meta: { title: "Your picture" } };
      return { image: [k, 0] };
    }
    case "video-in": {
      const k = id();
      w[k] = { class_type: "LoadVideo", inputs: { file: "your-video.mp4" }, _meta: { title: "Your video" } };
      return { video: [k, 0] };
    }
    case "make-picture": {
      const k = id();
      w[k] = { class_type: "Flux3ImageNode", inputs: { prompt: words(step, "A cinematic film still"), aspect_ratio: "16:9", resolution: "1K", grounding: false, safety_tolerance: 2, seed, ...(inp.image ? { "images.image_1": inp.image } : {}) }, _meta: { title: "Make a picture" } };
      return { image: [k, 0] };
    }
    case "edit-picture": {
      const k = id();
      w[k] = { class_type: "FluxKontextProImageNode", inputs: { prompt: words(step, "Keep everything the same"), aspect_ratio: "16:9", guidance: 3, steps: 50, seed, prompt_upsampling: false, input_image: inp.image! }, _meta: { title: "Edit the picture" } };
      return { image: [k, 0] };
    }
    case "animate": {
      const k = id();
      const seconds = Math.min(15, Math.max(4, Math.round(step.seconds ?? 5)));
      w[k] = { class_type: "MinimaxHailuo03FirstLastFrameNode", inputs: { model: "MiniMax H3", "model.prompt": words(step, "Slow push-in, natural motion"), "model.resolution": step.resolution === "2K" ? "2K" : "768P", "model.duration": seconds, seed, watermark: false, first_frame: inp.image! }, _meta: { title: "Animate it" } };
      return { video: [k, 0] };
    }
    case "recast": {
      const k = id();
      w[k] = { class_type: "HiggsfieldMotionTransferNode", inputs: { model: "genjutsu-v1.0", "model.video": inp.video!, "model.reference_images.image_1": inp.image!, "model.prompt": words(step, "Replace the main person with the person in the first reference image. Keep the motion, camera, timing and audio."), "model.resolution": ["480p", "720p", "1080p"].includes(step.resolution ?? "") ? step.resolution! : "480p", "model.seed": seed }, _meta: { title: "Recast the video" } };
      return { video: [k, 0] };
    }
    case "speak": {
      const voice = id();
      w[voice] = { class_type: "ElevenLabsVoiceSelector", inputs: { voice: step.voice || "Sarah (female, american)" } };
      const tts = id();
      w[tts] = { class_type: "ElevenLabsTextToSpeech", inputs: { voice: [voice, 0], text: words(step, "Hello."), stability: 0.5, apply_text_normalization: "auto", model: "eleven_v4", "model.similarity_boost": 0.75, language_code: "", seed, output_format: "mp3_44100_192" }, _meta: { title: "The line" } };
      const sync = id();
      w[sync] = { class_type: "SyncLipSyncNode", inputs: { video: inp.video!, audio: [tts, 0], seed: 42, model: "sync-3", "model.sync_mode": "bounce", "model.speaker_selection": "auto-detect", "model.speaker_frame": 0, "model.speaker_x": 0, "model.speaker_y": 0 }, _meta: { title: "Lip-sync" } };
      return { video: [sync, 0] };
    }
  }
}

/** The Save node for whatever ends the workflow. */
export function addSave(w: ApiPrompt, id: () => string, out: Inputs, ends: Kind): void {
  const save = id();
  w[save] = ends === "video"
    ? { class_type: "SaveVideo", inputs: { video: out.video!, filename_prefix: "haggs/app", format: "mp4", "format.codec": "h264" }, _meta: { title: "Result" } }
    : { class_type: "SaveImage", inputs: { images: out.image!, filename_prefix: "haggs/app" }, _meta: { title: "Result" } };
}

export function compile(recipe: Recipe): ApiPrompt {
  if (!recipe.steps.length) throw new Error("Add a step first.");
  const w: ApiPrompt = {};
  let n = 0;
  const id = () => String(++n);
  const last: Inputs = {};
  recipe.steps.forEach((step, i) => {
    const s = info(step.kind);
    for (const need of s.needs) if (!last[need]) throw new Error(`Step ${i + 1}, “${s.label}”, needs a ${need === "image" ? "picture" : "video"} before it.`);
    Object.assign(last, addStep(w, id, step, last, 1000 + i));
  });
  addSave(w, id, last, info(recipe.steps.at(-1)!.kind).makes);
  return w;
}
