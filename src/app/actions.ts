"use server";

import { inlineLocal, localUrl } from "../server/local-media";
import { cloudEstimate, createCloudProvider } from "../providers/cloud";
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

const KEY_COOKIE = "fal_key";
const COMFY_COOKIE = "comfy_key";
/** The writer's key. Claude drafts scripts and fills sheets on your own Anthropic account. */
const CLAUDE_COOKIE = "claude_key";

/**
 * In local development a key can also come from .env.local, so a machine that
 * already holds its keys doesn't need them typed again. A key in the browser
 * always wins; in production only the browser's key is ever used.
 */
const ENV_FOR: Record<string, string> = { [COMFY_COOKIE]: "COMFY_API_KEY", [KEY_COOKIE]: "FAL_KEY", [CLAUDE_COOKIE]: "ANTHROPIC_API_KEY" };
function keyIn(jar: Awaited<ReturnType<typeof cookies>>, cookie: string): string | undefined {
  const own = jar.get(cookie)?.value;
  if (own) return own;
  if (process.env.NODE_ENV === "production") return undefined;
  return process.env[ENV_FOR[cookie] ?? ""]?.trim() || undefined;
}

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
async function keepRender(bytes: Uint8Array, extension: "mp4" | "webm"): Promise<string> {
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
