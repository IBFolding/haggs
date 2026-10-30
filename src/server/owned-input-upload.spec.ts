import {test} from 'node:test';import assert from 'node:assert/strict';
import {uploadOwnedInput} from './owned-input-upload';
test('uncertain uploads are not retried and stale assets stay unavailable',async()=>{
 let entry:any=null,uploads=0;let now=1000;
 const journal={read:async(u:string)=>entry?.userId===u?entry:null,begin:async(e:any)=>{if(entry)return false;entry=e;return true;},accept:async(_e:any,id:string)=>{entry={...entry,state:'ready',assetId:id};return true;}};
 const deps={deployment:'https://example.run.comfy.app',journal,now:()=>now,probe:async()=>({sha256:'a'.repeat(64),bytes:12}),upload:async()=>{uploads++;throw Error('connection lost');}};
 const args=['alice','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1/file','video/mp4',new Uint8Array(12)] as const;
 await assert.rejects(uploadOwnedInput(...args,deps),/uncertain/);await assert.rejects(uploadOwnedInput(...args,deps),/uncertain/);assert.equal(uploads,1);
 await assert.rejects(uploadOwnedInput('bob',args[1],args[2],args[3],args[4],deps),/already exists/);
 entry={...entry,state:'ready',assetId:'valid'};assert.equal((await uploadOwnedInput(...args,deps)).info.id,'valid');
 now+=24*60*60*1000;await assert.rejects(uploadOwnedInput(...args,deps),/expired/);assert.equal(uploads,1);
});

test('portal inputs must belong to the owner and job and be ready and unexpired',async()=>{
 const {resolveOwnedPortalInputs}=await import('./owned-input-upload');
 const ref='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',fields=['1/file','10001/file','10002/audio'];
 const entries=fields.map((field,i)=>({userId:'alice',submissionId:ref,deployment:'https://example.run.comfy.app',field,mime:i===2?'audio/wav':'video/mp4',sha256:'a'.repeat(64),size:12,state:'ready' as const,assetId:`asset${i}`,expiresAt:2000}));
 const journal={read:async(_u:string,_r:string,f:string)=>entries.find(e=>e.field===f)??null,begin:async()=>false,accept:async()=>false};
 assert.equal((await resolveOwnedPortalInputs('alice',ref,'https://example.run.comfy.app',journal,1000))['1/file']?.info.id,'asset0');
 await assert.rejects(resolveOwnedPortalInputs('bob',ref,'https://example.run.comfy.app',journal,1000),/unavailable/);
 await assert.rejects(resolveOwnedPortalInputs('alice',ref,'https://example.run.comfy.app',journal,2000),/expired/);
 await assert.rejects(resolveOwnedPortalInputs('alice',ref,'https://other.run.comfy.app',journal,1000),/unavailable/);
 entries[0]!.assetId='../wrong';await assert.rejects(resolveOwnedPortalInputs('alice',ref,'https://example.run.comfy.app',journal,1000),/unavailable/);
});

test('concurrent duplicate input uploads call the provider once',async()=>{
 let row:import('./owned-input-upload').Entry|null=null,uploads=0;
 const journal={read:async()=>row,begin:async(e:import('./owned-input-upload').Entry)=>{if(row)return false;row=e;return true;},accept:async(e:import('./owned-input-upload').Entry,id:string)=>{row={...e,state:'ready',assetId:id};return true;}};
 const deps={deployment:'https://example.run.comfy.app',journal,probe:async()=>({sha256:'b'.repeat(64),bytes:12}),upload:async()=>{uploads++;await new Promise(r=>setTimeout(r,10));return {__type:'core/ASSET' as const,info:{id:'fixture'}};}};
 const args=['alice','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1/file','video/mp4',new Uint8Array(12)] as const;
 const outcomes=await Promise.allSettled([uploadOwnedInput(...args,deps),uploadOwnedInput(...args,deps)]);
 assert.equal(uploads,1);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
});
