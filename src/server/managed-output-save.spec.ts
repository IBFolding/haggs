import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {saveManagedOutput} from './managed-output-save';
import type {ManagedOutput} from './managed-output-journal';

const args={userId:'00000000-0000-0000-0000-000000000001',submissionId:'00000000-0000-0000-0000-000000000002',extension:'png',bytes:new Uint8Array([1,2,3]),allowance:100,existingFiles:[]};
test('an uncertain upload is recovered without uploading twice',async()=>{
  let saved:ManagedOutput|null=null, uploads=0, stored=false;
  const journal={read:async()=>saved,claim:async(item:ManagedOutput)=>{saved=item;return 'created' as const;},verifyAndCommit:async()=>{if(!stored)throw Error('missing');return 'saved';}};
  await assert.rejects(saveManagedOutput(args,journal,async()=>{uploads++;stored=true;throw Error('connection lost');}),/may have succeeded/);
  assert.equal(await saveManagedOutput(args,journal,async()=>{uploads++;}),'saved');
  assert.equal(uploads,1);
});
test('a concurrent loser never uploads its own object',async()=>{
  let reads=0, uploads=0;
  const winner={...args,bytes:args.bytes.byteLength,reservationId:'00000000-0000-0000-0000-000000000003',pathname:'winner',sha256:createHash('sha256').update(args.bytes).digest('hex'),state:'reserved' as const,url:null};
  const journal={read:async()=>++reads===1?null:winner,claim:async()=> 'existing' as const,verifyAndCommit:async(item:ManagedOutput)=>{assert.equal(item.pathname,'winner');return 'saved';}};
  assert.equal(await saveManagedOutput(args,journal,async()=>{uploads++;}),'saved');
  assert.equal(uploads,0);
});
