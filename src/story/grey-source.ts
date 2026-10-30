import { normalizeScene, type GreyScene } from "./grey-scene";
import type { Shot } from "./model";
/** Start from this shot's media, retaining an explicitly saved original for comparison and export. No sample fallback. */
export function sceneForShot(shot: Pick<Shot, "greyScene" | "render" | "trimIn"> | undefined): GreyScene {
  const scene = normalizeScene(shot?.greyScene);
  if (scene.source && shot?.render?.url === scene.source.url && scene.source.kind === "video") {
    return {...scene, source:{...scene.source, trimIn:Math.max(0, shot.trimIn ?? 0)}};
  }
  return scene.source || !shot?.render ? scene : {...scene, source: {url:shot.render.url,kind:shot.render.kind, ...(shot.render.kind === "video" && (shot.trimIn ?? 0) > 0 ? {trimIn:shot.trimIn!} : {})}};
}
