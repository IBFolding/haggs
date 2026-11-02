import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryKv,type Kv} from './kv';
import {createWorkflowDraftStore} from './workflow-draft';
import type {Canvas} from '../comfy/canvas';
const canvas=(name:string):Canvas=>({name,nodes:[],links:[]});

test('rapid draft saves retain the last snapshot and reopening waits for it',async()=>{
 const base=memoryKv();let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});let calls=0;
 const kv:Kv={...base,set:async(key,value)=>{if(++calls===1)await hold;await base.set(key,value);}};
 const store=createWorkflowDraftStore(kv),first=canvas('first'),a=store.save('A',first),b=store.save('A',canvas('latest'));first.name='mutated';
 const opened=store.load('A');release();await Promise.all([a,b]);assert.equal((await opened)?.name,'latest');
});
test('separate draft keys never overwrite one another',async()=>{
 const store=createWorkflowDraftStore(memoryKv());await Promise.all([store.save('A',canvas('first')),store.save('B',canvas('second'))]);
 assert.equal((await store.load('A'))?.name,'first');assert.equal((await store.load('B'))?.name,'second');
});
test('a failed write blocks stale reload and a later retry can recover',async()=>{
 const base=memoryKv();let fail=true;const kv:Kv={...base,set:async(key,value)=>{if(fail){fail=false;throw Error('write failed');}await base.set(key,value);}};
 const store=createWorkflowDraftStore(kv);await assert.rejects(store.save('A',canvas('new')),/write failed/);await assert.rejects(store.load('A'),/write failed/);
 await store.save('A',canvas('new'));assert.equal((await store.load('A'))?.name,'new');
});
test('an invalid saved draft is not treated as a missing draft',async()=>{
 const kv=memoryKv();await kv.set('A',{name:'important',nodes:'invalid',links:[]});
 await assert.rejects(createWorkflowDraftStore(kv).load('A'),/invalid/);
 assert.deepEqual(await kv.get('A'),{name:'important',nodes:'invalid',links:[]});
});
