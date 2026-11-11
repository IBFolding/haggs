import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryKv } from '../story/kv';
import { createGameStore } from './store';
import { defaultSpec } from './spec';
import { exportPlayable, importPlayable, readWorkbench, revisionOf, recordEvent, repairBrief, type RunReport } from './workbench';
import { SKYBOUND_RELAY } from './showcase/skybound-relay';

test('project packet round-trips the editable game, brief and checkpoint without overwriting the original', async()=>{
 const store=createGameStore(memoryKv());const original=await store.create(defaultSpec('runner'));
 const w=readWorkbench(undefined,original.spec);w.brief.goal='Reach the last gate';w.checkpoints.push({id:'first',name:'First playable',at:1,spec:original.spec});
 await store.workspace(original.id,w);
 const p=importPlayable(JSON.parse(JSON.stringify(exportPlayable(original.spec,w))));
 const imported=await store.create(p.spec);await store.workspace(imported.id,p.workbench);
 assert.notEqual(imported.id,original.id);assert.equal((await store.get(original.id))?.workbench?.brief.goal,'Reach the last gate');assert.equal((await store.get(imported.id))?.workbench?.checkpoints.length,1);
});
test('restoring a checkpoint preserves the replaced game through Undo',async()=>{
 const store=createGameStore(memoryKv());const original=await store.create(defaultSpec('collector'));
 await store.change(original.id,{...original.spec,title:'Changed'});const restored=await store.change(original.id,original.spec);
 assert.equal(restored?.spec.title,original.spec.title);assert.equal((await store.undo(original.id))?.spec.title,'Changed');
});
test('invalid imports fail and oversized or malformed review data is bounded',()=>{
 assert.throws(()=>importPlayable({format:'wrong'}));assert.throws(()=>importPlayable({format:'haggs.playable/1',spec:{}}));
 const w=readWorkbench({brief:{goal:'x'.repeat(3000)},checkpoints:[{id:'bad',name:'Broken',at:1,spec:{}}],reviews:[{revision:'invalid',at:1}]},defaultSpec('runner'));
 assert.equal(w.brief.goal.length,600);assert.equal(w.checkpoints.length,0);assert.equal(w.reviews.length,0);
});
test('repair uses review for the exact revision and does not silently reuse old quality approval',()=>{
 const spec=defaultSpec('runner'),w=readWorkbench(undefined,spec);w.reviews=[{revision:revisionOf(spec),at:1,controls:true,goal:false,progression:false,notes:'The gate is unreachable.'}];
 assert.match(repairBrief(spec,w),/gate is unreachable/);assert.match(repairBrief({...spec,title:'New revision'},w),/No human review/);assert.doesNotMatch(repairBrief({...spec,title:'New revision'},w),/gate is unreachable/);
});
test('runtime observations reject malformed scores, record outcome and reset on replay',()=>{
 let r:RunReport={revision:'aabbccdd',startedAt:100,ready:false,started:false,seconds:0,score:null,outcome:'playing',errors:[]};
 r=recordEvent(r,{type:'ready'},100)!;r=recordEvent(r,{type:'started'},200)!;r=recordEvent(r,{type:'score',score:50},1200)!;
 assert.equal(r.seconds,1);assert.equal(r.started,true);assert.equal(recordEvent(r,{type:'score',score:Infinity},1300),undefined);assert.equal(recordEvent(r,{type:'end',won:'true',score:1},1300),undefined);
 r=recordEvent(r,{type:'end',won:true,score:100},2200)!;assert.equal(r.outcome,'won');assert.equal(recordEvent(r,{type:'score',score:5},2300),undefined);
 r=recordEvent(r,{type:'ready'},3000)!;assert.equal(r.started,false);assert.equal(r.score,null);assert.equal(r.outcome,'playing');
});
test('the original 3D starter parses as plain game code without a provider request',()=>{
 assert.equal(SKYBOUND_RELAY.three,true);assert.doesNotThrow(()=>new Function('HAGGS','THREE',SKYBOUND_RELAY.code));assert.ok(!/fetch\s*\(/.test(SKYBOUND_RELAY.code));
});
test('explicit 3D web export retains sandbox and pinned runtime while offline export stays blocked',async()=>{
 const {standaloneGame}=await import('./standalone');
 await assert.rejects(()=>standaloneGame(SKYBOUND_RELAY),/2D/);
 const html=await standaloneGame(SKYBOUND_RELAY,fetch,undefined,{allowExternalRuntime:true});
 assert.match(html,/sandbox="allow-scripts"/);assert.match(html,/three@0\.170\.0/);assert.doesNotMatch(html,/allow-same-origin/);
});
