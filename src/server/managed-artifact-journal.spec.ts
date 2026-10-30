import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {verifyArtifact} from './managed-artifact-journal';import type {Artifact} from './managed-artifact-save';
const user='11111111-1111-4111-8111-111111111111',ref='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reservation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',bytes=new Uint8Array([1,2]);
const item:Artifact={userId:user,submissionId:ref,role:'atlas',reservationId:reservation,pathname:`haggs/u-${user}/uploads/${reservation}/managed-${ref}-atlas.png`,extension:'png',bytes:2,sha256:createHash('sha256').update(bytes).digest('hex'),state:'reserved',url:null};
test('artifact verification requires exact host, path, type and digest',async()=>{
 const host='abc.public.blob.vercel-storage.com';assert.match(await verifyArtifact(item,host,async()=>new Response(bytes,{headers:{'content-type':'image/png'}})),/atlas.png$/);
 await assert.rejects(verifyArtifact(item,'evil.test',async()=>new Response(bytes)),/Invalid/);
 await assert.rejects(verifyArtifact({...item,pathname:'wrong'},host,async()=>new Response(bytes)),/path/);
 await assert.rejects(verifyArtifact({...item,sha256:'0'.repeat(64)},host,async()=>new Response(bytes)),/verification/);
 await assert.rejects(verifyArtifact(item,host,async()=>new Response(null,{status:404})),/Do not upload/);
});
