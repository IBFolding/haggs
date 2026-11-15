import {VOICES} from "../providers/cloud-edits";
import {z} from 'zod';
import type {Project,Shot} from '../story/model';
import {newShot} from '../story/model';
import {normalize} from '../story/boards';
const text=(max:number)=>z.string().trim().min(1).max(max);
const key=text(40).regex(/^[a-zA-Z0-9_-]+$/);
const refs=z.array(z.string().max(2000000).refine(s=>/^(https:\/\/|\/api\/(media\/|local\/|gpu\/output\?)|data:image\/(png|jpeg|webp);base64,)/.test(s),'Use a saved image reference')).max(4).default([]);
export const planInput=z.object({title:text(100),summary:text(2000),aspect:z.enum(['16:9','9:16']),look:text(1500),assets:z.array(z.object({key,name:text(100),kind:z.enum(['character','location']),prompt:text(3000),references:refs}).strict()).max(8).default([]),shots:z.array(z.object({key,heading:text(120),beat:text(2000),camera:text(600),light:text(400),seconds:z.number().min(.5).max(15),format:z.enum(['image','video']),assetKeys:z.array(key).max(4).default([]),references:refs,reuseShot:z.string().max(100).optional(),narration:z.object({speaker:text(60),text:text(2000).min(5),voice:z.enum(VOICES)}).strict().optional(),effect:z.object({prompt:text(500).min(4),seconds:z.number().min(.5).max(15),offset:z.number().min(0).max(15)}).strict().optional()}).strict()).min(1).max(24),music:z.object({prompt:text(500).min(4)}).strict().optional()}).strict();
export type PlanInput=z.infer<typeof planInput>;
export type Plan=PlanInput&{id:string;project:string;revision:number;createdAt:number};
export type Step={id:string;kind:'image'|'video'|'voice'|'effect'|'music';label:string;prompt:string;seconds:number;ratio:'16:9'|'9:16';references:string[];dependencies:string[];shotKey?:string;assetKey?:string;voice?:string|undefined;};
export const PLAN_EVENT='haggs:simple-plan';
export function readPlan(input:unknown,project:Project,previous?:Plan):Plan{
 const parsed=planInput.parse(input),keys=[...parsed.assets.map(a=>a.key),...parsed.shots.map(s=>s.key)];if(new Set(keys).size!==keys.length)throw Error('Give every asset and shot a unique key.');
 const known=new Set(parsed.assets.map(a=>a.key));for(const s of parsed.shots){if(s.assetKeys.some(k=>!known.has(k)))throw Error(`${s.heading} refers to a missing asset.`);if(s.assetKeys.length+s.references.length>(s.format==='image'?4:9))throw Error(`${s.heading} has too many references.`);if(s.effect&&s.effect.offset+s.effect.seconds>s.seconds)throw Error(`${s.heading}: the sound effect extends beyond its shot.`);if(s.reuseShot&&!normalize(project).boards!.some(b=>b.shots.some(x=>x.id===s.reuseShot)))throw Error('The reused shot is no longer in this project.');}
 if(parsed.music&&parsed.shots.reduce((n,s)=>n+s.seconds,0)<5)throw Error('Music needs at least five seconds.');
 if(parsed.shots.reduce((n,s)=>n+s.seconds,0)>180)throw Error('Keep this Simple plan at 180 seconds or less. Use Pro for longer productions.');
 return {...parsed,id:previous?.id??crypto.randomUUID(),project:project.id,revision:(previous?.revision??0)+1,createdAt:Date.now()};
}
export const planKey=(owner:string,project:string)=>`simple/plan/${owner}/${project}`;
export function stepsFor(plan:Plan):Step[]{
 const steps:Step[]=plan.assets.map(a=>({id:`asset-${a.key}`,assetKey:a.key,kind:'image',label:a.name,prompt:`${a.prompt}\nVisual direction: ${plan.look}. Consistent production reference, no text or labels.`,seconds:0,ratio:plan.aspect,references:a.references,dependencies:[]}));
 for(const s of plan.shots){const base={shotKey:s.key,seconds:s.seconds,ratio:plan.aspect,references:s.references,dependencies:s.assetKeys.map(k=>`asset-${k}`)};
 if(!s.reuseShot)steps.push({...base,id:`picture-${s.key}`,kind:s.format,label:s.heading,prompt:`${s.beat}\nCamera: ${s.camera}\nLighting: ${s.light}\nVisual direction: ${plan.look}`});
 if(s.narration)steps.push({...base,id:`voice-${s.key}`,kind:'voice',label:`${s.narration.speaker} · ${s.heading}`,prompt:s.narration.text,voice:s.narration.voice,references:[],dependencies:[]});
 if(s.effect)steps.push({...base,id:`effect-${s.key}`,kind:'effect',label:`Sound · ${s.heading}`,prompt:s.effect.prompt,seconds:s.effect.seconds,references:[],dependencies:[]});
 }
 if(plan.music)steps.push({id:'music',kind:'music',label:'Original soundtrack',prompt:plan.music.prompt,seconds:Math.ceil(plan.shots.reduce((n,s)=>n+s.seconds,0)),ratio:plan.aspect,references:[],dependencies:[]});
 return steps;
}
export type StepRequest={id:string;kind:Step['kind'];prompt:string;seconds:number;ratio:'16:9'|'9:16';images:string[];voice?:string|undefined;};
export function requestFor(step:Step,results:Record<string,{url:string}>={},estimate=false):StepRequest{
 const images=[...step.references,...step.dependencies.map(id=>{const url=results[id]?.url;if(!url&&!estimate)throw Error('A required character or location reference is not ready.');return url??`https://pending-reference.invalid/${id}`;})];
 return {id:step.id,kind:step.kind,prompt:step.prompt,seconds:step.kind==='video'?Math.max(4,Math.ceil(step.seconds)):step.seconds,ratio:step.ratio,images,...(step.voice?{voice:step.voice}:{})};
}
export function modelFor(step:Pick<StepRequest,'kind'|'seconds'|'ratio'>){return step.kind==='image'?{id:'google/nano-banana-2',name:'Nano Banana 2',settings:{aspect_ratio:step.ratio,resolution:'1K'}}:step.kind==='video'?{id:'minimax/minimax-h3',name:'MiniMax H3',settings:{duration:Math.max(4,Math.ceil(step.seconds)),ratio:step.ratio,resolution:'768P'}}:{id:step.kind==='music'?'sonilo':step.kind==='effect'?'elevenlabs-sfx':'elevenlabs-speech',name:step.kind==='music'?'Sonilo':step.kind==='effect'?'ElevenLabs Sound Effects':'ElevenLabs Voice',settings:{}};}
export function plannedShots(plan:Plan,p:Project):Shot[]{const all=normalize(p).boards!.flatMap(b=>b.shots);return plan.shots.map(s=>{const original=s.reuseShot?all.find(x=>x.id===s.reuseShot):undefined;const config=modelFor({kind:s.format,seconds:s.seconds,ratio:plan.aspect});return {...(original?structuredClone(original):newShot()),id:`simple-${plan.id}-${plan.revision}-${s.key}`,heading:s.heading,beat:s.beat,seconds:s.seconds,model:{id:config.id,settings:config.settings},direction:{camera:s.camera,light:s.light,staging:'',constants:plan.look},refs:s.references};});}
