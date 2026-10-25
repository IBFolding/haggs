import type { Workflow } from "./cloud";

/**
 * The edit tools as Comfy Cloud workflows, each built from Comfy's own API
 * nodes and checked against Cloud's node catalog (2026-10-20):
 *
 *  - fix a frame  FLUX Kontext Pro edits one still from the take
 *  - regenerate   MiniMax H3 Regenerate re-renders a take at 2K. It refreshes
 *                 footage; tested 2026-10-21, it does not apply changes.
 *  - kling        Kling Omni Pro edit changes what an instruction says and
 *                 keeps the rest — the standard engine for fixes and swaps
 *  - swap         Runway Aleph 2 changes something across a whole take
 *  - recast       Higgsfield Genjutsu keeps the motion, recasts from references
 *  - voice        ElevenLabs dialogue, lip-synced onto the take with Sync 3
 *
 * Every builder takes names already uploaded to Cloud; nothing here runs.
 */

export const VOICES = [
  "Roger (male, american)", "Sarah (female, american)", "Laura (female, american)", "Charlie (male, australian)", "George (male, british)",
  "Callum (male, american)", "River (neutral, american)", "Harry (male, american)", "Liam (male, american)", "Alice (female, british)",
  "Matilda (female, american)", "Will (male, american)", "Jessica (female, american)", "Eric (male, american)", "Bella (female, american)",
  "Chris (male, american)", "Brian (male, american)", "Daniel (male, british)", "Lily (female, british)", "Adam (male, american)", "Bill (male, american)",
] as const;

const say = (prompt: string) => {
  if (prompt.trim().length < 4 || prompt.length > 4000) throw new Error("Say what should change in 4–4000 characters.");
  return prompt.trim();
};
const saveVideo = (from: string) => ({ class_type: "SaveVideo", inputs: { video: [from, 0], filename_prefix: "haggs/edit", format: "mp4", "format.codec": "h264" } });

export function kontextWorkflow({ image, prompt, ratio = "16:9", seed }: { image: string; prompt: string; ratio?: string; seed: number }): Workflow {
  return {
    "2": { class_type: "LoadImage", inputs: { image } },
    "1": { class_type: "FluxKontextProImageNode", inputs: { prompt: say(prompt), aspect_ratio: ratio, guidance: 3, steps: 50, seed, prompt_upsampling: false, input_image: ["2", 0] } },
    "20": { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "haggs/kontext" } },
  };
}

export function regenerateWorkflow({ video, prompt, firstFrame, lastFrame, references = [] }: { video: string; prompt: string; firstFrame?: string; lastFrame?: string; references?: string[] }): Workflow {
  if (references.length > 6) throw new Error("Use up to six reference pictures.");
  const node: Record<string, unknown> = { model: "MiniMax H3", "model.prompt": say(prompt), "model.resolution": "2K", video: ["2", 0], watermark: false };
  const w: Workflow = { "2": { class_type: "LoadVideo", inputs: { file: video } } };
  let next = 3;
  const load = (image: string) => {
    const id = String(next++);
    w[id] = { class_type: "LoadImage", inputs: { image } };
    return [id, 0];
  };
  if (firstFrame) node.first_frame = load(firstFrame);
  if (lastFrame) node.last_frame = load(lastFrame);
  references.forEach((image, i) => (node[`model.reference_images.image_${i + 1}`] = load(image)));
  w["1"] = { class_type: "MinimaxHailuo03RegenerateNode", inputs: node };
  w["20"] = saveVideo("1");
  return w;
}

