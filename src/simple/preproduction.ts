import type {Project,Shot} from '../story/model';
import {normalize} from '../story/boards';
import {type Plan,type PlanInput} from './plan';
import type {Journal} from './execute';
export type BibleEntry={key:string;identity:string;wardrobe:string;anchors:string;image:string;candidates:string[];approval?:string};
export type Bible={version:number;entries:BibleEntry[]};
export type FrameCache=Record<string,{signature:string;shotId:string;url:string}>;
export type FrameApproval={id:string;stamp:string;at:number};
export const bibleKey=(owner:string,project:string)=>`simple/bible/${owner}/${project}`;
export const finalCacheKey=(owner:string,project:string)=>`simple/final-takes/${owner}/${project}`;
export const cacheKey=(owner:string,project:string)=>`simple/frames/${owner}/${project}`;
export const approvalKey=(owner:string,plan:Plan)=>`simple/animatic-approval/${owner}/${plan.id}/${plan.revision}`;
export function syncBible(plan:Plan,previous?:Bible):Bible{return {version:previous?.version??1,entries:plan.assets.map(a=>{const old=previous?.entries.find(e=>e.key===a.key);return old??{key:a.key,identity:a.prompt,wardrobe:'',anchors:'',image:a.references[0]??'',candidates:a.references};})};}
export function bibleStamp(plan:Plan,e:BibleEntry){const a=plan.assets.find(a=>a.key===e.key);return JSON.stringify([a?.name,a?.kind,a?.prompt,plan.look,e.identity,e.wardrobe,e.anchors,e.image]);}
export function bibleApproved(plan:Plan,bible:Bible){return plan.assets.every(a=>{const e=bible.entries.find(e=>e.key===a.key);return !!e?.image&&e.approval===bibleStamp(plan,e);});}
export function approveEntry(plan:Plan,entry:BibleEntry):BibleEntry{if(!/^(https:\/\/|\/api\/|data:image\/(png|jpeg|webp);base64,)/.test(entry.image))throw Error('Choose an actual reference image before approving it.');return {...entry,approval:bibleStamp(plan,entry)};}
export function updateBible(bible:Bible,key:string,change:Partial<Pick<BibleEntry,'identity'|'wardrobe'|'anchors'|'image'>>):Bible{return {version:bible.version+1,entries:bible.entries.map(e=>e.key===key?{...e,...change}:e)};}
function frameSignature(plan:Plan,s:PlanInput['shots'][number],bible:Bible){return JSON.stringify([s.heading,s.beat,s.camera,s.light,plan.aspect,plan.look,s.references,s.assetKeys.map(k=>{const e=bible.entries.find(e=>e.key===k);return e?[e.image,e.identity,e.wardrobe,e.anchors]:null;})]);}
export function referencePlan(plan:Plan,bible:Bible):Plan{
 const assets=plan.assets.filter(a=>{const e=bible.entries.find(e=>e.key===a.key);return !e||e.approval!==bibleStamp(plan,e);}).map(a=>{const e=bible.entries.find(e=>e.key===a.key);return {...a,prompt:`${e?.identity??a.prompt}\nWardrobe/environment: ${e?.wardrobe??''}\nMust preserve: ${e?.anchors??''}`,references:e?.image?[e.image]:a.references};});
 const {music:_music,...rest}=plan;return {...rest,id:`${plan.id}-refs-b${bible.version}`,phase:'references',assets,shots:[]};
}
export function collectReferences(plan:Plan,bible:Bible,journal:Journal):Bible{
 return {version:bible.version+1,entries:bible.entries.map(e=>{const url=journal.steps[`asset-${e.key}`]?.result?.url;if(!url)return e;return {...e,image:url,candidates:[...new Set([...e.candidates,...(e.image?[e.image]:[]),url])].slice(-12)};})};
}
export function storyboardPlan(plan:Plan,bible:Bible,cache:FrameCache,project:Project):Plan{
 if(!bibleApproved(plan,bible))throw Error('Approve the cast and world references before drawing the storyboard.');
 const all=normalize(project).boards!.flatMap(b=>b.shots),{music:_music,...rest}=plan;
 return {...rest,id:`${plan.id}-frames-b${bible.version}`,phase:'storyboard',assets:[],shots:plan.shots.map(s=>{
  const {narration:_narration,effect:_effect,...shot}=s,cached=cache[s.key],reuse=cached?.signature===frameSignature(plan,s,bible)&&cached.shotId!==`simple-${plan.id}-frames-b${bible.version}-${plan.revision}-${s.key}`&&all.some(x=>x.id===cached.shotId&&x.render?.url===cached.url)?cached.shotId:s.reuseShot;
  const identity=s.assetKeys.map(k=>{const e=bible.entries.find(e=>e.key===k)!;return `${plan.assets.find(a=>a.key===k)!.name}: ${e.identity}; wardrobe/environment: ${e.wardrobe}; preserve ${e.anchors}`;}).join('\n');
  return {...shot,format:'image' as const,beat:[s.beat,identity].filter(Boolean).join('\n'),references:[...new Set([...s.references,...s.assetKeys.map(k=>bible.entries.find(e=>e.key===k)!.image)])],assetKeys:[],...(reuse?{reuseShot:reuse}:{})};
 })};
}
export function collectFrames(plan:Plan,frames:Plan,project:Project,bible:Bible,previous:FrameCache):FrameCache{
 const board=normalize(project).boards!.find(b=>b.id===`simple-board-${frames.id}-${frames.revision}`);if(!board)return previous;const next={...previous};for(const s of plan.shots){const shot=board.shots.find(x=>x.id===`simple-${frames.id}-${frames.revision}-${s.key}`);if(shot?.render)next[s.key]={signature:frameSignature(plan,s,bible),shotId:shot.id,url:shot.render.url};}return next;
}
export function frameBoard(project:Project,frames:Plan){return normalize(project).boards!.find(b=>b.id===`simple-board-${frames.id}-${frames.revision}`);}
export function animaticStamp(plan:Plan,frames:Plan,project:Project,bible:Bible):string{
 const board=frameBoard(project,frames);return JSON.stringify([plan.id,plan.revision,plan.look,bible.entries.map(e=>bibleStamp(plan,e)),board?.shots.map(s=>[s.id,s.render?.url,s.render?.at,s.seconds,s.trimIn,s.beat,s.direction,s.fit,s.focus,s.caption,s.captionAt,s.captionFor,s.fx])]);
}
export function canApproveFrames(plan:Plan,frames:Plan,project:Project,bible:Bible){const b=frameBoard(project,frames);return bibleApproved(plan,bible)&&!!b&&b.shots.length===plan.shots.length&&b.shots.every(s=>!!s.render?.url&&typeof s.seconds==='number'&&s.seconds>=.5&&s.seconds<=15);}
export function productionPlan(plan:Plan,frames:Plan,project:Project,bible:Bible,approval:FrameApproval,cache:FrameCache={}):Plan{
 if(!canApproveFrames(plan,frames,project,bible)||approval.stamp!==animaticStamp(plan,frames,project,bible))throw Error('Review and approve the current animatic before animating it.');
 const board=frameBoard(project,frames)!,seconds=board.shots.reduce((n,s)=>n+(s.seconds??0),0);if(seconds>180||plan.music&&seconds<5)throw Error('Keep the cut within 180 seconds and at least five seconds when using music.');
 return {...plan,id:`${plan.id}-final-${approval.id.slice(0,12)}`,phase:'production',assets:[],shots:plan.shots.map((s,i)=>{const frame=board.shots[i]!;if(s.effect&&s.effect.offset+s.effect.seconds>frame.seconds!)throw Error(`${s.heading}: shorten its sound effect or lengthen the shot.`);if(!s.reuseShot&&frame.render!.kind!=='image')throw Error('New video shots need a still storyboard frame.');const cached=cache[s.key],all=normalize(project).boards!.flatMap(b=>b.shots),reuse=cached?.signature===motionSignature(plan,s,frame)&&all.some(x=>x.id===cached.shotId&&x.render?.url===cached.url&&!(x.trimIn??0))?cached.shotId:undefined;return {...s,seconds:frame.seconds!,assetKeys:[],references:s.reuseShot?s.references:[frame.render!.url],...(s.reuseShot?{}:s.format==='image'?{reuseShot:frame.id,startFrame:undefined}:reuse?{reuseShot:reuse,startFrame:undefined}:{startFrame:frame.render!.url})};})};
}

function motionSignature(plan:Plan,s:PlanInput['shots'][number],frame:Shot){return JSON.stringify([plan.aspect,plan.look,s.heading,s.beat,s.camera,s.light,s.format,Math.max(4,Math.ceil(frame.seconds??s.seconds)),frame.render?.url]);}
export function collectFinalTakes(plan:Plan,frames:Plan,production:Plan,project:Project,previous:FrameCache):FrameCache{
 const source=frameBoard(project,frames),board=normalize(project).boards!.find(b=>b.id===`simple-board-${production.id}-${production.revision}`);if(!source||!board)return previous;const next={...previous};for(const [i,s]of plan.shots.entries()){const shot=board.shots.find(x=>x.id===`simple-${production.id}-${production.revision}-${s.key}`);if(s.format==='video'&&shot?.render?.kind==='video')next[s.key]={signature:motionSignature(plan,s,source.shots[i]!),shotId:shot.id,url:shot.render.url};}return next;
}
