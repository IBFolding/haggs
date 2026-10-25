import type { Workflow } from "./cloud";
import { kontextWorkflow } from "./cloud-edits";

/**
 * The models that run as Comfy Cloud workflows: Kling 3, Seedance 2 and 2.5, Veo 3.1, Nano Banana 2 and FLUX Kontext.
 * Each is one Comfy API node with its settings. The same route made the Waylight takes, it works on every account, and
 * Comfy can price it before it runs. Everything here is pure, so the price on a button can be computed in the browser.
 *
 * Prices are Comfy's own estimates (2026-10-25) at about 211 credits to the dollar: estimates, not invoices.
 */

export type Settings = Record<string, unknown>;
export type CloudInput = { prompt: string; settings: Settings; images: string[] };
export type CloudModel = {
  id: string;
  kind: "image" | "video";
  /** How many pictures it takes: a first frame, or references. */
  maxImages: number;
  /** Edits a picture, so it needs one. */
  needsImage?: boolean;
  /** Dollars for one run at these settings. */
  price(settings: Settings): number;
  build(input: CloudInput): Workflow;
};

export const usdFromCredits = (credits: number) => Math.round((credits / 211) * 1000) / 1000;

const IMAGE_NAME = /^[-\w.]{1,180}\.(png|jpe?g|webp)$/i;
const seed = () => Math.floor(Math.random() * 2_000_000_000);

function whole(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(String(value)) ? (String(value) as T) : fallback;
const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

function check(model: Pick<CloudModel, "maxImages" | "needsImage">, { prompt, images }: CloudInput): string {
  const text = prompt.trim();
  if (text.length < 4 || text.length > 4000) throw new Error("Describe what to make in 4–4000 characters.");
  if (images.length > model.maxImages) throw new Error(model.maxImages === 1 ? "This model takes one picture." : `This model takes up to ${model.maxImages} pictures.`);
  if (model.needsImage && images.length === 0) throw new Error("This model edits a picture. Add one.");
  for (const name of images) if (!IMAGE_NAME.test(name)) throw new Error("A picture didn't upload properly.");
  return text;
}

/** LoadImage nodes numbered from 2, so node 1 is always the model. */
const loads = (images: string[]): Workflow => Object.fromEntries(images.map((image, i) => [String(i + 2), { class_type: "LoadImage", inputs: { image } }]));
const saveVideo = (): Workflow => ({ "20": { class_type: "SaveVideo", inputs: { video: ["1", 0], filename_prefix: "haggs/take", format: "mp4", "format.codec": "h264" } } });
const saveImage = (): Workflow => ({ "20": { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "haggs/still" } } });

/* ── Kling 3 ──────────────────────────────────────────── */
// Credits per second at each setting, from Comfy's estimates for a 5s take.
const KLING: Record<string, { name: string; resolutions: readonly ("720p" | "1080p")[]; fallback: "720p" | "1080p"; perSecond: (res: string, audio: boolean) => number }> = {
  "kling/kling-v3": { name: "kling-v3", resolutions: ["720p", "1080p"], fallback: "1080p", perSecond: (res, audio) => (res === "720p" ? (audio ? 26.6 : 17.8) : audio ? 35.4 : 23.6) },
  "kling/kling-3.0-turbo": { name: "kling-3.0-turbo", resolutions: ["720p", "1080p"], fallback: "720p", perSecond: (res) => (res === "720p" ? 23.6 : 29.6) },
};

function kling(id: string): CloudModel {
  const m = KLING[id]!;
  const turbo = id.endsWith("turbo");
  const read = (s: Settings) => ({ seconds: whole(s.duration, 3, 15, 5), res: pick(s.resolution, m.resolutions, m.fallback), audio: turbo ? true : flag(s.generate_audio, false) });
  const def: CloudModel = {
    id, kind: "video", maxImages: 1,
    price: (s) => { const r = read(s); return usdFromCredits(m.perSecond(r.res, r.audio) * r.seconds); },
    build(input) {
      const text = check(def, input);
      const r = read(input.settings);
      return {
        ...loads(input.images),
        "1": { class_type: "KlingVideoNode", inputs: { multi_shot: "disabled", "multi_shot.prompt": text, "multi_shot.negative_prompt": "", "multi_shot.duration": r.seconds, generate_audio: r.audio, model: m.name, "model.resolution": r.res, "model.aspect_ratio": pick(input.settings.aspect_ratio, ["16:9", "9:16", "1:1"], "16:9"), seed: seed(), ...(input.images.length ? { start_frame: ["2", 0] } : {}) } },
        ...saveVideo(),
      };
    },
  };
  return def;
}

