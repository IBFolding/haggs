import test from 'node:test';
import assert from 'node:assert/strict';
import {isGpuOutputUrl} from './gpu-output-url';
import {stageHosted} from './render-hosted';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const url='/api/gpu/output?endpoint='+ 'a'.repeat(32)+'&filename=take.mp4&subfolder=';
test('GPU result references stay relative and cannot name a foreign host',()=>{assert.ok(isGpuOutputUrl(url));for(const bad of ['https://evil.test'+url,url+'&token=secret','//evil.test'+url,url.replace('take.mp4','../take.mp4')])assert.equal(isGpuOutputUrl(bad),false);});
test('saved rented takes stage through the authenticated GPU reader and fail closed after disconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'haggs-gpu-media-')),cut={clips:[{shotId:'one',index:0,heading:'Fixture',url,kind:'video' as const,start:0,from:0,seconds:1}],total:1,voices:[],music:null,aspect:'16:9' as const,skipped:[]};
 let calls=0;try{
  const blocked=async()=>{throw Error('Must use the authenticated rented reader');};
  const staged=await stageHosted(cut,dir,blocked,{file:100,total:100},blocked,async source=>{assert.equal(source,url);calls++;return new Response('fixture-video',{headers:{'Content-Type':'video/mp4'}});});
  assert.equal(calls,1);assert.equal(staged.clips[0]!.url,'/api/local/media/m1.mp4');assert.equal(await readFile(join(dir,'media/m1.mp4'),'utf8'),'fixture-video');
  await assert.rejects(stageHosted(cut,dir,blocked,{file:100,total:100},blocked,async()=>new Response(null,{status:410})),/couldn't be fetched/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('downstream media reads use the authenticated rented reader and reject unavailable or active content',async()=>{
 const {readMedia,mediaAllowed}=await import('./media');assert.equal(mediaAllowed(url),true);
 const result=await readMedia(url,async source=>{assert.equal(source,url);return new Response('frame-source',{headers:{'Content-Type':'video/mp4'}});});assert.equal(result.mime,'video/mp4');assert.equal(Buffer.from(result.bytes).toString(),'frame-source');
 await assert.rejects(readMedia(url,async()=>new Response(null,{status:410})),/Reconnect/);
 await assert.rejects(readMedia(url,async()=>new Response('<script>',{headers:{'Content-Type':'text/html'}})),/Unsupported/);
});
