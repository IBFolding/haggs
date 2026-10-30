import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {ownedUploadRequest} from './owned-upload-request';import {probeOwnedInput} from './owned-comfy-input';import type {Entry} from './owned-input-upload';
test('upload route core verifies valid media, deduplicates and isolates owners',async()=>{
 let row:Entry|null=null,calls=0;const journal={read:async(u:string)=>row?.userId===u?row:null,begin:async(e:Entry)=>{if(row)return false;row=e;return true;},accept:async(e:Entry,id:string)=>{row={...e,state:'ready',assetId:id};return true;}};
 const deps={authenticate:async(r:Request)=>r.headers.get('x-test-user'),journal,probe:(f:string,m:string,b:Uint8Array)=>probeOwnedInput(f,m,b,{localTest:true}),upload:async()=>{calls++;return {__type:'core/ASSET' as const,info:{id:'asset1'}};}};
 const ref='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',origin='https://example.run.comfy.app';
 const bytes=await readFile('public/workflows/contest-lab/input/haggs/source.mp4');
 const req=(user:string|null,data:Uint8Array)=>{const form=new FormData();form.set('reference',ref);form.set('field','1/file');form.set('file',new File([Buffer.from(data)],'sample.mp4',{type:'video/mp4'}));return new Request('http://test',{method:'POST',headers:user?{'x-test-user':user}:{},body:form});};
 assert.equal((await ownedUploadRequest(req(null,bytes),origin,deps)).status,401);
 assert.equal((await ownedUploadRequest(req('alice',bytes),origin,deps)).status,200);
 assert.equal((await ownedUploadRequest(req('alice',bytes),origin,deps)).status,200);
 assert.equal((await ownedUploadRequest(req('bob',bytes),origin,deps)).status,503);
 assert.equal((await ownedUploadRequest(req('alice',new Uint8Array([1,2,3])),origin,deps)).status,503);
 assert.equal(calls,1);
});
