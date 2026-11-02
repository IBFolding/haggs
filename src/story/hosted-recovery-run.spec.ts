import assert from 'node:assert/strict';
import test from 'node:test';
import {memoryKv} from './kv';
import {createRunStore} from './runs';
import {recordHostedRecovery} from './hosted-recovery-run';
test('server media kind records accepted outputs and repairs old image entries without duplicates',async()=>{
 for(const kind of ['video','audio'] as const){
  const runs=createRunStore(memoryKv()),item={id:'journal-one',filename:null,provider_job:'accepted-job',extension:null};
  const old=await runs.record({modelId:'hosted-recovered',modelName:'Recovered output',prompt:'preserve me',settings:{},url:'/old',kind:'image',usd:null,comfyJob:'hosted:journal-one'});
  await runs.setFavorite(old.id,true);
  await recordHostedRecovery(runs,item,{url:'/confirmed',kind});
  await recordHostedRecovery(runs,item,{url:'/confirmed',kind});
  const rows=await runs.list();assert.equal(rows.length,1);assert.equal(rows[0]!.id,old.id);assert.equal(rows[0]!.kind,kind);assert.equal(rows[0]!.url,'/confirmed');assert.equal(rows[0]!.favorite,true);assert.equal(rows[0]!.prompt,'preserve me');
  const fresh=createRunStore(memoryKv());await recordHostedRecovery(fresh,item,{url:'/confirmed',kind});assert.equal((await fresh.list())[0]!.kind,kind);
 }
 const runs=createRunStore(memoryKv());await assert.rejects(recordHostedRecovery(runs,{id:'one',filename:null,provider_job:null},{url:'/confirmed',kind:undefined}),/metadata is missing/);assert.equal((await runs.list()).length,0);
});
