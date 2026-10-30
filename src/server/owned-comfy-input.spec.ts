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
 await assert.rejects(probeOwnedInput('1/file','video/mp4',Buffer.from('0000ftypisom0000')),/could not be verified/);
});
