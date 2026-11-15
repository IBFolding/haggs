import {test} from 'node:test';
import assert from 'node:assert/strict';
import {claimProject,projectOwnerKey,syncAccount} from './account-sync';
import {memoryKv} from './kv';
import {createProjectStore} from './store';
import {createProject,type Project} from './model';
import type {Remote} from './cloud-sync';
function remote(){const rows=new Map<string,{project:Project;sheets:string|null}>();return {rows,io:{list:async()=>[...rows.values()].map(r=>({id:r.project.id,updatedAt:r.project.updatedAt})),get:async(id:string)=>rows.get(id)??null,put:async(project:Project,sheets:string|null)=>{rows.set(project.id,{project,sheets});},remove:async(id:string)=>{rows.delete(id);}} satisfies Remote};}

test('sign-in alone never uploads unassigned device projects; explicit enrollment syncs them',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Device only');await store.save(p);
 assert.equal((await syncAccount(kv,store,r.io,'alice')).pushed,0);assert.equal(r.rows.size,0);
 await claimProject(kv,store,'alice',p.id);assert.equal((await syncAccount(kv,store,r.io,'alice')).pushed,1);
 assert.equal(r.rows.get(p.id)!.project.name,p.name);
});
test('switching accounts cannot upload the previous account project, sheets or file cache',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),a=remote(),b=remote(),p=createProject('Alice private');await store.save(p);await kv.set(`sheets/${p.id}`,'private');
 await claimProject(kv,store,'alice',p.id);await syncAccount(kv,store,a.io,'alice');
 assert.equal((await syncAccount(kv,store,b.io,'bob')).pushed,0);assert.equal(b.rows.size,0);
 await assert.rejects(()=>claimProject(kv,store,'bob',p.id),/another account/);
 assert.equal(await kv.get(projectOwnerKey(p.id)),'alice');
});
test('each account has separate tombstones, so another account copy is not deleted',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Remote');r.rows.set(p.id,{project:p,sheets:null});
 await kv.set('sync/known',[p.id]);await kv.set('sync/account/alice/known',[p.id]);
 const report=await syncAccount(kv,store,r.io,'bob');
 assert.equal(report.removed,0);assert.equal(report.pulled,1);assert.equal(await kv.get(projectOwnerKey(p.id)),'bob');
});
test('two devices restore an enrolled project and the new device associates it only with its owner',async()=>{
 const a=memoryKv(),b=memoryKv(),sa=createProjectStore(a),sb=createProjectStore(b),r=remote(),p=createProject('Proof');await sa.save(p);await claimProject(a,sa,'alice',p.id);await syncAccount(a,sa,r.io,'alice');
 assert.equal((await syncAccount(b,sb,r.io,'alice')).pulled,1);assert.equal((await sb.load(p.id))!.name,'Proof');
 assert.equal(await b.get(projectOwnerKey(p.id)),'alice');assert.equal((await syncAccount(b,sb,remote().io,'bob')).pushed,0);
});
test('a late response after sign-out cannot save a project or advance sync metadata',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Late');r.rows.set(p.id,{project:p,sheets:null});let active=true;
 const io={...r.io,get:async(id:string)=>{active=false;return r.io.get(id);}};
 await assert.rejects(()=>syncAccount(kv,store,io,'alice',undefined,()=>active),/account changed/);
 assert.equal((await store.list()).length,0);assert.equal(await kv.get('sync/account/alice/known'),undefined);
});
test('a remote ID collision never replaces an unassigned device copy',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Keep local');await store.save(p);r.rows.set(p.id,{project:{...p,name:'Remote name'},sheets:null});
 await assert.rejects(()=>syncAccount(kv,store,r.io,'alice'),/conflicts with a device copy/);
 assert.equal((await store.load(p.id))!.name,'Keep local');assert.equal(await kv.get(projectOwnerKey(p.id)),undefined);
});
test('portable file mappings are separated per account',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),a=remote(),b=remote();
 const make=(name:string)=>({...createProject(name),media:[{id:name,url:'/api/local/shared.png',kind:'image' as const,name,origin:'fixture',status:'reference' as const,note:''}]});
 const pa=make('A');await store.save(pa);await claimProject(kv,store,'alice',pa.id);
 await syncAccount(kv,store,a.io,'alice',{keep:async()=>'/api/media/alice.png'});
 const pb=make('B');await store.save(pb);await claimProject(kv,store,'bob',pb.id);let calls=0;
 await syncAccount(kv,store,b.io,'bob',{keep:async()=>{calls++;return '/api/media/bob.png';}});
 assert.equal(calls,1);assert.equal(b.rows.get(pb.id)!.project.media![0]!.url,'/api/media/bob.png');
});

test('damaged account snapshots are rejected before changing local project records',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Corrupt');
 r.rows.set(p.id,{project:{...p,shots:[null]} as unknown as Project,sheets:null});
 await assert.rejects(()=>syncAccount(kv,store,r.io,'alice'));
 assert.equal((await store.list()).length,0);assert.equal(await kv.get(projectOwnerKey(p.id)),undefined);
});
test('a restored account version that removed script sheets clears the old device sheets',async()=>{
 const kv=memoryKv(),store=createProjectStore(kv),r=remote(),p=createProject('Updated');
 await store.save(p);await claimProject(kv,store,'alice',p.id);await kv.set(`sheets/${p.id}`,'old local sheets');
 r.rows.set(p.id,{project:{...p,updatedAt:Date.now()+1000},sheets:null});
 assert.equal((await syncAccount(kv,store,r.io,'alice')).pulled,1);
 assert.equal(await kv.get(`sheets/${p.id}`),undefined);
});
