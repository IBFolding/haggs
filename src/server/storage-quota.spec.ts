import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileHolds,uploadFolder} from './storage-quota';
test('stale holds are counted when their upload landed and released when it did not',async()=>{
 const finished:[string,string|null,number|undefined][]=[];let asked='';
 await reconcileHolds({
  pending:async before=>{asked=before;return ['landed','lost'];},
  found:async id=>id==='landed'?{url:'https://x.public.blob.vercel-storage.com/a.mp4',size:7}:null,
  finish:async(id,url,bytes)=>{finished.push([id,url,bytes]);},
 },Date.parse('2026-10-27T12:00:00Z'));
 assert.equal(asked,'2026-10-27T11:00:00.000Z');
 assert.deepEqual(finished,[['landed','https://x.public.blob.vercel-storage.com/a.mp4',7],['lost',null,undefined]]);
 assert.equal(uploadFolder('u1','r1'),'haggs/u-u1/uploads/r1/');
});
