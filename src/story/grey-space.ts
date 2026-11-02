import { z } from "zod";
import { CAM_SECONDS } from "./grey-camera";
import type { GreyFrame } from "./grey";
import { withKey, dropKey, addProp, moveProp, updateProp, resolveScene, mergeEdit, type GreyScene, type Prop } from "./grey-scene";

export const MATERIALS = {
  concrete: { color: "#777d86", roughness: 0.95 },
  plaster: { color: "#d5cdbd", roughness: 0.85 },
  wood: { color: "#976d45", roughness: 0.65 },
  metal: { color: "#8796a5", roughness: 0.25 },
} as const;
export const materialSchema = z.enum(["concrete", "plaster", "wood", "metal"]);
export type SpatialMaterial = z.infer<typeof materialSchema>;
export const propMaterial = (raw: unknown) => { const key=materialSchema.safeParse(raw).data; return key ? MATERIALS[key] : undefined; };
export const spaceSchema = z.object({ floor: materialSchema, wall: materialSchema });
export type RoomSpace = z.infer<typeof spaceSchema>;
export function roomSpace(raw: unknown): RoomSpace { return spaceSchema.safeParse(raw).data ?? { floor: "concrete", wall: "plaster" }; }
/** Legacy frame coordinates remain authoritative, including existing animation and locks. */
export const propPosition = (p: Pick<Prop, "x" | "y">) => ({ x: (p.x - 0.5) * 6, z: (p.y - 0.5) * 6 });
export function moveSpatialProp(s: GreyScene, id: string, x: number, z: number, time?: number): GreyScene {
  if (s.props?.find(p => p.id === id)?.locked) return s;
  const before = time === undefined ? s : resolveScene(s, time);
  const after = moveProp(before, id, { x: x / 6 + 0.5, y: z / 6 + 0.5 });
  return time === undefined ? after : mergeEdit(s, before, after, time, false);
}
/** Inspector edits share compositor values and record existing animated channels at the playhead. */
export function editSpatialProp(s: GreyScene, id: string, patch: Partial<Pick<Prop, "name" | "w" | "rotate" | "locked" | "hidden" | "material">>, time: number): GreyScene {
  const original = s.props?.find(p=>p.id===id);
  if (!original || (original.locked && (patch.w!==undefined || patch.rotate!==undefined || "material" in patch))) return s;
  const before=resolveScene(s,time);
  const after=updateProp(before,id,{...patch,...(patch.name!==undefined?{name:patch.name.slice(0,60)}:{})});
  return mergeEdit(s,before,after,time,false);
}
export function addStandInProp(s: GreyScene): GreyScene {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><path fill="#8796a5" d="M20 50 80 20 140 50 140 120 80 150 20 120Z"/><path fill="#647180" d="M80 80 140 50 140 120 80 150Z"/></svg>';
  const next = addProp(s, { name: "Box stand-in", url: `data:image/svg+xml,${encodeURIComponent(svg)}` });
  return { ...next, props: next.props!.map((p, i) => i === next.props!.length - 1 ? { ...p, primitive: "box" as const } : p) };
}
/** Strict, bounded contract for a future model adapter; parsing never runs a model or changes a shot. */
export const proposalCameraPathSchema = z.array(z.object({
  t:z.number().finite().min(0).max(CAM_SECONDS),
  angle:z.number().finite().min(-720).max(720), distance:z.number().finite().min(1).max(12),
  height:z.number().finite().min(.2).max(6), lens:z.number().finite().min(14).max(135),
})).min(2).max(12).refine(keys=>keys[0]!.t===0&&keys.at(-1)!.t===CAM_SECONDS&&keys.every((k,i)=>i===0||k.t-keys[i-1]!.t>=.05-1e-9),
  "Camera path must run from 0 to 6 seconds with increasing keys at least 0.05 seconds apart.")
  .describe("Optional camera move: 2–12 ordered keys, first at 0 seconds and last at 6 seconds, at least 0.05 seconds apart. Angles may cross 360 to preserve orbit direction.");
export const sceneProposalSchema = z.object({
  version: z.literal(1), summary: z.string().min(1).max(1000),
  room: spaceSchema,
  people: z.array(z.object({ facing:z.number().finite().min(0).max(360).optional(), label: z.string().min(1).max(24), x: z.number().finite().min(-3).max(3), z: z.number().finite().min(-3).max(3) })).max(6),
  props: z.array(z.object({ material: materialSchema.optional(), name: z.string().min(1).max(60), x: z.number().finite().min(-3).max(3), z: z.number().finite().min(-3).max(3) })).max(20),
  camera: z.object({ angle: z.number().finite().min(0).max(360), distance: z.number().finite().min(1).max(12), height: z.number().finite().min(.2).max(6), lens: z.number().finite().min(14).max(135) }),
  cameraPath: proposalCameraPathSchema.optional(),
  light: z.object({ az: z.number().finite().min(0).max(360), el: z.number().finite().min(5).max(90) }),
});
export type SceneProposal = z.infer<typeof sceneProposalSchema>;
export type SceneProposalRequest = { description: string; references: NonNullable<GreyScene["references"]>; grey: GreyFrame; scene: GreyScene };
export type SceneProposalProvider = (request: SceneProposalRequest, signal: AbortSignal) => Promise<unknown>;
/** Adapter hook returns a reviewable proposal only. Applying it must be an explicit UI action. */
export async function requestSceneProposal(provider: SceneProposalProvider, request: SceneProposalRequest, signal: AbortSignal): Promise<SceneProposal> {
  if (signal.aborted) throw new Error("Scene proposal cancelled");
  const raw = await provider(request, signal);
  if (signal.aborted) throw new Error("Scene proposal cancelled");
  return sceneProposalSchema.parse(raw);
}

