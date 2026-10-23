"use server";

import { hosted, isBlobUrl, putBlob } from "../server/blob";
import { inlineLocal, localUrl } from "../server/local-media";
import { cloudEstimate, createCloudProvider, createCloudRunner, type Kept } from "../providers/cloud";
import { alephWorkflow, editEstimate, genjutsuWorkflow, soundEffectWorkflow, klingEditWorkflow, kontextWorkflow, regenerateWorkflow, speechWorkflow, VOICES, voiceWorkflow, type Line } from "../providers/cloud-edits";
import { formatById } from "../sheets/formats";
import { askClaude, draftRequest, type ClaudeResult, type DraftRequest } from "../writer/draft";
import { FILL_SCHEMA, type Fill } from "../writer/fill";
import { cookies } from "next/headers";

import { fetchPricing, formatRate } from "../catalog/pricing";
import { MODELS, getModelCard, outputCount } from "../catalog/models";
import { toWireSettings } from "../catalog/settings";
import { createComfyProvider } from "../providers/comfy";
import { createFalProvider } from "../providers/fal";
import type { Provider } from "../providers/types";

import { CLAUDE_COOKIE, COMFY_COOKIE, KEY_COOKIE, LOCAL_COOKIE, keyIn, localIn } from "../server/keys";
import { localBase } from "../providers/local";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/**
 * The key is set from the UI and never leaves the server after that — the
 * browser posts it once and reads back only whether one is held. Generation
 * happens in the server action, so the key is never in client JS.
 */
export async function saveKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Enter a key");
  const jar = await cookies();
  jar.set(KEY_COOKIE, trimmed, COOKIE_OPTIONS);
}

/** Comfy Router is the platform this app is built on; fal stays as a second route. */
export async function saveComfyKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Enter a key");
  const jar = await cookies();
  jar.set(COMFY_COOKIE, trimmed, COOKIE_OPTIONS);
}

export async function clearComfyKey(): Promise<void> {
  const jar = await cookies();
  jar.set(COMFY_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function saveClaudeKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) return;
  const jar = await cookies();
  jar.set(CLAUDE_COOKIE, trimmed, COOKIE_OPTIONS);
}

