import assert from "node:assert/strict";
import { test } from "node:test";

import { alephWorkflow, editEstimate, flux3Workflow, speechWorkflow, klingEditWorkflow, genjutsuWorkflow, kontextWorkflow, regenerateWorkflow, VOICES, voiceWorkflow } from "./cloud-edits";

test("fix a frame: FLUX Kontext edits the uploaded frame and saves a picture", () => {
  const w = kontextWorkflow({ image: "frame.png", prompt: "Remove the extra hand on the truck", ratio: "16:9", seed: 3 });
  assert.deepEqual(w["2"], { class_type: "LoadImage", inputs: { image: "frame.png" } });
  assert.equal(w["1"]!.class_type, "FluxKontextProImageNode");
  assert.deepEqual(w["1"]!.inputs.input_image, ["2", 0]);
  assert.equal(w["1"]!.inputs.prompt, "Remove the extra hand on the truck");
  assert.deepEqual(w["20"], { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "haggs/kontext" } });
});

test("regenerate keeps the take's motion and re-renders it with the change, a fixed frame and references", () => {
  const w = regenerateWorkflow({ video: "take.mp4", prompt: "Same shot, his jacket is brown", firstFrame: "fixed.png", references: ["ellis.png"] });
  assert.deepEqual(w["2"], { class_type: "LoadVideo", inputs: { file: "take.mp4" } });
  assert.equal(w["1"]!.class_type, "MinimaxHailuo03RegenerateNode");
  assert.deepEqual(
    { model: w["1"]!.inputs.model, res: w["1"]!.inputs["model.resolution"], video: w["1"]!.inputs.video, first: w["1"]!.inputs.first_frame, ref: w["1"]!.inputs["model.reference_images.image_1"] },
    { model: "MiniMax H3", res: "2K", video: ["2", 0], first: ["3", 0], ref: ["4", 0] },
  );
  assert.deepEqual(w["3"], { class_type: "LoadImage", inputs: { image: "fixed.png" } });
  assert.deepEqual(w["20"]!.inputs.video, ["1", 0]);
});

test("swap with Aleph 2: the change as a prompt, references chained as prompt images", () => {
  const w = alephWorkflow({ video: "take.mp4", prompt: "Replace the blue pickup with a red one", references: ["red.png", "logo.png"], seed: 9 });
  assert.equal(w["1"]!.class_type, "RunwayAleph2VideoToVideoNode");
  assert.deepEqual(w["1"]!.inputs.video, ["2", 0]);
  assert.equal(w["1"]!.inputs.public_figure_threshold, "auto");
  const [first, second] = [w["10"]!, w["11"]!];
  assert.equal(first.class_type, "RunwayAleph2PromptImageNode");
  assert.equal(first.inputs.position, "Fraction of duration (0.0-1.0)");
  assert.deepEqual(second.inputs.prompt_images, ["10", 0], "each picture chains to the one before");
  assert.deepEqual(w["1"]!.inputs.prompt_images, ["11", 0]);
  assert.throws(() => alephWorkflow({ video: "t.mp4", prompt: "x x x x", references: Array(6).fill("a.png"), seed: 1 }), /five/);
});

test("recast with Genjutsu keeps the motion and recasts from references", () => {
  const w = genjutsuWorkflow({ video: "take.mp4", references: ["rowan.png", "dock.png"], prompt: "Rowan at the dock", resolution: "720p", seed: 4 });
  assert.equal(w["1"]!.class_type, "HiggsfieldMotionTransferNode");
  assert.deepEqual(
    [w["1"]!.inputs.model, w["1"]!.inputs["model.video"], w["1"]!.inputs["model.reference_images.image_2"], w["1"]!.inputs["model.resolution"]],
    ["genjutsu-v1.0", ["2", 0], ["4", 0], "720p"],
  );
  assert.throws(() => genjutsuWorkflow({ video: "t.mp4", references: [], prompt: "", resolution: "720p", seed: 1 }), /reference/);
});

