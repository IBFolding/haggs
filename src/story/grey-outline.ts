import { updateSurface, type GreyScene, type Surface } from "./grey-scene";
/** A replacement revision distinguishes A → B → A, including reuploading the same URL. */
export function outlineSource(scene: GreyScene, url: string | null, isVideo: boolean): string {
  return JSON.stringify([url, isVideo, scene.source?.revision ?? null, scene.source?.trimIn ?? 0]);
}
export function applyOutline(scene: GreyScene, id: string, started: string, current: string, patch: Pick<Surface, "mask" | "selection" | "mode" | "words">): GreyScene {
  if (started !== current || !scene.surfaces?.some(s => s.id === id)) return scene;
  return updateSurface(scene, id, patch);
}
