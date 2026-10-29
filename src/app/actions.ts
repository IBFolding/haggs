"use server";

import { partnerRefusal } from "../server/open-only";
import { hosted, isBlobUrl, putBlob } from "../server/blob";
import { comfyAccess, charged, readKey as platformReadKey, type Access } from "../server/platform";
import { inlineLocal, localUrl } from "../server/local-media";
import { cloudEstimate, createCloudProvider, createCloudRunner, type Kept } from "../providers/cloud";
import { alephWorkflow, editEstimate, genjutsuWorkflow, musicWorkflow, soundEffectWorkflow, klingEditWorkflow, kontextWorkflow, regenerateWorkflow, speechWorkflow, VOICES, voiceWorkflow, type Line } from "../providers/cloud-edits";
import { formatById } from "../sheets/formats";
import { askClaude, draftRequest, type ClaudeResult, type DraftRequest } from "../writer/draft";
import { BREAKDOWN_BUDGET, BREAKDOWN_SCHEMA, validateBreakdown, type Breakdown } from "../writer/breakdown";
import { FILL_SCHEMA, type Fill } from "../writer/fill";
import { cookies } from "next/headers";

import { fetchPricing, formatRate } from "../catalog/pricing";
import { MODELS, getModelCard, outputCount } from "../catalog/models";
import { defaultSettings, toWireSettings } from "../catalog/settings";
import { createComfyProvider } from "../providers/comfy";
import { createCloudModelProvider } from "../providers/cloud-model-provider";
import { cloudModel, cloudPrice } from "../providers/cloud-models";
import { createFalProvider } from "../providers/fal";
import type { Provider } from "../providers/types";

import { CLAUDE_COOKIE, CLAUDE_WORKSPACE_COOKIE, claudeWorkspaceIn, COMFY_COOKIE, KEY_COOKIE, LOCAL_COOKIE, keyIn, localIn } from "../server/keys";
import { localBase } from "../providers/local";
import { keptExtension, mayFetchForKeeping } from "../server/keep-url";
import { creditsText } from "../story/price-text";

import { discoverWorkspaces, type WorkspaceDiscovery } from "../writer/anthropic-workspaces";
import { validateWorkspaceId } from "../writer/anthropic-config";

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