test("voices: one ElevenLabs voice per speaker, the dialogue in order, lip-synced onto the take", () => {
  const w = voiceWorkflow({
    video: "take.mp4",
    lines: [
      { text: "It was like that.", voice: "George (male, british)" },
      { text: "No it wasn't.", voice: "Lily (female, british)" },
      { text: "It really was.", voice: "George (male, british)" },
    ],
  });
  const selectors = Object.values(w).filter((n) => n.class_type === "ElevenLabsVoiceSelector");
  assert.equal(selectors.length, 2, "one selector per distinct voice");
  const dialogue = Object.values(w).find((n) => n.class_type === "ElevenLabsTextToDialogue")!;
  assert.equal(dialogue.inputs.inputs, "3");
  assert.equal(dialogue.inputs["inputs.text2"], "No it wasn't.");
  assert.deepEqual(dialogue.inputs["inputs.voice1"], dialogue.inputs["inputs.voice3"], "the same speaker keeps the same voice");
  const sync = Object.values(w).find((n) => n.class_type === "SyncLipSyncNode")!;
  assert.deepEqual(sync.inputs.video, ["2", 0]);
  assert.equal(sync.inputs.model, "sync-3");
  assert.deepEqual(w["20"]!.inputs.video, ["31", 0]);
  assert.throws(() => voiceWorkflow({ video: "t.mp4", lines: [{ text: "hi", voice: "Nobody" }] }), /voice/);
  assert.ok(VOICES.includes("Roger (male, american)"));
});

test("every tool is quoted from Comfy's published node prices", () => {
  assert.equal(editEstimate({ tool: "regenerate", seconds: 5 }), 0.358);
  assert.equal(editEstimate({ tool: "aleph", seconds: 5 }), 2.002);
  assert.equal(editEstimate({ tool: "genjutsu", seconds: 5, resolution: "720p" }), 4.869);
  assert.equal(editEstimate({ tool: "genjutsu", seconds: 5, resolution: "480p" }), 2.274);
  assert.equal(editEstimate({ tool: "voice", seconds: 5, characters: 1000 }), Math.round((0.1144 + 0.19019 * 5) * 1000) / 1000);
  assert.equal(editEstimate({ tool: "kontext", seconds: 0 }), 0.04);
});

test("edit with Kling Omni: the instruction, the take, and references batched into one input", () => {
  const w = klingEditWorkflow({ video: "take.mp4", prompt: "His jacket is olive green; nothing else changes", references: ["fixed.png", "ellis.png"], resolution: "720p", seed: 2 });
  assert.equal(w["1"]!.class_type, "KlingOmniProEditVideoNode");
  assert.deepEqual(
    [w["1"]!.inputs.model_name, w["1"]!.inputs.video, w["1"]!.inputs.resolution, w["1"]!.inputs.keep_original_sound],
    ["kling-v3-omni", ["2", 0], "720p", true],
  );
  assert.equal(w["50"]!.class_type, "ImageBatch", "two pictures are batched into the single reference input");
  assert.deepEqual(w["1"]!.inputs.reference_images, ["50", 0]);
  const one = klingEditWorkflow({ video: "t.mp4", prompt: "make it rain hard", references: ["a.png"], resolution: "720p", seed: 1 });
  assert.deepEqual(one["1"]!.inputs.reference_images, ["3", 0], "one picture goes straight in");
  const none = klingEditWorkflow({ video: "t.mp4", prompt: "make it rain hard", references: [], resolution: "720p", seed: 1 });
  assert.equal("reference_images" in none["1"]!.inputs, false);
  assert.throws(() => klingEditWorkflow({ video: "t.mp4", prompt: "x x x x", references: Array(5).fill("a.png"), resolution: "720p", seed: 1 }), /four/);
  assert.equal(editEstimate({ tool: "kling", seconds: 5 }), 0.63);
  assert.equal(editEstimate({ tool: "kling", seconds: 5, resolution: "1080p" }), 0.84);
});