/* ── Seedance 2 and 2.5 ───────────────────────────────── */
const SEEDANCE: Record<string, { name: string; resolutions: readonly ("480p" | "720p" | "1080p")[]; perSecond: Record<string, number>; newest?: boolean }> = {
  "byteplus/seedance-2-5": { name: "Seedance 2.5", resolutions: ["480p", "720p", "1080p"], perSecond: { "480p": 31.2, "720p": 70.4, "1080p": 173 }, newest: true },
  "byteplus/seedance-2-0": { name: "Seedance 2.0", resolutions: ["480p", "720p", "1080p"], perSecond: { "480p": 21.2, "720p": 45.6, "1080p": 113.4 } },
  "byteplus/seedance-2-0-fast": { name: "Seedance 2.0 Fast", resolutions: ["480p", "720p"], perSecond: { "480p": 16.9, "720p": 36.4 } },
  "byteplus/seedance-2-0-mini": { name: "Seedance 2.0 Mini", resolutions: ["480p", "720p"], perSecond: { "480p": 10.6, "720p": 22.8 } },
};
const SEEDANCE_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"] as const;

function seedance(id: string): CloudModel {
  const m = SEEDANCE[id]!;
  const read = (s: Settings) => ({ seconds: whole(s.duration, 4, 15, 5), res: pick(s.resolution, m.resolutions, "720p"), ratio: pick(s.aspect_ratio ?? s.ratio, SEEDANCE_RATIOS, "16:9"), audio: flag(s.generate_audio, true) });
  const def: CloudModel = {
    id, kind: "video", maxImages: 1,
    price: (s) => { const r = read(s); return usdFromCredits(m.perSecond[r.res]! * r.seconds); },
    build(input) {
      const text = check(def, input);
      const r = read(input.settings);
      const body = { model: m.name, "model.prompt": text, "model.resolution": r.res, "model.duration": r.seconds, "model.generate_audio": r.audio, ...(m.newest ? { "model.output_format": "mp4" } : {}), seed: seed(), watermark: false };
      // A first frame sets the shape of a 2.5 take, so only 2.0 takes a ratio on that node; text to video takes it on all.
      return input.images.length
        ? { ...loads(input.images), "1": { class_type: "ByteDance2FirstLastFrameNode", inputs: { ...body, ...(m.newest ? {} : { "model.ratio": r.ratio }), first_frame: ["2", 0] } }, ...saveVideo() }
        : { "1": { class_type: "ByteDance2TextToVideoNode", inputs: { ...body, "model.ratio": r.ratio } }, ...saveVideo() };
    },
  };
  return def;
}

/* ── Veo 3.1 ──────────────────────────────────────────── */
const VEO: Record<string, { name: string; perSecond: (res: string, audio: boolean) => number }> = {
  "google/veo-3-1": { name: "veo-3.1-generate", perSecond: (_res, audio) => (audio ? 84.375 : 42.25) },
  "google/veo-3-1-fast": { name: "veo-3.1-fast-generate", perSecond: (_res, audio) => (audio ? 21.125 : 10.56) },
  "google/veo-3-1-lite": { name: "veo-3.1-lite", perSecond: (res, audio) => (res === "1080p" ? 16.875 : 10.5) * (audio ? 1 : 0.5) },
};

function veo(id: string): CloudModel {
  const m = VEO[id]!;
  const read = (s: Settings) => ({ seconds: whole(s.duration, 4, 8, 8), res: pick(s.resolution, ["720p", "1080p"], "720p"), audio: flag(s.generate_audio, true) });
  const def: CloudModel = {
    id, kind: "video", maxImages: 1,
    price: (s) => { const r = read(s); return usdFromCredits(m.perSecond(r.res, r.audio) * r.seconds); },
    build(input) {
      const text = check(def, input);
      const r = read(input.settings);
      return {
        ...loads(input.images),
        "1": { class_type: "Veo3VideoGenerationNode", inputs: { prompt: text, aspect_ratio: pick(input.settings.aspect_ratio, ["16:9", "9:16"], "16:9"), resolution: r.res, duration_seconds: r.seconds, generate_audio: r.audio, model: m.name, seed: seed(), ...(input.images.length ? { image: ["2", 0] } : {}) } },
        ...saveVideo(),
      };
    },
  };
  return def;
}

