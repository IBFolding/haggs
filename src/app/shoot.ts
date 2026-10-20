import { getModelCard } from "../catalog/models";
import { coerceSettings } from "../catalog/settings";
import { hashPrompt, promptFor } from "../story/assemble";
import type { Project, Shot } from "../story/model";
import { run } from "./actions";

/**
 * Generates one take for the shot at `index`, the same way from the board or
 * the editor. The take is hashed against the prompt it was made from — the
 * whole of staleness — and is returned rather than applied, so the caller
 * decides where it lands.
 */
export async function shoot(project: Project, index: number): Promise<
  { ok: true; render: NonNullable<Shot["render"]>; origin: string } | { ok: false; reason: string; needsKey?: boolean }
> {
  const shot = project.shots[index];
  if (!shot) return { ok: false, reason: "That shot is not on the board any more." };
  const text = promptFor(project, index);
  if (!text.trim()) return { ok: false, reason: "Give the shot a beat before generating it." };
  const card = getModelCard(shot.model.id);
  const result = await run(shot.model.id, text, coerceSettings(card.settings, shot.model.settings));
  if (!result.ok) return { ok: false, reason: result.reason, ...(result.needsKey ? { needsKey: true } : {}) };
  const first = result.shots[0];
  if (!first) return { ok: false, reason: "The provider finished without returning a picture." };
  return { ok: true, render: { url: first.url, kind: first.kind, usd: result.usd, promptHash: hashPrompt(text), at: Date.now() }, origin: card.name };
}
