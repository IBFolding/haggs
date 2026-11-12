import { compileShot } from "../story/compile";
import { hashPrompt } from "../story/assemble";
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
  let compiled: ReturnType<typeof compileShot>;
  try { compiled = compileShot(project, index); }
  catch { return {ok:false,reason:"This shot’s model is unavailable. Choose a supported model before generating."}; }
  if (compiled.blockers.length) return {ok:false,reason:compiled.blockers[0]!};
  const {prompt:text,settings,images,firstFrame,endFrame}=compiled;
  const result = await run(shot.model.id, text, settings, images, firstFrame, endFrame);
  if (!result.ok) return { ok: false, reason: result.reason, ...(result.needsKey ? { needsKey: true } : {}) };
  const first = result.shots[0];
  if (!first) return { ok: false, reason: "The provider finished without returning a picture." };
  return { ok: true, render: { url: first.url, kind: first.kind, usd: result.usd, promptHash: hashPrompt(text), at: Date.now() }, origin: compiled.modelName };
}