/** Palette payloads contain only bounded local choices, never URLs or executable content. */
export const SPATIAL_DRAG_TYPE = "application/x-haggs-spatial";
export type SpatialDrop = { kind: "box" } | { kind: "material"; material: SpatialMaterial };
export function readSpatialDrop(text: string): SpatialDrop | undefined {
  if (text.length > 100) return;
  try { return z.discriminatedUnion("kind", [z.object({kind:z.literal("box")}).strict(), z.object({kind:z.literal("material"),material:materialSchema}).strict()]).safeParse(JSON.parse(text)).data; } catch { return; }
}
export type SpatialTarget = { surface: "floor" | "wall" } | { propId: string } | { x: number; z: number };
export function applySpatialDrop(scene: GreyScene, drop: SpatialDrop, target: SpatialTarget, time: number): GreyScene {
  if (drop.kind === "material") {
    if ("surface" in target) return {...scene,space:{...roomSpace(scene.space),[target.surface]:drop.material}};
    if ("propId" in target) return editSpatialProp(scene,target.propId,{material:drop.material},time);
    return scene;
  }
  if (!("x" in target) || ![target.x,target.z].every(Number.isFinite) || (scene.props?.length??0)>=100) return scene;
  const next=addStandInProp(scene),id=next.props!.at(-1)!.id;
  return moveSpatialProp(next,id,Math.max(-3,Math.min(3,target.x)),Math.max(-3,Math.min(3,target.z)));
}
/** Same angle convention as the existing camera path; preserves lens and height. */
export function spatialCameraAt(cam: GreyFrame["cam"], x: number, z: number): GreyFrame["cam"] {
  if (![x,z].every(Number.isFinite)) return cam;
  const radius=Math.hypot(x,z),rawAngle=Math.atan2(x,-z)*180/Math.PI;
  // Keep the equivalent angle nearest this playhead, including deliberately unwrapped orbits.
  return {...cam,angle:radius<.001?cam.angle:rawAngle+360*Math.round((cam.angle-rawAngle)/360),distance:Math.max(1,Math.min(12,radius))};
}

/** Copy a scene layer, not its source file. Offset the whole animation only when it fits the room. */
export function duplicateSpatialProp(scene: GreyScene, id: string): GreyScene {
  const prop=scene.props?.find(p=>p.id===id);
  if(!prop || (scene.props?.length??0)>=100)return scene;
  const xs=[prop.x,...(prop.keys??[]).flatMap(k=>k.x===undefined?[]:[k.x])];
  const step=1/12,dx=Math.max(...xs)+step<=1?step:Math.min(...xs)-step>=0?-step:0;
  const next=addProp(scene,{name:`${prop.name.slice(0,55)} copy`,url:prop.url});
  const fresh=next.props!.at(-1)!;
  const copy:Prop={...prop,id:fresh.id,name:fresh.name,x:prop.x+dx,locked:false,hidden:false,
    ...(prop.keys?{keys:prop.keys.map(k=>({...k,...(k.x===undefined?{}:{x:k.x+dx})}))}:{}),
    ...(prop.model?{model:{...prop.model}}:{})};
  return {...next,props:next.props!.map(p=>p.id===fresh.id?copy:p)};
}

/** Key the visible prop pose using the compositor's existing animation channels. */
export function keySpatialProp(scene: GreyScene, id: string, time: number, remove = false): GreyScene {
  const original=scene.props?.find(p=>p.id===id);
  if(!original || original.locked || !Number.isFinite(time) || time<0 || time>CAM_SECONDS)return scene;
  const visible=resolveScene(scene,time).props!.find(p=>p.id===id)!;
  if(remove && !original.keys?.some(k=>Math.abs(k.t-time)<.05))return scene;
  const pose={x:visible.x,y:visible.y,w:visible.w,rotate:visible.rotate,opacity:visible.opacity};
  const keys=remove?dropKey(original.keys,time):withKey(original.keys,time,pose);
  // Removing the last key leaves the currently visible pose, rather than jumping to an old base.
  const {keys:_old,...bare}=original;
  const prop=keys?{...original,keys}:{...bare,...pose};
  return {...scene,props:scene.props!.map(p=>p.id===id?prop:p)};
}