/** Kling Omni Pro edit: changes what the instruction says and keeps the rest, the take's length and its sound. */
export function klingEditWorkflow({ video, prompt, references = [], resolution, seed }: { video: string; prompt: string; references?: string[]; resolution: "720p" | "1080p"; seed: number }): Workflow {
  if (references.length > 4) throw new Error("Kling takes up to four reference pictures.");
  const w: Workflow = { "2": { class_type: "LoadVideo", inputs: { file: video } } };
  const node: Record<string, unknown> = { model_name: "kling-v3-omni", prompt: say(prompt), video: ["2", 0], keep_original_sound: true, resolution, seed };
  const loaded = references.map((image, i) => {
    const id = String(3 + i);
    w[id] = { class_type: "LoadImage", inputs: { image } };
    return id;
  });
  // Kling's reference input is one image batch; ImageBatch joins pictures, matching later ones to the first one's size.
  let batch = loaded[0];
  loaded.slice(1).forEach((id, i) => {
    const join = String(50 + i);
    w[join] = { class_type: "ImageBatch", inputs: { image1: [batch!, 0], image2: [id, 0] } };
    batch = join;
  });
  if (batch) node.reference_images = [batch, 0];
  w["1"] = { class_type: "KlingOmniProEditVideoNode", inputs: node };
  w["20"] = saveVideo("1");
  return w;
}

export function alephWorkflow({ video, prompt, references = [], seed }: { video: string; prompt: string; references?: string[]; seed: number }): Workflow {
  if (references.length > 5) throw new Error("Aleph takes up to five reference pictures.");
  const w: Workflow = { "2": { class_type: "LoadVideo", inputs: { file: video } } };
  const node: Record<string, unknown> = { prompt: say(prompt), video: ["2", 0], seed, public_figure_threshold: "auto" };
  let last: string | null = null;
  references.forEach((image, i) => {
    const loader = String(30 + i);
    const id = String(10 + i);
    w[loader] = { class_type: "LoadImage", inputs: { image } };
    w[id] = { class_type: "RunwayAleph2PromptImageNode", inputs: { image: [loader, 0], position: "Fraction of duration (0.0-1.0)", "position.fraction": 0, ...(last ? { prompt_images: [last, 0] } : {}) } };
    last = id;
  });
  if (last) node.prompt_images = [last, 0];
  w["1"] = { class_type: "RunwayAleph2VideoToVideoNode", inputs: node };
  w["20"] = saveVideo("1");
  return w;
}

export function genjutsuWorkflow({ video, references, prompt, resolution, seed }: { video: string; references: string[]; prompt: string; resolution: "480p" | "720p" | "1080p"; seed: number }): Workflow {
  if (!references.length || references.length > 8) throw new Error("Recast needs 1–8 reference pictures of the cast, place or style.");
  const w: Workflow = { "2": { class_type: "LoadVideo", inputs: { file: video } } };
  const node: Record<string, unknown> = { model: "genjutsu-v1.0", "model.video": ["2", 0], "model.prompt": prompt.trim(), "model.resolution": resolution, "model.seed": seed };
  references.forEach((image, i) => {
    const id = String(i + 3);
    w[id] = { class_type: "LoadImage", inputs: { image } };
    node[`model.reference_images.image_${i + 1}`] = [id, 0];
  });
  w["1"] = { class_type: "HiggsfieldMotionTransferNode", inputs: node };
  w["20"] = saveVideo("1");
  return w;
}

/** FLUX 3 Image: a new still that holds faces and places from up to ten reference pictures. */
export function flux3Workflow({ prompt, references = [], ratio = "16:9", resolution = "1.5K", seed }: { prompt: string; references?: string[]; ratio?: string; resolution?: "0.75K" | "1K" | "1.5K" | "2K"; seed: number }): Workflow {
  if (references.length > 10) throw new Error("FLUX 3 takes up to ten reference pictures.");
  const node: Record<string, unknown> = { prompt: say(prompt), aspect_ratio: ratio, resolution, grounding: false, safety_tolerance: 2, seed };
  const w: Workflow = {};
  references.forEach((image, i) => {
    const id = String(3 + i);
    w[id] = { class_type: "LoadImage", inputs: { image } };
    node[`images.image_${i + 1}`] = [id, 0];
  });
  w["1"] = { class_type: "Flux3ImageNode", inputs: node };
  w["20"] = { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "haggs/still" } };
  return w;
}

