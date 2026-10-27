import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverWorkspaces } from './anthropic-workspaces';
const reply = (data: unknown) => new Response(JSON.stringify(data), {status:200});
test('discovery is GET-only, includes default, paginates and returns choices without selecting or saving', async () => {
 let calls=0;
 const result=await discoverWorkspaces('fixture-key', async(input, init)=>{
   calls++; const u=new URL(String(input));
   assert.equal(u.origin,'https://api.anthropic.com');assert.equal(u.pathname,'/v1/organizations/workspaces');
   assert.equal(u.searchParams.get('include_default'),'true');assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');assert.equal(init?.body,undefined);
   assert.equal(new Headers(init?.headers).get('anthropic-workspace-id'),null);
   if(calls===1)return reply({data:[{id:'wrkspc_Default',name:'Default',archived_at:null}],has_more:true,last_id:'wrkspc_Default'});
   assert.equal(u.searchParams.get('after_id'),'wrkspc_Default');
   return reply({data:[{id:'wrkspc_Other',name:'Other',archived_at:null},{id:'wrkspc_Old',name:'Old',archived_at:'2025-01-01'}],has_more:false});
 });
 assert.deepEqual(result,{ok:true,workspaces:[{id:'wrkspc_Default',name:'Default'},{id:'wrkspc_Other',name:'Other'}]});assert.equal(calls,2);
});
test('permission failures and provider bodies never expose secrets or trigger additional requests',async()=>{
 for(const status of [401,403,429,500]) {
  let calls=0;const r=await discoverWorkspaces('fixture-key',async()=>{calls++;return new Response('sensitive-provider-body',{status});});
  assert.equal(r.ok,false);assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('sensitive-provider-body'));
 }
});
test('empty lists, malformed pages and repeated cursors do not guess a default workspace',async()=>{
 assert.deepEqual(await discoverWorkspaces('fixture-key',async()=>reply({data:[],has_more:false})),{ok:true,workspaces:[]});
 for(const data of [{data:[],has_more:true,last_id:'bad'}, {data:[{id:'bad',name:'bad'}],has_more:false}])assert.equal((await discoverWorkspaces('fixture-key',async()=>reply(data))).ok,false);
 let calls=0;const r=await discoverWorkspaces('fixture-key',async()=>{calls++;return reply({data:[],has_more:true,last_id:'wrkspc_Repeated'});});assert.equal(r.ok,false);assert.equal(calls,2);
});
