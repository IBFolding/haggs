import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from './route';
test('setup check is disabled by default and does not read the secret',async()=>{
 const before=process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW; delete process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW;
 try {const response=await POST(new Request('https://haggs.example/api/owned-comfy/check',{method:'POST',body:'not json'})); assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');}
 finally {if(before!==undefined)process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW=before;}
});
