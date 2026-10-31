import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownedComfyOrigin,checkOwnedComfy} from './comfy-owned-connection';
test('only an exact Comfy deployment origin may receive the customer key',()=>{
 assert.equal(ownedComfyOrigin('https://my-deployment.run.comfy.app/'),'https://my-deployment.run.comfy.app');
 for(const url of ['http://my-deployment.run.comfy.app','https://my-deployment.run.comfy.app.evil.test','https://evil.test','https://u:p@my-deployment.run.comfy.app','https://my-deployment.run.comfy.app/path','https://my-deployment.run.comfy.app:8443']) assert.throws(()=>ownedComfyOrigin(url));
});
test('connection check makes a single read-only request and never follows redirects',async()=>{
 let count=0;
 await checkOwnedComfy('https://my-deployment.run.comfy.app','key',async(input,init)=>{count++;assert.equal(String(input),'https://my-deployment.run.comfy.app/api/v2/jobs?limit=1');assert.equal(init?.method,undefined);assert.equal(init?.redirect,'error');return Response.json({jobs:[]});});
 assert.equal(count,1);
 await assert.rejects(checkOwnedComfy('https://evil.test','key',async()=>{throw Error('must not be called');}));
 await assert.rejects(checkOwnedComfy('https://my-deployment.run.comfy.app','key',async()=>new Response('',{status:403})),/did not accept/);
});
