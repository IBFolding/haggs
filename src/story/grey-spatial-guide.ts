import { subjectFacing, project, type GreyFrame } from "./grey";
import { figuresMarkup, figureSegments } from "./grey-figure";
import { describeLighting, resolveScene, type GreyScene } from "./grey-scene";
import { MATERIALS, propMaterial, propPosition, roomSpace } from "./grey-space";

type Point = { x: number; y: number; z: number };
/** Pure local geometry: no SVG supplied by a model and no remote image/model fetches. */
export function spatialGuide(grey: GreyFrame, cam: GreyFrame["cam"], scene: GreyScene, t: number, size: { w: number; h: number }): string {
  const aspect = size.w / size.h, room = roomSpace(scene.space), resolved = resolveScene(scene, t);
  const polygon = (points: Point[], color: string, opacity = 1) => {
    const projected = points.map(p => project(cam, p, aspect));
    if (projected.some(p => !p)) return "";
    return `<polygon points="${projected.map(p => `${(p!.u * size.w).toFixed(2)},${(p!.v * size.h).toFixed(2)}`).join(" ")}" fill="${color}" opacity="${opacity}" stroke="#303740" stroke-width="1"/>`;
  };
  const floor = MATERIALS[room.floor].color, wall = MATERIALS[room.wall].color;
  const horizon = (project(cam, { x: 0, y: 0, z: 3 }, aspect)?.v ?? .55) * size.h;
  const background = `<rect width="${size.w}" height="${size.h}" fill="${wall}"/><rect y="${horizon.toFixed(2)}" width="${size.w}" height="${size.h}" fill="${floor}"/>`
    + polygon([{ x:-3,y:0,z:-3 },{ x:3,y:0,z:-3 },{ x:3,y:0,z:3 },{ x:-3,y:0,z:3 }], floor)
    + polygon([{ x:-3,y:0,z:3 },{ x:3,y:0,z:3 },{ x:3,y:3.5,z:3 },{ x:-3,y:3.5,z:3 }], wall);
  const layers: { depth: number; svg: string }[] = [];
  for (const subject of grey.subjects) {
    const angle = cam.angle * Math.PI / 180;
    const body = figureSegments(subject, t, grey.pose ?? "stand", subjectFacing(subject), { x:Math.sin(angle)*cam.distance, z:-Math.cos(angle)*cam.distance, min:3.2 })[0]!.a;
    const at = project(cam, body, aspect);
    if (at) layers.push({ depth: at.depth, svg: figuresMarkup({ ...grey, subjects: [subject] }, cam, t, size) });
  }
  for (const prop of (resolved.props ?? []).slice(0, 100)) {
    if (prop.hidden || prop.opacity <= 0) continue;
    const at = propPosition(prop), side = prop.w * 4;
    if (![at.x, at.z, side, prop.rotate, prop.opacity].every(Number.isFinite)) continue;
    const center = project(cam, { ...at, y: side / 2 }, aspect); if (!center) continue;
    const angle = prop.rotate * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const point = (x: number, y: number, z: number): Point => prop.primitive === "box"
      ? { x: at.x + x*c + z*s, y, z: at.z - x*s + z*c }
      : { x: at.x + x*c - (y-side/2)*s, y: side/2+x*s+(y-side/2)*c, z: at.z };
    const h = side / 2;
    const corners = [[-h,0,-h],[h,0,-h],[h,side,-h],[-h,side,-h],[-h,0,h],[h,0,h],[h,side,h],[-h,side,h]].map(([x,y,z]) => point(x!,y!,z!));
    const faces = prop.primitive === "box" ? [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]] : [[0,1,2,3]];
    const parts = faces.map((face,i) => {
      const points = face.map(index => corners[index]!);
      const depth = points.reduce((n,p) => n + (project(cam,p,aspect)?.depth ?? 0),0)/4;
      return { depth, svg: polygon(points, propMaterial(prop.material)?.color ?? ["#8796a5","#71808f","#566473","#a4b1be","#7c8b9a","#667584"][i]!, Math.max(0,Math.min(1,prop.opacity))) };
    }).sort((a,b)=>b.depth-a.depth);
    layers.push({ depth: center.depth, svg: parts.map(p=>p.svg).join("") });
  }
  return background + layers.sort((a,b)=>b.depth-a.depth).map(l=>l.svg).join("");
}
export function spatialPrompt(scene?: GreyScene): string {
  if (!scene) return "";
  const room = roomSpace(scene.space);
  const props = (scene.props ?? []).filter(p => !p.hidden).slice(0,100).map(p=>p.name.slice(0,60)+(propMaterial(p.material)?` (${p.material})`:""));
  return [scene.direction?.slice(0,4000), scene.space ? `Floor material: ${room.floor}. Wall material: ${room.wall}.` : "", props.length ? `The prop stand-ins represent: ${props.join(", ")}. Keep their positions and scale.` : "", describeLighting(scene)].filter(Boolean).join(" ");
}
/** Only generation-relevant inputs invalidate an approved first frame. Source/take changes do not. */
export function guideSignature(grey: GreyFrame, scene: GreyScene | undefined, beat: string, vertical: boolean): string {
  return JSON.stringify({ grey, beat, vertical, scene: scene ? { space:scene.space, direction:scene.direction, props:scene.props, lights:scene.lights } : null });
}
