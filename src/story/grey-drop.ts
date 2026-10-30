import { addProp, updateProp, type GreyScene } from "./grey-scene";
export const ASSET_DRAG = "application/x-haggs-asset";
/** Accept only image addresses, never executable drag content. Swaps keep placement and keys. */
export function dropAsset(scene: GreyScene, payload: string, x: number, y: number, target?: string) {
  try {
    const a = JSON.parse(payload);
    if (typeof a.name !== "string" || typeof a.url !== "string" || !/^(https?:\/\/|\/(?!\/))/.test(a.url)) return null;
    const existing = scene.props?.find(p => p.id === target);
    if (existing?.locked) return null;
    const next = existing ? updateProp(scene, existing.id, { url: a.url, name: a.name.slice(0,80) }) : addProp(scene, {url:a.url,name:a.name.slice(0,80)});
    const id = existing?.id ?? next.props!.at(-1)!.id;
    return { id, scene: existing ? next : updateProp(next, id, { x:Math.max(0,Math.min(1,x)), y:Math.max(0,Math.min(1,y)), role:a.role === "actor" ? "actor" : "object" }) };
  } catch { return null; }
}
