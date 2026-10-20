"use server";

import { inlineLocal } from "../server/local-media";
import { cookies } from "next/headers";

import { fetchPricing, formatRate } from "../catalog/pricing";
import { MODELS, getModelCard, outputCount } from "../catalog/models";
import { toWireSettings } from "../catalog/settings";
import { createComfyProvider } from "../providers/comfy";
import { createFalProvider } from "../providers/fal";
import type { Provider } from "../providers/types";

const KEY_COOKIE = "fal_key";
const COMFY_COOKIE = "comfy_key";

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

export async function keysHeld(): Promise<{ comfy: boolean; fal: boolean }> {
  const jar = await cookies();
  return {
    comfy: Boolean(jar.get(COMFY_COOKIE)?.value),
    fal: Boolean(jar.get(KEY_COOKIE)?.value),
  };
}

export async function clearKey(): Promise<void> {
  const jar = await cookies();
  jar.set(KEY_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function hasKey(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(KEY_COOKIE)?.value);
}

async function readKey(): Promise<string> {
  const jar = await cookies();
  const key = jar.get(KEY_COOKIE)?.value;
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
  const key = jar.get(wanted)?.value;
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
    card.provider === "comfy"
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
