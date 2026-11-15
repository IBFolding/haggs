import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,newShot} from '../story/model';
import {readPlan,stepsFor,requestFor,type PlanInput} from './plan';
import {executePlan,newJournal,type Journal} from './execute';
import {createSimpleGate} from './gate';
import {memoryGreyQuoteStore} from '../server/grey-quote-store';
import {createProjectStore} from '../story/store';
import {memoryKv} from '../story/kv';
import {runTool,type ToolContext} from '../story/agent-tools';
const input:PlanInput={title:'Two people, one last sunrise',summary:'A quiet meeting builds into a departure.',aspect:'16:9',look:'Natural grain, practical amber light and restrained performances.',assets:[{key:'rowan',name:'Rowan',kind:'character',prompt:'A weathered young traveller with a worn canvas coat.',references:[]}],shots:[{key:'meet',heading:'THE FIRST MEETING',beat:'She catches his eye, hesitates, then smiles.',camera:'50mm intimate two-shot, slow dolly inward.',light:'Warm late afternoon window light.',seconds:5,format:'video',assetKeys:['rowan'],references:[],narration:{speaker:'ROWAN',text:'Leave a light where we used to be.',voice:'Matilda (female, american)'},effect:{prompt:'A distant train leaves the station.',seconds:2,offset:1}}],music:{prompt:'Intimate piano and cello, then urgent live drums.'}};
test('a validated plan is a proposal, with dependency ordering, bounded references and native voice names',()=>{
 const p=createProject('Original'),before=JSON.stringify(p),plan=readPlan(input,p);assert.equal(JSON.stringify(p),before);const steps=stepsFor(plan);assert.deepEqual(steps.map(s=>s.kind),['image','video','voice','effect','music']);assert.throws(()=>requestFor(steps[1]!),/reference/);assert.equal(requestFor(steps[1]!,{},true).images.length,1);assert.throws(()=>readPlan({...input,shots:[{...input.shots[0],assetKeys:['unknown']}]},p),/missing/);assert.throws(()=>readPlan({...input,shots:[{...input.shots[0],reuseShot:'missing'}]},p),/reused/);
});
test('Simple rejects direct edits while Pro retains the existing tools',async()=>{
 const p=createProject('Original');p.shots=[{...newShot(),beat:'Original',seconds:5}];let saves=0;
 const ctx:ToolContext={mode:'simple',list:async()=>[],load:async()=>p,save:async()=>{saves++;},sheets:async()=>null,workflows:async()=>[],open:()=>{}};
 assert.equal((await runTool('edit_shots',{project:p.id,edits:[{shot:p.shots[0]!.id,seconds:2}]},ctx)).error,true);assert.equal(saves,0);assert.equal((await runTool('open_page',{path:'/editor'},ctx)).error,true);
 assert.equal((await runTool('edit_shots',{project:p.id,edits:[{shot:p.shots[0]!.id,seconds:2}]},{...ctx,mode:'pro'})).error,undefined);assert.equal(saves,1);
});
test('quotes bind exact inputs, identity and price, and concurrent claims submit once',async()=>{
 let owner='A',price=0.5,calls=0;const gate=createSimpleGate({store:memoryGreyQuoteStore(),identity:async()=>owner,estimate:async()=>price,generate:async()=>{calls++;return {ok:true,url:'https://fixture.invalid/result.mp4',kind:'video',usd:price};}}),r=requestFor(stepsFor(readPlan(input,createProject('Test')))[1]!,{},true);
 const q=await gate.quote(r);assert.ok(q.ok);assert.equal((await gate.execute(r,q.id,false)).ok,false);assert.equal((await gate.execute({...r,prompt:'different'},q.id,true)).ok,false);owner='B';assert.equal((await gate.execute(r,q.id,true)).ok,false);owner='A';price=0.8;assert.equal((await gate.execute(r,q.id,true)).ok,false);price=0.5;const result=await Promise.all([gate.execute(r,q.id,true),gate.execute(r,q.id,true)]);assert.equal(result.filter(x=>x.ok).length,1);assert.equal(calls,1);
});
async function setup(){const store=createProjectStore(memoryKv()),original=createProject('Preserve this project');original.shots=[{...newShot(),beat:'Old work',seconds:4}];await store.save(original);const p=(await store.load(original.id))!,plan=readPlan(input,p),steps=stepsFor(plan),journal=newJournal(plan,'A',Object.fromEntries(steps.map(s=>[s.id,0.5])));let saved:Journal|undefined,calls=0,owner='A',stop=false;
 const io={owner:()=>owner,load:()=>store.load(p.id),save:store.save,persist:async(j:Journal)=>{saved=structuredClone(j);},quote:async()=>({ok:true as const,id:crypto.randomUUID(),usd:0.5,expiresAt:Date.now()+1000}),execute:async(r:ReturnType<typeof requestFor>)=>{calls++;return {ok:true as const,url:`/api/local/fixtures/${r.id}.${r.kind==='image'?'png':r.kind==='video'?'mp4':'mp3'}`,kind:r.kind==='image'?'image' as const:r.kind==='video'?'video' as const:'audio' as const,usd:0.5};},stopped:()=>stop};return {store,p,plan,journal,io,calls:()=>calls,saved:()=>saved!,changeOwner:()=>{owner='B';},pause:()=>{stop=true;}};
}
test('the full approved pipeline prepares references, picture, voice, effects and music on a new editable board',async()=>{
 const s=await setup(),j=await executePlan(s.plan,s.journal,s.io);assert.equal(j.state,'complete');assert.equal(s.calls(),5);const p=(await s.store.load(s.p.id))!;assert.equal(p.boards!.length,2);assert.equal(p.boards![0]!.shots[0]!.beat,'Old work');const b=p.boards!.find(b=>b.id===j.board)!;assert.equal(b.shots[0]!.render?.kind,'video');assert.equal(b.shots[0]!.voices?.[0]!.voice,'Matilda (female, american)');assert.ok(b.effects?.[0]?.url);assert.ok(b.music?.url);assert.ok(b.shots[0]!.refs?.[0]?.includes('asset-rowan'));assert.equal(p.threads.length,1);const {buildCut}=await import('../story/cut'),{view}=await import('../story/boards'),{checkCut}=await import('../server/render');const cut=checkCut(buildCut(view(p,b.id)));assert.equal(cut.voices.length,1);assert.equal(cut.effects?.length,1);assert.ok(cut.music);assert.equal(cut.total,5);
 await executePlan(s.plan,j,s.io);assert.equal(s.calls(),5);assert.equal((await s.store.load(s.p.id))!.boards!.find(b=>b.id===j.board)!.shots[0]!.takes!.length,1);
});
test('an interrupted submission remains blocked after reload without generating again',async()=>{
 const s=await setup();let calls=0;const j=await executePlan(s.plan,s.journal,{...s.io,execute:async()=>{calls++;throw Error('Network lost');}});assert.equal(j.state,'blocked');assert.equal(j.steps['asset-rowan']!.phase,'uncertain');await executePlan(s.plan,s.saved(),s.io);assert.equal(calls,1);assert.equal(s.calls(),0);
});
test('durable intent must be saved before any billable submission',async()=>{const s=await setup();const j=await executePlan(s.plan,s.journal,{...s.io,persist:async j=>{if(Object.values(j.steps).some(r=>r.phase==='running'))throw Error('Quota');}});assert.equal(j.state,'blocked');assert.equal(s.calls(),0);});
test('known results survive a failed project save and recover without another provider call',async()=>{
 const s=await setup();let fail=true;const j=await executePlan(s.plan,s.journal,{...s.io,save:async p=>{if(p.threads.length&&fail){fail=false;throw Error('Disk unavailable');}await s.io.save(p);}});assert.equal(j.state,'blocked');assert.equal(s.calls(),1);assert.equal(s.saved().steps['asset-rowan']?.phase,'done');const recovered=await executePlan(s.plan,s.saved(),s.io);assert.equal(recovered.state,'complete');assert.equal(s.calls(),5);
});
test('a price increase, account switch or pause prevents the next submission',async()=>{
 const price=await setup();assert.equal((await executePlan(price.plan,price.journal,{...price.io,quote:async()=>({ok:true,id:'q',usd:0.6,expiresAt:Date.now()+1000})})).state,'blocked');assert.equal(price.calls(),0);
 const account=await setup();account.changeOwner();assert.equal((await executePlan(account.plan,account.journal,account.io)).state,'blocked');assert.equal(account.calls(),0);
 const pause=await setup();const result=await executePlan(pause.plan,pause.journal,{...pause.io,execute:async r=>{const made=await pause.io.execute(r);pause.pause();return made;}});assert.equal(result.state,'paused');assert.equal(pause.calls(),1);
});
test('automatic image routing has a native Comfy workflow, declared settings and an existing nonzero estimate',async()=>{
 const {modelFor}=await import('./plan'),{getModelCard}=await import('../catalog/models'),{toWireSettings}=await import('../catalog/settings'),{cloudModel,cloudPrice,cloudWorkflow}=await import('../providers/cloud-models');
 const m=modelFor({kind:'image',seconds:0,ratio:'9:16'}),card=getModelCard(m.id),wire=toWireSettings(card.settings,m.settings);assert.equal(wire.aspect_ratio,'9:16');assert.equal(wire.resolution,'1K');assert.ok(cloudModel(m.id));assert.ok(cloudPrice(m.id,wire)!>0);const workflow=cloudWorkflow(m.id,{prompt:'A consistent character reference',settings:wire,images:['reference.png']});assert.ok(Object.values(workflow).some(n=>n.class_type==='GeminiNanoBanana2V2'));
});
test('quick trailer moments quote the actual minimum render duration and retain the intended edit length',async()=>{
 const {plannedShots}=await import('./plan'),p=createProject('Fast cut'),plan=readPlan({...input,music:undefined,shots:[{...input.shots[0],seconds:.5,narration:undefined,effect:undefined}]},p),step=stepsFor(plan).find(s=>s.kind==='video')!;assert.equal(requestFor(step,{},true).seconds,4);assert.equal(plannedShots(plan,p)[0]!.seconds,.5);assert.equal(plannedShots(plan,p)[0]!.model.settings.duration,4);
});
test('optional audio steps conform to the existing native Comfy builders',async()=>{
 const {speechWorkflow,musicWorkflow,soundEffectWorkflow}=await import('../providers/cloud-edits');for(const step of stepsFor(readPlan(input,createProject('Sound')))){
 if(step.kind==='voice')assert.doesNotThrow(()=>speechWorkflow({text:step.prompt,voice:step.voice!,seed:1}));if(step.kind==='music')assert.doesNotThrow(()=>musicWorkflow({text:step.prompt,seconds:step.seconds}));if(step.kind==='effect')assert.doesNotThrow(()=>soundEffectWorkflow({text:step.prompt,seconds:step.seconds}));
 }
});
