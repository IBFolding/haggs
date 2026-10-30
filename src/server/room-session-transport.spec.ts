import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createRoomTransport,type RoomSession,type RoomStore} from './room-session-transport';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',deployment='https://example.run.comfy.app';
test('two workers share claims and recover uncertain recording without duplication',async()=>{
 const rows=new Map<string,RoomSession>(),objects=new Map<string,Uint8Array>();let uploads=0,clock=1000,lost=true;
 const store:RoomStore={create:async row=>{if(rows.has(row.id))return false;rows.set(row.id,row);return true;},read:async(u,id)=>{const row=rows.get(id);return row?.owner===u?row:null;},claim:async(u,id,r,now)=>{const row=rows.get(id);if(!row||row.owner!==u||row.state!=='open'||row.expiresAt<=now)return false;rows.set(id,{...row,state:'uploading',recording:r});return true;},commit:async(u,id,r,now)=>{const row=rows.get(id);if(!row||row.owner!==u||row.state!=='uploading'||row.expiresAt<=now||JSON.stringify(row.recording)!==JSON.stringify(r))return false;rows.set(id,{...row,state:'recorded'});return true;}};
 const objectStore={putOnce:async(path:string,bytes:Uint8Array)=>{uploads++;if(objects.has(path))throw Error('exists');objects.set(path,bytes);if(lost){lost=false;throw Error('response lost');}},verify:async(path:string,size:number,hash:string)=>{const b=objects.get(path);return !!b&&b.length===size&&createHash('sha256').update(b).digest('hex')===hash;}};
 const a=createRoomTransport(store,objectStore,async()=>{},()=>clock),b=createRoomTransport(store,objectStore,async()=>{},()=>clock),id=await a.create(owner,deployment),bytes=new Uint8Array([1,2]);
 const attempts=await Promise.allSettled([a.record(owner,id,deployment,bytes),b.record(owner,id,deployment,bytes)]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,0);assert.equal(uploads,1);
 await assert.rejects(b.recover(other,id,deployment),/not found/);await assert.rejects(b.recover(owner,id,'https://other.run.comfy.app'),/not found/);
 assert.deepEqual(await b.recover(owner,id,deployment),{state:'recorded'});assert.deepEqual(await a.recover(owner,id,deployment),{state:'recorded'});assert.equal(uploads,1);
 clock+=24*60*60*1000;await assert.rejects(a.status(owner,id,deployment),/expired/);
});
