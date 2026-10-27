import {trajectoryFrame, validateTrajectory, type Trajectory, type Vec3} from './trajectory';
export const CONTROL_FPS=16;
export function controlSpec(t:Trajectory,vertical=false){validateTrajectory(t);const frames=4*Math.round(t.seconds*CONTROL_FPS/4)+1;return{width:vertical?288:512,height:vertical?512:288,frames,fps:CONTROL_FPS,seconds:frames/CONTROL_FPS};}
/** Frame zero and the final frame land exactly on route endpoints; N=4k+1. */
export function controlTime(t:Trajectory,i:number,n:number){return t.seconds*i/(n-1);}
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** Ray/AABB slab intersection, including parallel rays and a camera inside a solid. */
export function boxHit(o:Vec3,d:Vec3,c:Vec3,size:number){let near=-Infinity,far=Infinity;for(const k of ['x','y','z'] as const){const lo=c[k]-size,hi=c[k]+size;if(Math.abs(d[k])<1e-10){if(o[k]<lo||o[k]>hi)return Infinity;continue;}let a=(lo-o[k])/d[k],b=(hi-o[k])/d[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return far<.1?Infinity:near>=.1?near:far;}
/** Actual perspective z-depth of the guide's proxy geometry, NOT reconstructed photo depth.
 * Fixed near/far mapping prevents per-frame normalization flicker. Near=white, far/background=black.
 */
export function depthFrame(t:Trajectory,time:number,width:number,height:number){
 const f=trajectoryFrame(t,time),out=new Uint8Array(width*height),aspect=width/height;
 const boxes=[...[-4,4].flatMap(x=>[-2,4,10].map(z=>({c:{x,y:1,z},s:1}))),{c:f.subject,s:.5}];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=((x+.5)/width-.5)*36/t.lens,v=(.5-(y+.5)/height)*36/t.lens/aspect;
  const ray={x:f.forward.x+u*f.right.x+v*f.up.x,y:f.forward.y+u*f.right.y+v*f.up.y,z:f.forward.z+u*f.right.z+v*f.up.z};
  let z=Infinity;
  if(ray.y<-.000001){const hit=-f.camera.y/ray.y;if(hit>=.1)z=hit;}
  for(const b of boxes)z=Math.min(z,boxHit(f.camera,ray,b.c,b.s));
  const axial=z*dot(ray,f.forward);out[y*width+x]=Number.isFinite(axial)?Math.round(255*Math.max(0,Math.min(1,(40-axial)/39.9))):0;
 }
 return out;
}
