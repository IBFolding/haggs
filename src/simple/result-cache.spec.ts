import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryKv} from '../story/kv';
import {cachedAudio,rememberAudio} from './result-cache';
import type {StepRequest} from './plan';
const request:StepRequest={id:'voice-one',kind:'voice',prompt:'Leave a light burning.',voice:'Matilda (female, american)',seconds:5,ratio:'16:9',images:[]};
test('audio reuse binds exact text and voice and stays within owner and project',async()=>{
 const kv=memoryKv(),result={ok:true as const,url:'/api/local/owned-voice.mp3',kind:'audio' as const,usd:.02};await rememberAudio(kv,'A','P',request,result);
 assert.deepEqual(await cachedAudio(kv,'A','P',{...request,id:'different-step',seconds:9}),result);
 for(const [owner,project,r]of [['B','P',request],['A','Q',request],['A','P',{...request,prompt:'Different words'}],['A','P',{...request,voice:'Alice (female, british)'}]] as const)assert.equal(await cachedAudio(kv,owner,project,r as StepRequest),undefined);
});
test('effects bind duration and unpersisted media are never cached',async()=>{
 const kv=memoryKv(),r={...request,kind:'effect' as const,voice:undefined,prompt:'An old clock ticks.',seconds:2},result={ok:true as const,url:'/api/local/clock.mp3',kind:'audio' as const,usd:.02};await rememberAudio(kv,'A','P',r,result);assert.equal((await cachedAudio(kv,'A','P',r))?.url,result.url);assert.equal(await cachedAudio(kv,'A','P',{...r,seconds:3}),undefined);
 await rememberAudio(kv,'A','P',{...r,prompt:'New clock ticks.'},{...result,storageWarning:'Not persisted'});assert.equal(await cachedAudio(kv,'A','P',{...r,prompt:'New clock ticks.'}),undefined);
});
