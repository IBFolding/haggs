import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyManagedOutput,type ManagedOutput} from './managed-output-journal';
const bytes=new TextEncoder().encode('test output');
const user='11111111-1111-4111-8111-111111111111', submission='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reservation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const item:ManagedOutput={userId:user,submissionId:submission,reservationId:reservation,pathname:`haggs/u-${user}/uploads/${reservation}/managed-${submission}.mp4`,extension:'mp4',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),state:'reserved',url:null};
const host='example.public.blob.vercel-storage.com';
test('recover a stored output only after verifying its exact host, path, type, size and digest', async()=>{
  let calls=0;
  const fetcher:typeof fetch=async(input,init)=>{calls++;assert.equal(String(input),`https://${host}/${item.pathname}`);assert.equal(init?.redirect,'error');return new Response(bytes,{headers:{'content-type':'video/mp4'}});};
  assert.equal(await verifyManagedOutput(item,host,fetcher),`https://${host}/${item.pathname}`);
  await assert.rejects(verifyManagedOutput({...item,pathname:'other'},host,fetcher),/path/);
  await assert.rejects(verifyManagedOutput(item,'evil.example',fetcher),/not configured/);
  await assert.rejects(verifyManagedOutput({...item,sha256:'0'.repeat(64)},host,fetcher),/verification failed/);
  assert.equal(calls,2);
});
test('missing, mismatched and oversized outputs never authorize reupload',async()=>{
  await assert.rejects(verifyManagedOutput(item,host,async()=>new Response(null,{status:404})),/Do not upload/);
  await assert.rejects(verifyManagedOutput(item,host,async()=>new Response('not video',{headers:{'content-type':'text/html'}})),/type is invalid/);
  await assert.rejects(verifyManagedOutput(item,host,async()=>new Response(new Uint8Array(bytes.length+1))),/size is invalid/);
});
