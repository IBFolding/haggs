import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOwnedInput} from './owned-comfy-input';
test('checks size, field type and magic bytes before any upload',()=>{
 const mp4=Buffer.from('0000ftypisom0000'),wav=Buffer.from('RIFF0000WAVE0000');
 assert.equal(validateOwnedInput('1/file','video/mp4',mp4).bytes,16);
 assert.equal(validateOwnedInput('10002/audio','audio/wav',wav).bytes,16);
 assert.throws(()=>validateOwnedInput('10002/audio','audio/wav',mp4),/media type/);
 assert.throws(()=>validateOwnedInput('1/file','audio/wav',wav),/media type/);
 assert.throws(()=>validateOwnedInput('bad','video/mp4',mp4),/Unknown/);
 assert.throws(()=>validateOwnedInput('1/file','video/mp4',new Uint8Array(2)),/size/);
});

test('a file with a plausible header but invalid media fails the bounded probe',async()=>{
 const {probeOwnedInput}=await import('./owned-comfy-input');
 await assert.rejects(probeOwnedInput('1/file','video/mp4',Buffer.from('0000ftypisom0000'),{localTest:true}),/could not be verified/);
});


test('valid generated WAV and MP4 are probed in local test mode only',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const {probeOwnedInput}=await import('./owned-comfy-input');const dir=await mkdtemp(join(tmpdir(),'haggs-probe-test-'));
 try{
  const wav=join(dir,'test.wav'),mp4=join(dir,'test.mp4');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y',wav],{timeout:15000});
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=64x64:d=1','-c:v','mpeg4','-y',mp4],{timeout:15000});
  const audio=await readFile(wav),video=await readFile(mp4);
  assert.equal((await probeOwnedInput('10002/audio','audio/wav',audio,{localTest:true})).bytes,audio.length);
  assert.equal((await probeOwnedInput('1/file','video/mp4',video,{localTest:true})).bytes,video.length);
  await assert.rejects(probeOwnedInput('1/file','video/mp4',video),/not configured/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
