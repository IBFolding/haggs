import {test} from 'node:test';import assert from 'node:assert/strict';
import {uploadOwnedInput} from './owned-input-upload';
test('uncertain uploads are not retried and stale assets stay unavailable',async()=>{
 let entry:any=null,uploads=0;let now=1000;
 const journal={read:async(u:string)=>entry?.userId===u?entry:null,begin:async(e:any)=>{if(entry)return false;entry=e;return true;},accept:async(_e:any,id:string)=>{entry={...entry,state:'ready',assetId:id};return true;}};
 const deps={journal,now:()=>now,probe:async()=>({sha256:'a'.repeat(64),bytes:12}),upload:async()=>{uploads++;throw Error('connection lost');}};
 const args=['alice','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1/file','video/mp4',new Uint8Array(12)] as const;
 await assert.rejects(uploadOwnedInput(...args,deps),/uncertain/);await assert.rejects(uploadOwnedInput(...args,deps),/uncertain/);assert.equal(uploads,1);
 await assert.rejects(uploadOwnedInput('bob',args[1],args[2],args[3],args[4],deps),/already exists/);
 entry={...entry,state:'ready',assetId:'valid'};assert.equal((await uploadOwnedInput(...args,deps)).info.id,'valid');
 now+=24*60*60*1000;await assert.rejects(uploadOwnedInput(...args,deps),/expired/);assert.equal(uploads,1);
});
