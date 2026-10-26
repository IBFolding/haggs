/** Deterministic 2D crop motion inside the shot's filled frame, never a 3D camera. */
export type ReframePoint = {id:string;at:number;x:number;y:number;zoom:number;ease:"linear"|"smooth"};
export type ReframePath = {points:ReframePoint[];offset?:number};
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
export function checkedReframe(raw:unknown):ReframePath {
 const p=raw as ReframePath;if(!p||!Array.isArray(p.points)||p.points.length<2||p.points.length>20)throw Error("A reframe path needs 2–20 points.");
 const number=(n:unknown,min:number,max:number)=>{if(typeof n!=="number"||!Number.isFinite(n)||n<min||n>max)throw Error("Reframe path values are out of range.");return n;};
 const points=p.points.map(v=>({id:String(v?.id??" ").trim().slice(0,80),at:number(v.at,0,7200),x:number(v.x,0,1),y:number(v.y,0,1),zoom:number(v.zoom,1,4),ease:v.ease==="smooth"?"smooth" as const:"linear" as const})).sort((a,b)=>a.at-b.at);
 if(points.some(v=>!v.id)||new Set(points.map(v=>v.id)).size!==points.length)throw Error("Reframe point IDs must be unique.");
 if(points.some((v,i)=>i>0&&v.at-points[i-1]!.at<.01))throw Error("Reframe points need distinct times.");
 return {points,...(p.offset!==undefined?{offset:number(p.offset,0,7200)}:{})};
}
export function reframeAt(path:ReframePath,time:number):{x:number;y:number;zoom:number} {
 const points=path.points;const t=time+(path.offset??0);let a=points[0]!,b=a;for(let i=1;i<points.length;i++){b=points[i]!;if(t<=b.at)break;a=b;}
 let u=a===b?0:clamp((t-a.at)/(b.at-a.at),0,1);if(a.ease==="smooth")u=u*u*(3-2*u);
 const zoom=clamp(a.zoom+(b.zoom-a.zoom)*u,1,4);const half=.5/zoom;
 return {zoom,x:clamp(a.x+(b.x-a.x)*u,half,1-half),y:clamp(a.y+(b.y-a.y)*u,half,1-half)};
}
export function reframeStyle(path:ReframePath,time:number){const p=reframeAt(path,time);return{transformOrigin:"0 0",transform:`translate(${(0.5-p.x*p.zoom)*100}%, ${(0.5-p.y*p.zoom)*100}%) scale(${p.zoom})`};}
export function offsetReframe(path:ReframePath,by:number):ReframePath{return {...path,offset:(path.offset??0)+by};}
/** ffmpeg zoompan evaluates one output frame per 30fps input frame. Numeric-only expressions. */
export function reframeFilter(raw:ReframePath,width:number,height:number):string {
 const path=checkedReframe(raw);const pts=path.points;const t=`(on/30+${path.offset??0})`;
 const expression=(key:"x"|"y"|"zoom")=>{let expr=String(pts.at(-1)![key]);for(let i=pts.length-2;i>=0;i--){const a=pts[i]!,b=pts[i+1]!;const u=`clip((${t}-${a.at})/${b.at-a.at},0,1)`;const eased=a.ease==="smooth"?`(${u}*${u}*(3-2*${u}))`:u;expr=`if(lt(${t},${b.at}),${a[key]}+(${b[key]-a[key]})*${eased},${expr})`;}return expr;};
 const z=expression("zoom");const x=`iw*max(0.5/zoom,min(1-0.5/zoom,${expression("x")}))-iw/zoom/2`;const y=`ih*max(0.5/zoom,min(1-0.5/zoom,${expression("y")}))-ih/zoom/2`;
 // Escape expression commas instead of quoting: safe in both argv and the exported shell script.
 const escape=(v:string)=>v.replaceAll(",","\\,");
 return `zoompan=z=${escape(z)}:x=${escape(x)}:y=${escape(y)}:d=1:s=${width}x${height}:fps=30`;
}