/* ── Nano Banana 2 ────────────────────────────────────── */
const BANANA: Record<string, { name: string; resolutions: readonly ("1K" | "2K" | "4K")[]; thinking: readonly string[]; credits: Record<string, number>; defaultThinking: string }> = {
  "google/nano-banana-2": { name: "Nano Banana 2 (Gemini 3.1 Flash Image)", resolutions: ["1K", "2K", "4K"], thinking: ["MINIMAL", "HIGH"], credits: { "1K": 18, "2K": 26, "4K": 39 }, defaultThinking: "MINIMAL" },
  "google/nano-banana-2-1": { name: "Gemini Nano Banana 2.1", resolutions: ["1K", "2K", "4K"], thinking: ["MINIMAL", "MEDIUM", "HIGH"], credits: { "1K": 12, "2K": 17, "4K": 26 }, defaultThinking: "MEDIUM" },
  "google/nano-banana-2-lite": { name: "Nano Banana 2 Lite", resolutions: ["1K"], thinking: ["MINIMAL", "HIGH"], credits: { "1K": 9 }, defaultThinking: "MINIMAL" },
};
const BANANA_RATIOS = ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;

function banana(id: string): CloudModel {
  const m = BANANA[id]!;
  const read = (s: Settings) => ({ res: pick(s.resolution, m.resolutions, "1K"), think: pick(s.thinking, m.thinking as readonly string[], m.defaultThinking) });
  const def: CloudModel = {
    id, kind: "image", maxImages: 14,
    price: (s) => usdFromCredits(m.credits[read(s).res]!),
    build(input) {
      const text = check(def, input);
      const r = read(input.settings);
      const refs = Object.fromEntries(input.images.map((_, i) => [`model.images.image_${i + 1}`, [String(i + 2), 0]]));
      return {
        ...loads(input.images),
        "1": { class_type: "GeminiNanoBanana2V2", inputs: { prompt: text, model: m.name, "model.aspect_ratio": pick(input.settings.aspect_ratio, BANANA_RATIOS, "auto"), "model.resolution": r.res, "model.thinking_level": r.think, ...refs, seed: seed(), response_modalities: "IMAGE" } },
        ...saveImage(),
      };
    },
  };
  return def;
}

/* ── FLUX Kontext ─────────────────────────────────────── */
const kontext: CloudModel = {
  id: "bfl/flux-kontext-pro", kind: "image", maxImages: 1, needsImage: true,
  // Comfy shows no price badge for this node; $0.04 is Black Forest Labs' list price.
  price: () => 0.04,
  build(input) {
    check(kontext, input);
    return kontextWorkflow({ image: input.images[0]!, prompt: input.prompt, ratio: typeof input.settings.aspect_ratio === "string" ? input.settings.aspect_ratio : "16:9", seed: seed() });
  },
};

export const CLOUD_MODELS: Record<string, CloudModel> = Object.fromEntries([
  ...Object.keys(KLING).map((id) => [id, kling(id)] as const),
  ...Object.keys(SEEDANCE).map((id) => [id, seedance(id)] as const),
  ...Object.keys(VEO).map((id) => [id, veo(id)] as const),
  ...Object.keys(BANANA).map((id) => [id, banana(id)] as const),
  [kontext.id, kontext] as const,
]);

export const cloudModel = (id: string): CloudModel | undefined => CLOUD_MODELS[id];

/** Dollars for one run of a cloud model at these settings, or null if the id isn't one. */
export function cloudPrice(id: string, settings: Settings, outputs = 1): number | null {
  const m = CLOUD_MODELS[id];
  return m ? Math.round(m.price(settings) * outputs * 1000) / 1000 : null;
}

export function cloudWorkflow(id: string, input: CloudInput): Workflow {
  const m = CLOUD_MODELS[id];
  if (!m) throw new Error(`${id} isn't a cloud model.`);
  return m.build(input);
}
