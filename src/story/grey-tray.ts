import { addProp, assignObjectReference, assignSurfaceReference, updateProp, type GreyScene, type RoomReference } from "./grey-scene";

/** Upload always adds a layer. Its role and selection belong to that new layer. */
export function addUploadedLayer(scene: GreyScene, asset: {name:string; url:string}, role: "actor" | "object") {
  const next = addProp(scene, asset);
  const selected = next.props!.at(-1)!.id;
  return {scene:updateProp(next, selected, {role}), selected};
}

/** Keep the resolved target selected so successive thumbnails audition the same layer. */
export function applyTrayReference(scene: GreyScene, target: string, ref: RoomReference) {
  const actor = target === "actor:";
  if (actor || target.startsWith("object:")) {
    const next = assignObjectReference(scene, actor ? null : target.slice(7) || null, ref);
    const selected = !actor && scene.props?.some(p => p.id === target.slice(7)) ? target.slice(7) : next.props!.at(-1)!.id;
    return {scene:actor ? updateProp(next, selected, {role:"actor"}) : next, selected, kind:"objects" as const};
  }
  const next = assignSurfaceReference(scene, target, ref);
  const selected = next.surfaces!.find(s => s.id === target || s.label.toLowerCase() === target.toLowerCase())!.id;
  return {scene:next, selected, kind:"surface" as const};
}