/** One line of voice-over: ElevenLabs speech in a chosen voice, saved as an MP3 to lay under the cut. */
export function speechWorkflow({ text, voice, model = "eleven_v4", stability = 0.5, seed }: { text: string; voice: string; model?: "eleven_v3" | "eleven_v4" | "eleven_v4_turbo"; stability?: number; seed: number }): Workflow {
  if (!(stability >= 0 && stability <= 1)) throw new Error("Stability is between 0 (most expressive) and 1.");
  if (!text.trim() || text.length > 2000) throw new Error("Write the line to speak, up to 2,000 characters.");
  if (!(VOICES as readonly string[]).includes(voice)) throw new Error("Pick a voice from the list.");
  return {
    "40": { class_type: "ElevenLabsVoiceSelector", inputs: { voice } },
    "1": { class_type: "ElevenLabsTextToSpeech", inputs: { voice: ["40", 0], text: text.trim(), stability, apply_text_normalization: "auto", model, ...(model === "eleven_v3" ? { "model.speed": 1 } : {}), "model.similarity_boost": 0.75, language_code: "", seed, output_format: "mp3_44100_192" } },
    "20": { class_type: "SaveAudioMP3", inputs: { audio: ["1", 0], filename_prefix: "haggs/line", quality: "V0" } },
  };
}

/** A sound effect from words: ElevenLabs Sound Effects on Comfy, 0.5 to 30 seconds. */
export function soundEffectWorkflow({ text, seconds }: { text: string; seconds: number }): Workflow {
  if (text.trim().length < 4 || text.length > 500) throw new Error("Describe the sound in 4–500 characters.");
  if (!(seconds >= 0.5 && seconds <= 30)) throw new Error("A sound effect runs 0.5 to 30 seconds.");
  return {
    "1": { class_type: "ElevenLabsTextToSoundEffects", inputs: { text: text.trim(), model: "eleven_sfx_v2", "model.duration": seconds, "model.loop": false, "model.prompt_influence": 0.4, output_format: "mp3_44100_192" } },
    "20": { class_type: "SaveAudioMP3", inputs: { audio: ["1", 0], filename_prefix: "haggs/sfx", quality: "V0" } },
  };
}

/** Music from words: Sonilo on Comfy, 5 to 180 seconds. It makes whatever the words describe; it is not tied to a picture. */
export function musicWorkflow({ text, seconds }: { text: string; seconds: number }): Workflow {
  if (text.trim().length < 4 || text.length > 500) throw new Error("Describe the music in 4–500 characters.");
  if (!(seconds >= 5 && seconds <= 180)) throw new Error("Music runs 5 to 180 seconds.");
  return {
    "1": { class_type: "SoniloTextToMusic", inputs: { prompt: text.trim(), duration: Math.round(seconds), seed: Math.floor(Math.random() * 2_000_000_000) } },
    "20": { class_type: "SaveAudioMP3", inputs: { audio: ["1", 0], filename_prefix: "haggs/music", quality: "V0" } },
  };
}

/** A video model watches a video and answers in words: Gemini on Comfy. The answer shows on node 20. */
export function watchVideoWorkflow({ video, prompt, model = "gemini-2.5-flash" }: { video: string; prompt: string; model?: "gemini-2.5-flash" | "gemini-2.5-pro" | "gemini-3-1-pro" }): Workflow {
  if (prompt.trim().length < 10) throw new Error("Say what to look for.");
  return {
    "2": { class_type: "LoadVideo", inputs: { file: video } },
    "1": { class_type: "GeminiNode", inputs: { prompt: prompt.trim(), model, seed: 7, video: ["2", 0] } },
    "20": { class_type: "PreviewAny", inputs: { source: ["1", 0] } },
  };
}

export type Line = { text: string; voice: string };

