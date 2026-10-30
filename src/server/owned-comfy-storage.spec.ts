import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveOwnedComfyOutput} from './owned-comfy-storage';
test('real storage is disabled by default before authentication or upload',async()=>{
 const previous=process.env.HAGGS_OWN_COMFY_STORAGE_PREVIEW;delete process.env.HAGGS_OWN_COMFY_STORAGE_PREVIEW;
 try {await assert.rejects(saveOwnedComfyOutput('fake','fake',new Uint8Array([1]),'png'),/not enabled/);}
 finally {if(previous!==undefined)process.env.HAGGS_OWN_COMFY_STORAGE_PREVIEW=previous;}
});