/** Save routing metadata independently; never replace or reveal the API key. */
export async function saveClaudeWorkspace(value: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let id: string | undefined;
  try { id = validateWorkspaceId(value); } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : "Invalid workspace ID." }; }
  (await cookies()).set(CLAUDE_WORKSPACE_COOKIE, id ?? "", COOKIE_OPTIONS);
  return { ok: true };
}
export async function claudeWorkspace(): Promise<string> { return claudeWorkspaceIn(await cookies()) ?? ""; }

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
    // A plan on the platform key counts: runs don't need a key of your own.
    comfy: Boolean(keyIn(jar, COMFY_COOKIE) ?? (await platformReadKey())),
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
        return { id: model.id, label: `about ${creditsText(usd)} for ${seconds}s`, usd, unit: null };
      }
      const cloud = model.provider === "comfy" ? cloudModel(model.id) : undefined;
      if (cloud) {
        const usd = cloudPrice(model.id, toWireSettings(model.settings, defaultSettings(model.settings))) ?? 0;
        const len = model.settings.duration && "default" in model.settings.duration ? ` for ${model.settings.duration.default}s` : "";
        return { id: model.id, label: `about ${creditsText(usd)}${len}`, usd, unit: null };
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

/**
 * Provider links expire, which left Gallery tiles blank a day later. Every
 * finished picture or clip is copied to our own store as it arrives; if the
 * copy fails, the provider's link is still returned so the run is not lost.
 */
async function keepShots(shots: Shot[]): Promise<Shot[]> {
  return Promise.all(
    shots.map(async (shot) => {
      if (!mayFetchForKeeping(shot.url)) return shot;
      try {
        const got = await fetch(shot.url, { signal: AbortSignal.timeout(90_000) });
        const size = Number(got.headers.get("content-length") ?? 0);
        if (!got.ok || size > 200_000_000) return shot;
        const bytes = new Uint8Array(await got.arrayBuffer());
        return { ...shot, url: await keepRender(bytes, keptExtension(got.headers.get("content-type") ?? "", shot.kind)) };
      } catch {
        return shot;
      }
    }),
  );
}

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
  // Every model on this path is a partner API (Comfy Router or fal).
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }

  const card = getModelCard(modelId);
  const wanted = card.provider === "comfy" ? COMFY_COOKIE : KEY_COOKIE;
  const jar = await cookies();
  let key = keyIn(jar, wanted);
  // No key of your own: a person on a plan may run MiniMax H3 on the platform's key, paid for in credits.
  let acc: Extract<Access, { ok: true }> | null = null;
  const cloudDef = card.provider === "comfy" ? cloudModel(card.id) : undefined;
  if (!key && card.provider === "comfy" && (useCloud(card.id) || cloudDef)) {
    const seconds = Number(settings.duration ?? 5);
    const refs = firstFrame === false ? (images?.length ?? 0) : 0;
    const price = cloudDef ? (cloudPrice(card.id, toWireSettings(card.settings, settings)) ?? 0) : cloudEstimate({ seconds, resolution: settings.resolution === "2K" ? "2K" : "768P", references: refs });
    const a = await comfyAccess(price * Math.max(1, outputCount(card, settings)), `${card.name}`, "Add a Comfy API key to run this model.");
    if (!a.ok) return { ok: false, reason: a.reason, needsKey: true };
    acc = a;
    key = a.key;
  }
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

  // Credits and the storage hold settle inside charged(), so a saved result uses the hold and an unused one is released.
  return acc ? charged(acc, (k) => generate(k)) : generate(key);

  async function generate(key: string): Promise<RunResult> {
    const provider: Provider =
      cloudDef
        ? createCloudModelProvider({ apiKey: key, keep: keepRender, modelId: card.id, timeoutMs: 20 * 60_000 })
        : useCloud(card.id)
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
        return { ok: false as const, reason: "The model returned no media." };
      }
      return { ok: true as const, shots: await keepShots(result.assets), usd: result.usd };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      // A 401 here is almost always a bad key, and saying so beats a raw dump.
      if (/401|unauthor|invalid cred/i.test(message)) {
        return { ok: false as const, reason: `That key was rejected by ${card.provider}.`, needsKey: true };
      }
      if (/insufficient_credits|402/i.test(message)) {
        return { ok: false as const, reason: "Your Comfy workspace is out of credits.", needsKey: true };
      }
      return { ok: false as const, reason: message };
    }
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
  return askClaude({ key, workspaceId: claudeWorkspaceIn(jar), request: draftRequest(format, idea.slice(0, 8000), notes.slice(0, 4000)) });
}

/** Drafts looks and locks for an uploaded script's cast and places, on the writer's key. */
export async function fillLooks(request: DraftRequest): Promise<ClaudeResult<Fill> | { ok: false; reason: string; needsKey: true }> {
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key in Keys to fill the sheets with AI.", needsKey: true };
  if (request.user.length > 60_000 || request.system.length > 8_000) return { ok: false, reason: "That request is too large to send." };
  return askClaude<Fill>({
    key, workspaceId: claudeWorkspaceIn(jar),
    request: { ...request, maxTokens: Math.min(request.maxTokens, 12000) },
    schema: FILL_SCHEMA,
    read: (value) => {
      const fill = value as Partial<Fill> | null;
      if (!fill || !Array.isArray(fill.characters) || !Array.isArray(fill.locations)) throw new Error("The writer's reply had no looks to fill.");
      return fill as Fill;
    },
  });
}