test("flux3Workflow loads each reference into the images autogrow and saves a still", () => {
  const w = flux3Workflow({ prompt: "Rowan laughing at the river", references: ["a.png", "b.png"], ratio: "16:9", resolution: "1.5K", seed: 7 });
  assert.equal(w["1"]!.class_type, "Flux3ImageNode");
  assert.deepEqual(w["1"]!.inputs["images.image_1"], ["3", 0]);
  assert.deepEqual(w["1"]!.inputs["images.image_2"], ["4", 0]);
  assert.equal(w["3"]!.inputs.image, "a.png");
  assert.equal(w["1"]!.inputs.resolution, "1.5K");
  assert.equal(w["1"]!.inputs.grounding, false);
  assert.equal(w["20"]!.class_type, "SaveImage");
  assert.throws(() => flux3Workflow({ prompt: "x x x x", references: Array(11).fill("a.png"), seed: 1 }), /ten/);
});

test("editEstimate prices a FLUX 3 still by resolution", () => {
  assert.equal(editEstimate({ tool: "flux3", seconds: 0, resolution: "1.5K" }), 0.1001);
  assert.equal(editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }), 0.0686);
});

test("speechWorkflow speaks one line in a chosen voice and saves an MP3, no video involved", () => {
  const w = speechWorkflow({ text: "Tell me what I missed.", voice: "Chris (male, american)", seed: 4 });
  assert.equal(w["40"]!.class_type, "ElevenLabsVoiceSelector");
  assert.equal(w["1"]!.class_type, "ElevenLabsTextToSpeech");
  assert.deepEqual(w["1"]!.inputs.voice, ["40", 0]);
  assert.equal(w["1"]!.inputs.text, "Tell me what I missed.");
  assert.equal(w["1"]!.inputs.model, "eleven_v4");
  assert.equal(w["20"]!.class_type, "SaveAudioMP3");
  assert.deepEqual(w["20"]!.inputs.audio, ["1", 0]);
  assert.throws(() => speechWorkflow({ text: "Hi there", voice: "Nobody", seed: 1 }), /voice/);
  assert.throws(() => speechWorkflow({ text: "", voice: "Chris (male, american)", seed: 1 }), /line/);
});

test("a spoken line is priced by its characters", () => {
  assert.equal(editEstimate({ tool: "speech", seconds: 0, characters: 1000 }), 0.114);
});

test("a voice can be asked to be more expressive: v3 with a lower stability", () => {
  const w = speechWorkflow({ text: "[softly] Hello.", voice: "Matilda (female, american)", model: "eleven_v3", stability: 0, seed: 1 });
  const tts = Object.values(w).find((n) => n.class_type === "ElevenLabsTextToSpeech")!;
  assert.equal(tts.inputs.model, "eleven_v3");
  assert.equal(tts.inputs.stability, 0);
  assert.equal(tts.inputs["model.speed"], 1, "v3 requires a speed");
  const v = voiceWorkflow({ video: "a.mp4", lines: [{ text: "[softly] Hi.", voice: "Will (male, american)" }], model: "eleven_v3", stability: 0 });
  assert.equal(v["30"]!.inputs.stability, 0);
  assert.throws(() => speechWorkflow({ text: "x", voice: "Matilda (female, american)", stability: 2, seed: 1 }), /stability/i);
});

import { soundEffectWorkflow } from "./cloud-edits";

test("a sound effect is made from words and a length, and priced by the second", () => {
  const w = soundEffectWorkflow({ text: "A heavy wooden door slams in an empty hall", seconds: 3 });
  const n = Object.values(w).find((x) => x.class_type === "ElevenLabsTextToSoundEffects")!;
  assert.equal(n.inputs.model, "eleven_sfx_v2");
  assert.equal(n.inputs["model.duration"], 3);
  assert.ok(Object.values(w).some((x) => x.class_type === "SaveAudioMP3"));
  assert.throws(() => soundEffectWorkflow({ text: "x", seconds: 3 }), /describe/i);
  assert.throws(() => soundEffectWorkflow({ text: "a door slams", seconds: 40 }), /0\.5.*30/);
  assert.equal(editEstimate({ tool: "sfx", seconds: 30 }), 0.07);
});