export async function clearClaudeKey(): Promise<void> {
  const jar = await cookies();
  jar.set(CLAUDE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export type LocalComfy = { ok: true; base: string; gpu: string } | { ok: false; reason: string };

/** Checks that a ComfyUI answers at this address, and keeps the address if it does. */
export async function saveLocalComfy(address: string): Promise<LocalComfy> {
  let base: string;
  try {
    base = localBase(address);
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That address won't work." };
  }
  try {
    const stats = (await (await fetch(`${base}/system_stats`, { redirect: "error", signal: AbortSignal.timeout(5000) })).json()) as { devices?: { name?: string }[] };
    const gpu = stats.devices?.find((d) => d.name)?.name?.replace(/^cuda:\d+\s*/, "") ?? "your GPU";
    (await cookies()).set(LOCAL_COOKIE, base, COOKIE_OPTIONS);
    return { ok: true, base, gpu };
  } catch {
    return { ok: false, reason: `Nothing answered at ${base}. Start ComfyUI (add --listen if it's on another computer) and try again.` };
  }
}

export async function clearLocalComfy(): Promise<void> {
  (await cookies()).set(LOCAL_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function localComfy(): Promise<string | null> {
  const address = localIn(await cookies());
  try {
    return address ? localBase(address) : null;
  } catch {
    return null;
  }
}

export async function keysHeld(): Promise<{ comfy: boolean; fal: boolean; claude: boolean }> {
  const jar = await cookies();
  return {
    comfy: Boolean(keyIn(jar, COMFY_COOKIE)),
    fal: Boolean(keyIn(jar, KEY_COOKIE)),
    claude: Boolean(keyIn(jar, CLAUDE_COOKIE)),
  };
}

export async function clearKey(): Promise<void> {
  const jar = await cookies();
  jar.set(KEY_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function hasKey(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(keyIn(jar, KEY_COOKIE));
}

async function readKey(): Promise<string> {
  const jar = await cookies();
  const key = keyIn(jar, KEY_COOKIE);
  if (!key) throw new Error("NO_KEY");
  return key;
}

export type Rate = { id: string; label: string; usd: number | null; unit: string | null };

/**
 * Live rate for every model in the picker. Needs no key, because fal publishes
 * prices openly — which is why the picker can show them before you sign up.
 */
export async function rates(): Promise<Rate[]> {
  return Promise.all(
    MODELS.map(async (model) => {
      /* Router prices per request through its estimate route rather than on a
         public page, and that call needs the workspace key — so these rows read
         "quoted at run" until a key is held, instead of showing a number
         scraped from somewhere that does not describe this model. */
      if (useCloud(model.id)) {
        // Comfy's published MiniMax H3 rate, for the model's default length.
        const seconds = Number(model.settings.duration && "default" in model.settings.duration ? model.settings.duration.default : 6);
        const usd = cloudEstimate({ seconds, resolution: "768P", references: 0 });
        return { id: model.id, label: `about $${usd.toFixed(2)} for ${seconds}s`, usd, unit: null };
      }
      if (model.provider === "comfy") {
        return { id: model.id, label: "quoted at run", usd: null, unit: null };
      }
      const pricing = await fetchPricing(model.id);
      return {
        id: model.id,
        label: formatRate(pricing),
        usd: pricing.usdPerUnit,
        unit: pricing.unit,
      };
    }),
  );
}

/**
 * Models that run as Comfy Cloud workflows. Comfy Router is the cleaner route
 * but isn't switched on for every account yet; COMFY_ROUTE=router uses it.
 */
const CLOUD_MODELS = new Set(["minimax/minimax-h3"]);
function useCloud(modelId: string): boolean {
  return CLOUD_MODELS.has(modelId) && process.env.COMFY_ROUTE !== "router";
}

/** Keeps a finished render in the local media folder, since provider links expire. */
async function keepRender(bytes: Uint8Array, extension: Kept): Promise<string> {
  if (hosted()) return putBlob(bytes, extension);
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root || process.env.NODE_ENV === "production") throw new Error("Set HAGGS_LOCAL_MEDIA so finished videos have somewhere to be kept.");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  await mkdir(join(root, "haggs-renders"), { recursive: true });
  await writeFile(join(root, "haggs-renders", name), bytes);
  return localUrl("haggs-renders", name);
}

export type Shot = { url: string; kind: "image" | "video" };

export type RunResult =
  | { ok: true; shots: Shot[]; usd: number | null }
  | { ok: false; reason: string; needsKey?: boolean };

export async function run(
  modelId: string,
  prompt: string,
  settings: Record<string, unknown>,
  images?: string[],
  /** False when the images are references only, not the opening frame. */
  firstFrame?: boolean,
  /** A picture to end on (a bridge between two shots). */
  lastFrame?: string,
): Promise<RunResult> {
  if (!prompt.trim()) return { ok: false, reason: "Describe something first." };

  const card = getModelCard(modelId);
  const wanted = card.provider === "comfy" ? COMFY_COOKIE : KEY_COOKIE;
  const jar = await cookies();
  const key = keyIn(jar, wanted);
  if (!key) {
    return {
      ok: false,
      reason:
        card.provider === "comfy"
          ? "Add a Comfy API key to run this model."
          : "Add a fal key to run this model.",
      needsKey: true,
    };
  }

  const provider: Provider =
    useCloud(card.id)
      ? createCloudProvider({ apiKey: key, keep: keepRender })
      : card.provider === "comfy"
      ? createComfyProvider({
          apiKey: key,
          endpoints: { [card.capability]: card.id },
          ...(card.bodyStyle ? { bodyStyle: card.bodyStyle } : {}),
        })
      : createFalProvider({ apiKey: key, endpoints: { [card.capability]: card.id } });

  try {
    const sendable = images?.length ? await inlineLocal(images, process.env.HAGGS_LOCAL_MEDIA, process.env.NODE_ENV) : [];
    const result = await provider.run({
      capability: card.capability,
      prompt,
      ...(sendable.length ? { images: sendable } : {}),
      ...(firstFrame === false ? { firstFrame: false } : {}),
      ...(lastFrame ? { lastFrame: (await inlineLocal([lastFrame], process.env.HAGGS_LOCAL_MEDIA, process.env.NODE_ENV))[0]! } : {}),
      count: outputCount(card, settings),
      // Only the fields this endpoint declares, under the names it declares
      // them. Nothing the model did not ask for reaches the request.
      passthrough: toWireSettings(card.settings, settings),
    });
    if (result.assets.length === 0) {
      return { ok: false, reason: "The model returned no media." };
    }
    return { ok: true, shots: result.assets, usd: result.usd };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    // A 401 here is almost always a bad key, and saying so beats a raw dump.
    if (/401|unauthor|invalid cred/i.test(message)) {
      return { ok: false, reason: `That key was rejected by ${card.provider}.`, needsKey: true };
    }
    if (/insufficient_credits|402/i.test(message)) {
      return { ok: false, reason: "Your Comfy workspace is out of credits.", needsKey: true };
    }
    return { ok: false, reason: message };
  }
}

/**
 * Keeps a generated picture. Provider results expire (Comfy's after a day), so
 * a reference that must outlive the session is fetched once, here, and kept as
 * a data URI inside the project.
 */
export async function keepPicture(url: string): Promise<{ ok: true; dataUri: string } | { ok: false; reason: string }> {
  if (!/^https:\/\//.test(url)) return { ok: false, reason: "Only a provider's https result can be kept this way." };
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return { ok: false, reason: "That result could not be downloaded as a picture." };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) return { ok: false, reason: "That picture is over 8 MB, too large to keep in the project." };
    return { ok: true, dataUri: `data:${type};base64,${bytes.toString("base64")}` };
  } catch {
    return { ok: false, reason: "That result could not be downloaded." };
  }
}

/** Writes a draft for a format from an idea, on the writer's key. */
export async function writeDraft(formatId: string, idea: string, notes: string): Promise<ClaudeResult | { ok: false; reason: string; needsKey: true }> {
  const format = formatById(formatId);
  if (!format) return { ok: false, reason: "Pick a format first." };
  if (idea.trim().length < 12) return { ok: false, reason: "Say a little more about the idea — a sentence or two is enough." };
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key in Keys to write with AI.", needsKey: true };
  return askClaude({ key, request: draftRequest(format, idea.slice(0, 8000), notes.slice(0, 4000)) });
}

/** Drafts looks and locks for an uploaded script's cast and places, on the writer's key. */
export async function fillLooks(request: DraftRequest): Promise<ClaudeResult<Fill> | { ok: false; reason: string; needsKey: true }> {
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key in Keys to fill the sheets with AI.", needsKey: true };
  if (request.user.length > 60_000 || request.system.length > 8_000) return { ok: false, reason: "That request is too large to send." };
  return askClaude<Fill>({
    key,
    request: { ...request, maxTokens: Math.min(request.maxTokens, 12000) },
    schema: FILL_SCHEMA,
    read: (value) => {
      const fill = value as Partial<Fill> | null;
      if (!fill || !Array.isArray(fill.characters) || !Array.isArray(fill.locations)) throw new Error("The writer's reply had no looks to fill.");
      return fill as Fill;
    },
  });
}

export type EditRequest =
  | { tool: "kontext"; frame: string; prompt: string; ratio?: string }
  | { tool: "regenerate"; video: string; seconds: number; prompt: string; firstFrame?: string; references?: string[] }
  | { tool: "kling"; video: string; seconds: number; prompt: string; references?: string[]; resolution?: "720p" | "1080p" }
  | { tool: "aleph"; video: string; seconds: number; prompt: string; references?: string[] }
  | { tool: "genjutsu"; video: string; seconds: number; prompt: string; references: string[]; resolution: "480p" | "720p" }
  | { tool: "voice"; video: string; seconds: number; lines: Line[] };

export type EditResult = { ok: true; url: string; kind: "image" | "video"; usd: number; origin: string } | { ok: false; reason: string; needsKey?: boolean };

const TOOL_NAME = { kontext: "FLUX Kontext fix", regenerate: "MiniMax H3 regenerate", kling: "Kling Omni edit", aleph: "Runway Aleph 2 swap", genjutsu: "Higgsfield Genjutsu recast", voice: "ElevenLabs + Sync lip-sync" } as const;

/** Reads a file haggs plays — a local take or an https link — as bytes for upload. */
async function bytesOf(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  if (url.startsWith("data:")) {
    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(url);
    if (!match) throw new Error("That picture couldn't be read.");
    return { bytes: Uint8Array.from(Buffer.from(match[2]!, "base64")), mime: match[1]! };
  }
  if (url.startsWith("/api/local/")) {
    const { localFile } = await import("../server/local-media");
    const file = localFile(process.env.HAGGS_LOCAL_MEDIA, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
    if (!file) throw new Error("That take isn't in the local media folder.");
    if (file.type.startsWith("video/")) {
      // Comfy's video tools refuse anything wider than 2160px.
      const { fittedVideo } = await import("../server/video-fit");
      return { bytes: await fittedVideo(file.path), mime: file.type };
    }
    const [inlined] = await inlineLocal([url], process.env.HAGGS_LOCAL_MEDIA, process.env.NODE_ENV);
    return bytesOf(inlined!);
  }
  // A hosted server only fetches media from its own store.
  if (hosted() && !isBlobUrl(url)) throw new Error("That take isn't in this app's file store.");
  const got = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!got.ok) throw new Error("That take couldn't be fetched.");
  return { bytes: new Uint8Array(await got.arrayBuffer()), mime: (got.headers.get("content-type") ?? "").split(";")[0]! };
}

/** Prices an edit before it runs, from Comfy's published node prices. */
export async function quoteEdit(request: EditRequest): Promise<number> {
  const seconds = "seconds" in request ? request.seconds : 0;
  const characters = request.tool === "voice" ? request.lines.reduce((n, l) => n + l.text.length, 0) : 0;
  const resolution = request.tool === "genjutsu" ? request.resolution : request.tool === "kling" ? (request.resolution ?? "720p") : undefined;
  return editEstimate({ tool: request.tool, seconds, ...(resolution ? { resolution } : {}), characters });
}

/** Runs one edit on Comfy Cloud and keeps the result. Never retried automatically. */
export async function runEdit(request: EditRequest): Promise<EditResult> {
  const jar = await cookies();
  const key = keyIn(jar, COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to run edits.", needsKey: true };
  // Video edits (Kling, Aleph, Genjutsu) can queue and run for a quarter of an hour or more.
  const cloud = createCloudRunner({ apiKey: key, keep: keepRender, timeoutMs: 45 * 60_000 });
  const up = async (url: string) => {
    const { bytes, mime } = await bytesOf(url);
    return cloud.uploadBytes(bytes, mime);
  };
  const ups = async (urls: string[] = []) => Promise.all(urls.map(up));
  const seed = Math.floor(Math.random() * 2_000_000_000);
  try {
    let workflow;
    switch (request.tool) {
      case "kontext":
        workflow = kontextWorkflow({ image: await up(request.frame), prompt: request.prompt, ...(request.ratio ? { ratio: request.ratio } : {}), seed });
        break;
      case "regenerate":
        workflow = regenerateWorkflow({ video: await up(request.video), prompt: request.prompt, ...(request.firstFrame ? { firstFrame: await up(request.firstFrame) } : {}), references: await ups(request.references) });
        break;
      case "kling":
        workflow = klingEditWorkflow({ video: await up(request.video), prompt: request.prompt, references: await ups(request.references), resolution: request.resolution ?? "720p", seed });
        break;
      case "aleph":
        workflow = alephWorkflow({ video: await up(request.video), prompt: request.prompt, references: await ups(request.references), seed });
        break;
      case "genjutsu":
        workflow = genjutsuWorkflow({ video: await up(request.video), prompt: request.prompt, references: await ups(request.references), resolution: request.resolution, seed });
        break;
      case "voice":
        workflow = voiceWorkflow({ video: await up(request.video), lines: request.lines });
        break;
    }
    const result = await cloud.run(workflow);
    if (result.kind === "audio") throw new Error("The edit came back as sound only. Check your Comfy jobs; nothing was put on the shot.");
    return { ok: true, url: result.url, kind: result.kind, usd: await quoteEdit(request), origin: TOOL_NAME[request.tool] };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The edit didn't run." };
  }
}

export type SpokenLine = { ok: true; url: string; usd: number } | { ok: false; reason: string; needsKey?: boolean };

/** What speaking a line costs, before it is spoken. */
export async function quoteLine(text: string): Promise<number> {
  return editEstimate({ tool: "speech", seconds: 0, characters: text.trim().length });
}

/** Speaks one voice-over line with ElevenLabs on Comfy Cloud and keeps the MP3. Never retried automatically. */
export async function speakLine(text: string, voice: string, expressive = false): Promise<SpokenLine> {
  const jar = await cookies();
  const key = keyIn(jar, COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to make voice-over.", needsKey: true };
  if (!(VOICES as readonly string[]).includes(voice)) return { ok: false, reason: "Pick a voice from the list." };
  try {
    const cloud = createCloudRunner({ apiKey: key, keep: keepRender });
    const result = await cloud.run(speechWorkflow({ text, voice, ...(expressive ? { model: "eleven_v3" as const, stability: 0 } : {}), seed: Math.floor(Math.random() * 2_000_000_000) }));
    if (result.kind !== "audio") throw new Error("The voice came back without sound. Check your Comfy jobs.");
    return { ok: true, url: result.url, usd: await quoteLine(text) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The line wasn't spoken." };
  }
}

export type MadeEffect = { ok: true; url: string; usd: number } | { ok: false; reason: string; needsKey?: boolean };

/** What a sound effect costs, before it is made. */
export async function quoteEffect(seconds: number): Promise<number> {
  return editEstimate({ tool: "sfx", seconds });
}

/** Makes a sound effect from words with ElevenLabs Sound Effects on Comfy Cloud. Never retried automatically. */
export async function makeEffect(text: string, seconds: number): Promise<MadeEffect> {
  const key = keyIn(await cookies(), COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to make sound effects.", needsKey: true };
  try {
    const cloud = createCloudRunner({ apiKey: key, keep: keepRender });
    const result = await cloud.run(soundEffectWorkflow({ text, seconds }));
    if (result.kind !== "audio") throw new Error("The effect came back without sound. Check your Comfy jobs.");
    return { ok: true, url: result.url, usd: await quoteEffect(seconds) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The effect wasn't made." };
  }
}
