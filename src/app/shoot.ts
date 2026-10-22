import { getModelCard } from "../catalog/models";
import { coerceSettings } from "../catalog/settings";
import { hashPrompt, promptFor } from "../story/assemble";
import type { Project, Shot } from "../story/model";
import { inputsFor, renderSeconds } from "../story/references";
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
  const { images, firstFrame } = inputsFor(shot, card.inputImages);
  const settings = coerceSettings(card.settings, shot.model.settings);
  // The shot's own length, not the model's default, so the price shown is the price sent.
  const seconds = renderSeconds(shot, card.settings.duration);
  if (seconds !== null) settings.duration = seconds;
  const result = await run(shot.model.id, text, settings, images, firstFrame, firstFrame && shot.endsOn ? shot.endsOn : undefined);
  if (!result.ok) return { ok: false, reason: result.reason, ...(result.needsKey ? { needsKey: true } : {}) };
  const first = result.shots[0];
  if (!first) return { ok: false, reason: "The provider finished without returning a picture." };
  return { ok: true, render: { url: first.url, kind: first.kind, usd: result.usd, promptHash: hashPrompt(text), at: Date.now() }, origin: card.name };
}
