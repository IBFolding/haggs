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
  const existing = scene.surfaces?.find(s => s.id === target)
    ?? scene.surfaces?.find(s => s.label.toLowerCase() === target.toLowerCase());
  // Only the tray's explicit creation chips may create a surface. A deleted ID
  // must never become a label, or silently redirect the edit to another area.
  const preset = ["Floor", "Wall", "Door", "Window"].find(label => label.toLowerCase() === target.toLowerCase());
  if (!existing && !preset) return {scene, selected:target, kind:"missing" as const};
  const next = assignSurfaceReference(scene, existing?.id ?? preset!, ref);
  const selected = existing?.id ?? next.surfaces!.at(-1)!.id;
  return {scene:next, selected, kind:"surface" as const};
}
