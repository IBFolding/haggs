import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createPrivateRoomObjects,createRoomValidator} from './room-private-objects';
const owner='11111111-1111-4111-8111-111111111111',session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',path=`rooms/u-${owner}/${session}/recording.mp4`,bytes=new Uint8Array([1,2]),digest=createHash('sha256').update(bytes).digest('hex');
test('private objects reserve before upload and verify exact bytes before quota settlement',async()=>{
 let stored:Uint8Array|null=null,holds=0,writes=0,commits=0;const quota={reserve:async()=>{holds++;return holds===1?'created' as const:'existing' as const;},commit:async()=>{commits++;return true;}},blob={putOnce:async(_p:string,b:Uint8Array)=>{writes++;stored=b;},read:async()=>stored};const store=createPrivateRoomObjects(owner,session,blob,quota);
 await assert.rejects(store.putOnce('../bad',bytes),/Invalid/);await store.putOnce(path,bytes);await assert.rejects(store.putOnce(path,bytes),/Do not upload/);assert.equal(writes,1);
 assert.equal(await store.verify(path,2,'0'.repeat(64)),false);assert.equal(commits,0);assert.equal(await store.verify(path,2,digest),true);assert.equal(commits,1);
});
test('recording validation fails closed without an isolated sandbox',async()=>{await assert.rejects(createRoomValidator()(bytes),/not configured/);await assert.rejects(createRoomValidator({probe:async()=>({valid:true,video:true,duration:30})})(bytes),/Invalid/);await createRoomValidator({probe:async()=>({valid:true,video:true,duration:5})})(bytes);});
test('expired cleanup does not release quota when deletion is uncertain',async()=>{
 const {cleanupExpiredRoom}=await import('./room-private-objects');let finished=0,deletes=0;
 const ledger={claim:async()=>({path,bytes:2,sha256:digest,lease:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}),finish:async()=>{finished++;return true;}};
 await assert.rejects(cleanupExpiredRoom(owner,session,1000,ledger,{deleteIfMatch:async()=>{deletes++;return false;}}),/uncertain/);assert.equal(finished,0);
 assert.equal(await cleanupExpiredRoom(owner,session,1000,ledger,{deleteIfMatch:async()=>{deletes++;return true;}}),'deleted');assert.equal(finished,1);assert.equal(deletes,2);
});