export function voiceWorkflow({ video, lines, model = "eleven_v4", stability = 0.5 }: { video: string; lines: Line[]; model?: "eleven_v3" | "eleven_v4" | "eleven_v4_turbo"; stability?: number }): Workflow {
  if (!lines.length || lines.length > 10) throw new Error("Give the scene 1–10 lines of dialogue.");
  const w: Workflow = { "2": { class_type: "LoadVideo", inputs: { file: video } } };
  const selector = new Map<string, string>();
  lines.forEach((line) => {
    if (!(VOICES as readonly string[]).includes(line.voice)) throw new Error(`Pick a voice from the list for "${line.text.slice(0, 30)}".`);
    if (!selector.has(line.voice)) {
      const id = String(40 + selector.size);
      selector.set(line.voice, id);
      w[id] = { class_type: "ElevenLabsVoiceSelector", inputs: { voice: line.voice } };
    }
  });
  const dialogue: Record<string, unknown> = { stability, apply_text_normalization: "auto", model, inputs: String(lines.length), language_code: "", seed: 1, output_format: "mp3_44100_192" };
  lines.forEach((line, i) => {
    dialogue[`inputs.text${i + 1}`] = line.text.trim();
    dialogue[`inputs.voice${i + 1}`] = [selector.get(line.voice)!, 0];
  });
  w["30"] = { class_type: "ElevenLabsTextToDialogue", inputs: dialogue };
  w["31"] = {
    class_type: "SyncLipSyncNode",
    inputs: { video: ["2", 0], audio: ["30", 0], seed: 42, model: "sync-3", "model.sync_mode": "bounce", "model.speaker_selection": "auto-detect", "model.speaker_frame": 0, "model.speaker_x": 0, "model.speaker_y": 0 },
  };
  w["20"] = saveVideo("31");
  return w;
}

export type Tool = "flux3" | "sfx" | "music" | "speech" | "kontext" | "regenerate" | "kling" | "aleph" | "genjutsu" | "voice";

/**
 * Comfy's node price badges (2026-10-20): Regenerate $0.0715/s, Aleph 2
 * $0.4004/s, Genjutsu $0.45474/s at 480p and $0.97383/s at 720p, ElevenLabs
 * v4 $0.1144 per 1K characters, Sync 3 $0.19019/s. Kontext Pro carries no
 * badge in Comfy; $0.04 is BFL's list price. Kling Omni Pro edit is $0.126/s
 * at 720p and $0.168/s at 1080p. A FLUX 3 still is $0.0586 at 0.75K, $0.0686
 * at 1K, $0.1001 at 1.5K and $0.143 at 2K. Estimates, not invoices.
 */
export function editEstimate({ tool, seconds, resolution = "720p", characters = 0 }: { tool: Tool; seconds: number; resolution?: string; characters?: number }): number {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  switch (tool) {
    case "flux3":
      return ({ "0.75K": 0.0586, "1K": 0.0686, "1.5K": 0.1001, "2K": 0.143 } as Record<string, number>)[resolution] ?? 0.1001;
    case "sfx":
      return r((0.14 * seconds) / 60);
    case "music":
      // Comfy's estimate for Sonilo: 5 credits for 10s, 16 for 30s, 63 for 120s; a credit is about 0.47 cents.
      return r(0.0025 * seconds);
    case "speech":
      return r((0.1144 * characters) / 1000);
    case "kontext":
      return 0.04;
    case "regenerate":
      return r(0.0715 * seconds);
    case "kling":
      return r((resolution === "1080p" ? 0.168 : 0.126) * seconds);
    case "aleph":
      return r(0.4004 * seconds);
    case "genjutsu":
      return r(({ "480p": 0.45474, "720p": 0.97383, "1080p": 2.33376 } as Record<string, number>)[resolution]! * seconds);
    case "voice":
      return r((0.1144 * characters) / 1000 + 0.19019 * seconds);
  }
}
