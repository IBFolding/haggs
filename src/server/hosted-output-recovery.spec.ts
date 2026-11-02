import assert from "node:assert/strict";
import test from "node:test";
import {credentialFingerprint,outputDigest,recoverHostedOutput,saveHostedOutput,type HostedOutput,type HostedIO} from "./hosted-output-recovery";
const owner="11111111-1111-4111-8111-111111111111",id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",bytes=new TextEncoder().encode("synthetic");
function fixture(){
 const records=new Map<string,HostedOutput>([[id,{id,user_id:owner,scope:"platform",credential_hash:"fingerprint",output_node:"20",state:"ready",provider_job:"job-one",filename:"output.mp4",subfolder:"haggs",extension:"mp4",bytes:null,digest:null,reservation_id:null,url:null}]]),objects=new Map<string,Uint8Array>();let puts=0,reads=0,finishes=0,missing=false,lost=false,paused=false;
 const io:HostedIO={owner,credentialHash:"fingerprint",writes:()=>!paused,store:{get:async key=>{const value=records.get(key);return value?{...value}:null;},act:async(key,action,value={})=>{const row=records.get(key)!;if(action==='claim'){if(row.state!=='ready')return false;Object.assign(row,{state:'saving',bytes:value.bytes,digest:value.digest,reservation_id:value.reservation});return true;}if(action==='saved'){row.state='saved';row.url='/api/media/synthetic';return true;}if(action==='missing'){row.state='missing';return true;}if(action==='ready'){Object.assign(row,value,{state:'ready'});return true;}throw Error('unexpected action');}},inspect:async()=>missing?null:{filename:'output.mp4',subfolder:'haggs',extension:'mp4'},read:async()=>{reads++;return bytes;},reserve:async()=>"hold",release:async()=>{},verify:async(path,size,digest)=>{const value=objects.get(path);return Boolean(value&&value.length===size&&outputDigest(value)===digest);},put:async(path,data)=>{puts++;objects.set(path,data);if(lost)throw Error('response lost');},finish:async()=>{finishes++;}};
 return {io,records,objects,counts:()=>({puts,reads,finishes}),lost:()=>{lost=true;},missing:()=>{missing=true;},pause:()=>{paused=true;}};
}
test("owner and credential binding deny foreign/rotated platform jobs before any provider or storage work",async()=>{
 const f=fixture();f.io.owner='22222222-2222-4222-8222-222222222222';await assert.rejects(recoverHostedOutput(f.io,id),/not found/);f.io.owner=owner;f.io.credentialHash='rotated';await assert.rejects(recoverHostedOutput(f.io,id),/connection changed/);assert.deepEqual(f.counts(),{puts:0,reads:0,finishes:0});assert.notEqual(credentialFingerprint('key-a','fixture'),credentialFingerprint('key-b','fixture'));
});
test("lost private-save response reconciles exact bytes without a second upload or provider request, even when provider original is gone",async()=>{
 const f=fixture();f.lost();await assert.rejects(saveHostedOutput(f.io,id,bytes),/response lost/);f.missing();const url=await recoverHostedOutput(f.io,id);assert.match(url,/^\/api\/media\/haggs\/u-/);assert.deepEqual(f.counts(),{puts:1,reads:0,finishes:1});await recoverHostedOutput(f.io,id);assert.equal(f.counts().puts,1);
});
test("an uncertain absent object never permits a second write, and provider-deleted originals report no recoverable bytes",async()=>{
 const uncertain=fixture();uncertain.records.get(id)!.state='saving';Object.assign(uncertain.records.get(id)!,{bytes:bytes.length,digest:outputDigest(bytes),reservation_id:'hold'});await assert.rejects(recoverHostedOutput(uncertain.io,id),/uncertain/);assert.equal(uncertain.counts().puts,0);
 const missing=fixture();missing.missing();await assert.rejects(recoverHostedOutput(missing.io,id),/Metadata cannot recover deleted bytes/);assert.equal(missing.records.get(id)!.state,'missing');assert.equal(missing.counts().puts,0);assert.equal(missing.counts().reads,0);
});
test("atomic claims allow only one concurrent save and paused/canceled recovery never writes",async()=>{
 const f=fixture();const results=await Promise.allSettled([saveHostedOutput(f.io,id,bytes),saveHostedOutput(f.io,id,bytes)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(f.counts().puts,1);
 const paused=fixture();paused.pause();await assert.rejects(recoverHostedOutput(paused.io,id),/paused/);assert.equal(paused.counts().puts,0);
 const canceled=fixture();canceled.records.get(id)!.state='canceled';await assert.rejects(recoverHostedOutput(canceled.io,id),/deleted/);assert.equal(canceled.counts().puts,0);
});

test("accepted jobs return the discovered video or audio kind rather than stale null metadata",async()=>{
 const {recoveredOutputResult}=await import('./hosted-output-recovery');
 for(const [extension,kind] of [['mp4','video'],['webm','video'],['mp3','audio'],['wav','audio'],['flac','audio'],['png','image']] as const){
  const f=fixture(),row=f.records.get(id)!;Object.assign(row,{state:'accepted',filename:null,subfolder:null,extension:null});
  f.io.inspect=async()=>({filename:`output.${extension}`,subfolder:'haggs',extension});
  const url=await recoverHostedOutput(f.io,id);
  assert.deepEqual(recoveredOutputResult(f.records.get(id)!,url),{url,kind});assert.equal(f.counts().puts,1);
 }
});
