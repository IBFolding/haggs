"use server";

import { cookies } from "next/headers";

import { fetchPricing, formatRate } from "../catalog/pricing";
import { MODELS, getModelCard, outputCount } from "../catalog/models";
import { toWireSettings } from "../catalog/settings";
import { createFalProvider } from "../providers/fal";

const KEY_COOKIE = "fal_key";

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
): Promise<RunResult> {
  if (!prompt.trim()) return { ok: false, reason: "Describe something first." };

  let key: string;
  try {
    key = await readKey();
  } catch {
    return { ok: false, reason: "Add a fal key to generate.", needsKey: true };
  }

  const card = getModelCard(modelId);
  const fal = createFalProvider({
    apiKey: key,
    endpoints: { [card.capability]: card.id },
  });

  try {
    const result = await fal.run({
      capability: card.capability,
      prompt,
      ...(images?.length ? { images } : {}),
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
      return { ok: false, reason: "That key was rejected by fal.", needsKey: true };
    }
    return { ok: false, reason: message };
  }
}
