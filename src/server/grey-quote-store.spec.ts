import {test} from 'node:test';import assert from 'node:assert/strict';import {sharedGreyQuoteStore,type GreyQuoteRecord} from './grey-quote-store';
const record:GreyQuoteRecord={contextHash:'a'.repeat(64),credentialHash:'b'.repeat(64),policyHash:'c'.repeat(64),expiresAt:123,estimateUsd:.1};
test('shared quote adapter uses existing config and stores metadata only through protected RPCs',async()=>{
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const store=sharedGreyQuoteStore({NEXT_PUBLIC_SUPABASE_URL:'https://db.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test',HAGGS_WEBHOOK_SECRET:'test-secret'},()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='grey_quote_read'?record:true,error:null};}}));
 assert.equal(await store.put('id',record),true);assert.deepEqual(await store.get('id'),record);assert.equal(await store.claim('id',record),true);
 assert.deepEqual(calls.map(c=>c.name),['grey_quote_create','grey_quote_read','grey_quote_claim']);assert.equal(calls[0]!.args.secret,'test-secret');assert.equal(calls[0]!.args.credential_hash,record.credentialHash);
 assert.doesNotMatch(JSON.stringify(calls),/description|request|workspaceId|providerKey/);
});
test('missing config, RPC errors and malformed shared records fail closed without memory fallback',async()=>{
 let calls=0;const missing=sharedGreyQuoteStore({},()=>{calls++;throw Error('unexpected');});await assert.rejects(missing.get('id'));assert.equal(calls,0);
 const env={NEXT_PUBLIC_SUPABASE_URL:'url',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'key',HAGGS_WEBHOOK_SECRET:'secret'};
 const broken=sharedGreyQuoteStore(env,()=>({rpc:async()=>({data:null,error:{message:'private response'}})}));await assert.rejects(broken.claim('id',record),/unavailable/);
 const malformed=sharedGreyQuoteStore(env,()=>({rpc:async()=>({data:{},error:null})}));await assert.rejects(malformed.get('id'),/Invalid/);
});