/** Breaks an uploaded script down into cast, places, beats and shots, on the writer's key. */
export async function breakDown(request: DraftRequest): Promise<ClaudeResult<Breakdown> | { ok: false; reason: string; needsKey: true }> {
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key in Keys to break the script down with AI.", needsKey: true };
  if (request.user.length > BREAKDOWN_BUDGET + 8_000 || request.system.length > 8_000) return { ok: false, reason: "That script is too large to send in one go." };
  return askClaude<Breakdown>({
    key, workspaceId: claudeWorkspaceIn(jar),
    request: { ...request, maxTokens: Math.min(request.maxTokens, 24000) },
    schema: BREAKDOWN_SCHEMA,
    read: validateBreakdown,
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
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }
  const jar = await cookies();
  const own = keyIn(jar, COMFY_COOKIE);
  if (own) return runEditWith(own, request);
  const acc = await comfyAccess(await quoteEdit(request), TOOL_NAME[request.tool], "Add a Comfy key to run edits.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, (key) => runEditWith(key, request));
}

async function runEditWith(key: string, request: EditRequest): Promise<EditResult> {
  const jar = await cookies();
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
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }
  if (!(VOICES as readonly string[]).includes(voice)) return { ok: false, reason: "Pick a voice from the list." };
  const own = keyIn(await cookies(), COMFY_COOKIE);
  if (own) return speakWith(own, text, voice, expressive);
  const acc = await comfyAccess(await quoteLine(text), "Voice-over", "Add a Comfy key to make voice-over.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, (key) => speakWith(key, text, voice, expressive));
}

async function speakWith(key: string, text: string, voice: string, expressive: boolean): Promise<SpokenLine> {
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
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }
  const own = keyIn(await cookies(), COMFY_COOKIE);
  if (own) return effectWith(own, text, seconds);
  const acc = await comfyAccess(await quoteEffect(seconds), "Sound effect", "Add a Comfy key to make sound effects.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, (key) => effectWith(key, text, seconds));
}

async function effectWith(key: string, text: string, seconds: number): Promise<MadeEffect> {
  try {
    const cloud = createCloudRunner({ apiKey: key, keep: keepRender });
    const result = await cloud.run(soundEffectWorkflow({ text, seconds }));
    if (result.kind !== "audio") throw new Error("The effect came back without sound. Check your Comfy jobs.");
    return { ok: true, url: result.url, usd: await quoteEffect(seconds) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The effect wasn't made." };
  }
}


export type MadeMusic = { ok: true; url: string; usd: number } | { ok: false; reason: string; needsKey?: boolean };

/** What music costs, before it is made. */
export async function quoteMusic(seconds: number): Promise<number> {
  return editEstimate({ tool: "music", seconds });
}

/** Makes music from words with Sonilo on Comfy Cloud. Never retried automatically. */
export async function makeMusic(text: string, seconds: number): Promise<MadeMusic> {
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }
  const own = keyIn(await cookies(), COMFY_COOKIE);
  if (own) return musicWith(own, text, seconds);
  const acc = await comfyAccess(await quoteMusic(seconds), "Music", "Add a Comfy key to make music.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, (key) => musicWith(key, text, seconds));
}

async function musicWith(key: string, text: string, seconds: number): Promise<MadeMusic> {
  try {
    const cloud = createCloudRunner({ apiKey: key, keep: keepRender, timeoutMs: 10 * 60_000 });
    const result = await cloud.run(musicWorkflow({ text, seconds }));
    if (result.kind !== "audio") throw new Error("The music came back without sound. Check your Comfy jobs.");
    return { ok: true, url: result.url, usd: await quoteMusic(seconds) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The music wasn't made." };
  }
}

/** Non-billing generation estimate. Unsupported estimates remain unknown. */
export async function estimateGeneration(modelId:string, prompt:string, settings:Record<string,unknown>, images:string[], firstFrame:boolean):Promise<{usd:number|null;basis:string}> {
 const card=getModelCard(modelId);const wire=toWireSettings(card.settings,settings);
 const cloud=cloudModel(modelId);
 if(cloud)return {usd:cloudPrice(modelId,wire,outputCount(card,settings)),basis:"App’s published Comfy estimate table, 2026-10-25; estimate, not invoice"};
 if(useCloud(modelId))return {usd:cloudEstimate({seconds:Number(settings.duration??6),resolution:String(settings.resolution??"768P"),references:firstFrame?0:images.length}),basis:"App’s published MiniMax H3 rate table, 2026-10-17; estimate, not invoice"};
 const key=keyIn(await cookies(),card.provider==="comfy"?COMFY_COOKIE:KEY_COOKIE);
 if(!key)return {usd:null,basis:"This model needs its connected provider’s pre-flight estimate."};
 try {
 const provider=card.provider==="comfy"?createComfyProvider({apiKey:key,endpoints:{[card.capability]:card.id},...(card.bodyStyle?{bodyStyle:card.bodyStyle}:{})}):createFalProvider({apiKey:key,endpoints:{[card.capability]:card.id}});
 const q=await provider.quote({capability:card.capability,prompt,images,firstFrame,passthrough:wire,count:outputCount(card,settings)});
 return {usd:q.usd,basis:q.basis};
 }catch{return {usd:null,basis:"The provider could not quote this configuration. No job was submitted."};}
}

/** Explicit read-only settings lookup. No inference, key changes or workspace writes. */
export async function findClaudeWorkspaces(): Promise<WorkspaceDiscovery> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Save your Claude key first. It stays on the server." };
  return discoverWorkspaces(key);
}
