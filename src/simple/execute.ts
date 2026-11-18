import {normalize,view} from '../story/boards';
import {compileShot} from '../story/compile';
import {hashPrompt} from '../story/assemble';
import type {Project,Take} from '../story/model';
import {takesOf} from '../story/takes';
import {plannedShots,requestFor,stepsFor,type Plan,type Step,type StepRequest} from './plan';
import type {Quote,Result} from './gate';
export type Receipt={phase:'running'|'done'|'uncertain';quoteId?:string;result?:Extract<Result,{ok:true}>;request?:StepRequest;reason?:string;reused?:boolean;};
export type Journal={planId:string;revision:number;owner:string;board:string;approved:Record<string,number>;steps:Record<string,Receipt>;state:'ready'|'running'|'paused'|'complete'|'blocked';message:string;planSnapshot?:Plan;export?:{url:string;stamp:string};};
export const journalKey=(owner:string,p:Plan)=>`simple/journal/${owner}/${p.id}/${p.revision}`;
export const boardId=(p:Plan)=>`simple-board-${p.id}-${p.revision}`;
export function newJournal(p:Plan,owner:string,approved:Record<string,number>):Journal{return {planId:p.id,revision:p.revision,owner,board:boardId(p),approved,steps:{},state:'ready',message:'Ready to execute the reviewed plan.',planSnapshot:structuredClone(p)};}
type IO={owner:()=>string;load:()=>Promise<Project|undefined>;save:(p:Project)=>Promise<void>;persist:(j:Journal)=>Promise<void>;quote:(r:StepRequest)=>Promise<Quote>;execute:(r:StepRequest,id:string,consent:boolean)=>Promise<Result>;stopped:()=>boolean;changed?:(j:Journal)=>void;check?:()=>Promise<void>;remember?:(request:StepRequest,result:Extract<Result,{ok:true}>)=>Promise<void>;};
function alive(j:Journal,io:IO){if(io.owner()!==j.owner)throw Error('The account changed. Execution stopped.');}
function attached(p:Project,j:Journal,plan:Plan,step:Step,receipt:Receipt):Project{
 const result=receipt.result;if(!result)return p;const id=`simple-${plan.id}-${plan.revision}-${step.id}`;
 if(step.assetKey){const asset=plan.assets.find(a=>a.key===step.assetKey)!;return {...p,threads:[...p.threads.filter(t=>t.id!==id),{id,name:asset.name,kind:asset.kind==='character'?'character':'motif',color:'#40d99c',ref:result.url}]};}
 const board=p.boards!.find(b=>b.id===j.board);if(!board)throw Error('The production board was removed. The saved result was preserved.');
 const shotSpec=plan.shots.find(s=>s.key===step.shotKey),shotId=shotSpec?`simple-${plan.id}-${plan.revision}-${shotSpec.key}`:undefined;
 let next={...board};
 if(step.kind==='music')next.music={url:result.url,name:step.label,gain:-12};
 else if(step.kind==='effect'){const start=plan.shots.slice(0,plan.shots.findIndex(s=>s.key===step.shotKey)).reduce((n,s)=>n+s.seconds,0)+(shotSpec?.effect?.offset??0);next.effects=[...(board.effects??[]).filter(e=>e.id!==id),{id,name:step.label,url:result.url,start,gain:0,seconds:step.seconds}];}
 else next.shots=board.shots.map(s=>{
  if(s.id!==shotId)return s;
  if(step.kind==='voice'){const n=shotSpec!.narration!;return {...s,voices:[...(s.voices??[]).filter(v=>v.id!==id),{id,text:n.text,speaker:n.speaker,voice:n.voice,url:result.url,offset:0}]};}
  if(takesOf(s).some(t=>t.id===id))return s;
  const take:Take={id,url:result.url,kind:result.kind as 'image'|'video',usd:result.usd,promptHash:hashPrompt(receipt.request?.prompt??step.prompt),at:Date.now(),origin:step.kind==='video'?'MiniMax H3 · Haggy plan':'Nano Banana 2 · Haggy plan'};
  return {...s,takes:[...takesOf(s),take],render:{url:take.url,kind:take.kind,usd:take.usd,promptHash:take.promptHash,at:take.at},trimIn:0};
 });
 return {...p,boards:p.boards!.map(b=>b.id===j.board?next:b)};
}
/** One attempt per step. Persist intent before submitting; persist results before attaching. Never retry an ambiguous request. */
export async function executePlan(inputPlan:Plan,journal:Journal,io:IO):Promise<Journal>{
 const plan=journal.planSnapshot??inputPlan,j=structuredClone(journal),steps=stepsFor(plan);
 const save=async()=>{await io.persist(structuredClone(j));io.changed?.(structuredClone(j));};
 try{
  alive(j,io);await io.check?.();if(j.planId!==plan.id||j.revision!==plan.revision||inputPlan.id!==plan.id||inputPlan.revision!==plan.revision)throw Error('Review this version of the plan first.');
  if(steps.some(s=>j.steps[s.id]?.phase!=='done'&&(!Number.isFinite(j.approved[s.id])||j.approved[s.id]!<=0)))throw Error('Every generation step needs a known reviewed estimate.');
  let p=await io.load();if(!p)throw Error('This project is no longer available.');p=normalize(p);
  if(plan.shots.length&&!p.boards!.some(b=>b.id===j.board)){p={...p,boards:[...p.boards!,{id:j.board,name:plan.title,kind:'reel',shots:plannedShots(plan,p),notes:[],aspect:plan.aspect,sound:{duck:.7,loud:true,clipGain:plan.shots.some(s=>s.narration)?-12:0}}]};alive(j,io);await io.save(p);}
  j.state='running';await save();
  for(const step of steps){
   alive(j,io);await io.check?.();let receipt=j.steps[step.id];
   if(receipt?.phase==='running'||receipt?.phase==='uncertain')throw Error(receipt.reason??'A previous request may still be running or charged. Inspect Activity and provider jobs; it was not submitted again.');
   if(receipt?.phase==='done'){p=await io.load();if(!p)throw Error('Project removed.');alive(j,io);await io.save(attached(normalize(p),j,plan,step,receipt));continue;}
   if(io.stopped()){j.state='paused';j.message='Paused. Completed media is saved; remaining steps have not been submitted.';await save();return j;}
   p=await io.load();if(!p)throw Error('Project removed.');p=normalize(p);
   const results=Object.fromEntries(Object.entries(j.steps).flatMap(([id,r])=>r.result?[[id,r.result]]:[]));let request=requestFor(step,results);
   if(step.shotKey&&(step.kind==='image'||step.kind==='video')){
    const index=p.boards!.find(b=>b.id===j.board)!.shots.findIndex(s=>s.id===`simple-${plan.id}-${plan.revision}-${step.shotKey}`),current=view(p,j.board),shot=current.shots[index],expected=plannedShots(plan,p)[plan.shots.findIndex(s=>s.key===step.shotKey)]!;
    if(!shot||JSON.stringify([shot.beat,shot.heading,shot.seconds,shot.model,shot.direction])!==JSON.stringify([expected.beat,expected.heading,expected.seconds,expected.model,expected.direction]))throw Error('This shot changed in Pro. Review a revised plan before generating.');
    const refs=request.images;current.shots=current.shots.map((s,i)=>i===index?{...s,refs,threadIds:plan.shots.find(x=>x.key===step.shotKey)!.assetKeys.filter(k=>plan.assets.find(a=>a.key===k)?.kind==='character').map(k=>`simple-${plan.id}-${plan.revision}-asset-${k}`)}:s);
    p={...p,boards:p.boards!.map(b=>b.id===j.board?{...b,shots:current.shots}:b)};alive(j,io);await io.save(p);const compiled=compileShot(current,index);if(compiled.blockers.length)throw Error(compiled.blockers[0]);request={...request,prompt:compiled.prompt,images:compiled.firstFrame?compiled.images.slice(0,1):compiled.images,firstFrame:compiled.firstFrame};
   }
   const quote=await io.quote(request);alive(j,io);if(!quote.ok)throw Error(quote.reason);if(quote.usd>j.approved[step.id]!+0.000001)throw Error('The price increased. Re-estimate the remaining plan before continuing.');if(io.stopped()){j.state='paused';j.message='Paused before submission.';await save();return j;}
   receipt={phase:'running',quoteId:quote.id,request};j.steps[step.id]=receipt;j.message=`Making ${step.label}…`;await save();alive(j,io);await io.check?.();
   let result:Result;try{result=await io.execute(request,quote.id,true);}catch{result={ok:false,reason:'The response was interrupted. The provider may still be working. Check Activity before another request.'};}
   if(!result.ok){j.steps[step.id]={...receipt,phase:'uncertain',reason:result.reason};throw Error(result.reason);}
   j.steps[step.id]={...receipt,phase:'done',result};await save();try{await io.remember?.(request,result);}catch{/* The durable result receipt remains authoritative if the reuse cache is full. */}alive(j,io);p=await io.load();if(!p)throw Error('Project removed.');await io.save(attached(normalize(p),j,plan,step,j.steps[step.id]!));
  }
  j.state='complete';j.message='The requested steps are complete and attached to the new board. Review the cut before exporting.';await save();return j;
 }catch(e){j.state='blocked';j.message=e instanceof Error?e.message:'Execution stopped. No automatic retry was made.';try{await save();}catch{}return j;}
}
