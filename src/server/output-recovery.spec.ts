import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {rememberOutput,recoverOutput,type RecoveryStore,type RecoveryRecord} from "./output-recovery";
test("durable restart recovers by provider file identity after preview expiry without generation or duplicate saves",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"haggs-output-recovery-")),path=join(dir,'journal.json');
 function reopen():RecoveryStore{return {claim:async(id,owner)=>{const held=JSON.parse(await readFile(path,'utf8')) as Record<string,RecoveryRecord>;const record=held[id];if(!record||record.ref.owner!==owner||record.state!=="pending")return false;held[id]={...record,state:"saving"};await writeFile(path,JSON.stringify(held));return true;},load:async id=>{try{return (JSON.parse(await readFile(path,'utf8')) as Record<string,RecoveryRecord>)[id]??null;}catch{return null;}},save:async(id,record)=>{let held={};try{held=JSON.parse(await readFile(path,'utf8'));}catch{}await writeFile(path,JSON.stringify({...held,[id]:record}));}};}
 try{
  const owner="11111111-1111-4111-8111-111111111111",ref={owner,job:"job-one",filename:"output.mp4",subfolder:"haggs",extension:"mp4"},id=await rememberOutput(reopen(),ref);let saves=0,reads=0;
  const io={read:async(r:typeof ref)=>{assert.deepEqual(r,ref);reads++;return new TextEncoder().encode("synthetic");},keep:async()=>{saves++;throw Error("response lost");},findSaved:async()=>null as string|null};
  await assert.rejects(recoverOutput(reopen(),id,"22222222-2222-4222-8222-222222222222",io),/not found/);assert.equal(reads,0);
  await assert.rejects(recoverOutput(reopen(),id,owner,io),/response lost/);
  await assert.rejects(recoverOutput(reopen(),id,owner,io),/uncertain/);assert.equal(saves,1);
  io.findSaved=async()=>"/api/media/synthetic.mp4";
  assert.equal(await recoverOutput(reopen(),id,owner,io),"/api/media/synthetic.mp4");
  assert.equal(await recoverOutput(reopen(),id,owner,io),"/api/media/synthetic.mp4");assert.equal(reads,1);assert.equal(saves,1);
  assert.ok(!/https:|token|apiKey/.test(await readFile(path,'utf8')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
