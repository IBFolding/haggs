"use client";

import { createRunStore } from "../story/runs";
import { defaultKv } from "../story/kv";

/**
 * Everything you generate shows up in the Gallery, wherever you made it:
 * Photos and Video keep their own, and the board, the editor and the edit
 * tools keep theirs here.
 */

function keep(run: { modelId: string; modelName: string; prompt: string; url: string; kind: "image" | "video"; usd: number | null }) {
  void createRunStore(defaultKv()).record({ ...run, settings: {} }).catch(() => undefined);
}

/** A finished edit (fix, restyle, recast, lip-sync). */
export function galleryEdit(prompt: string) {
  return (r: { ok: boolean; url?: string; kind?: "image" | "video"; usd?: number; origin?: string }) => {
    if (r.ok && r.url && r.kind) keep({ modelId: "edit", modelName: r.origin ?? "Edit", prompt, url: r.url, kind: r.kind, usd: r.usd ?? null });
  };
}

/** A finished shot from the board or the editor. */
export function galleryShot(prompt: string, modelId: string) {
  return (r: { ok: boolean; render?: { url: string; kind: "image" | "video"; usd: number | null }; origin?: string }) => {
    if (r.ok && r.render) keep({ modelId, modelName: r.origin ?? "Shot", prompt, url: r.render.url, kind: r.render.kind, usd: r.render.usd });
  };
}

/** A finished picture from Photos-style runs. */
export function galleryRun(prompt: string, modelId: string, modelName: string) {
  return (r: { ok: boolean; shots?: { url: string; kind: "image" | "video" }[]; usd?: number | null }) => {
    const first = r.ok ? r.shots?.[0] : undefined;
    if (first) keep({ modelId, modelName, prompt, url: first.url, kind: first.kind, usd: r.usd ?? null });
  };
}
