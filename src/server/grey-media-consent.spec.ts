import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGreyMediaConsent} from './grey-media-consent';
import {memoryGreyQuoteStore} from './grey-quote-store';
const input={frame:'https://example.test/frame.jpg',beat:'A person walks',grey:{subjects:[]}};
test('media consent is bound to kind, exact frame/scene, identity and price',async()=>{
 let identity='account-one',price=.2,enabled=true;const store=memoryGreyQuoteStore();
 const g=createGreyMediaConsent({store,identity:async()=>identity,policy:()=>({enabled,estimateUsd:price})});
 const q=await g.quote('video',input);assert.ok(q.ok);const approval={quoteId:q.id,consent:true as const,approvedFirstFrame:true};
 assert.equal((await g.consume('video',input)).ok,false);
 assert.equal((await g.consume('video',input,{...approval,approvedFirstFrame:false})).ok,false);
 assert.equal((await g.consume('still',input,approval)).ok,false);
 assert.equal((await g.consume('video',{...input,frame:'changed'},approval)).ok,false);
 identity='account-two';assert.equal((await g.consume('video',input,approval)).ok,false);identity='account-one';
 price=.3;assert.equal((await g.consume('video',input,approval)).ok,false);price=.2;
 enabled=false;assert.equal((await g.consume('video',input,approval)).ok,false);enabled=true;
 assert.equal((await g.consume('video',input,approval)).ok,true);
 assert.equal((await g.consume('video',input,approval)).ok,false);
});
test('separate workers allow only one media submission and expired quotes fail',async()=>{
 let now=1000;const store=memoryGreyQuoteStore(()=>now),deps={store,identity:async()=>({account:'one'}),policy:()=>({enabled:true,estimateUsd:.2}),now:()=>now};
 const a=createGreyMediaConsent(deps),b=createGreyMediaConsent(deps);const q=await a.quote('still',input);assert.ok(q.ok);
 const approvals=await Promise.all([a.consume('still',input,{quoteId:q.id,consent:true}),b.consume('still',input,{quoteId:q.id,consent:true})]);assert.equal(approvals.filter(x=>x.ok).length,1);
 const expired=await a.quote('still',input);assert.ok(expired.ok);now=expired.expiresAt;assert.equal((await b.consume('still',input,{quoteId:expired.id,consent:true})).ok,false);
});
test('uncertain claims, missing identity and invalid pricing fail closed',async()=>{
 const store=memoryGreyQuoteStore();let identity:unknown=undefined,price=.2;
 const deps={store,identity:async()=>identity,policy:()=>({enabled:true,estimateUsd:price})};const g=createGreyMediaConsent(deps);
 assert.equal((await g.quote('still',input)).ok,false);identity='one';price=NaN;assert.equal((await g.quote('still',input)).ok,false);price=.2;
 const q=await g.quote('still',input);assert.ok(q.ok);
 const broken=createGreyMediaConsent({...deps,store:{...store,claim:async(id,row)=>{await store.claim(id,row);throw Error('secret diagnostic');}}});
 const r=await broken.consume('still',input,{quoteId:q.id,consent:true});assert.equal(r.ok,false);assert.doesNotMatch(JSON.stringify(r),/secret diagnostic/);
 assert.equal((await g.consume('still',input,{quoteId:q.id,consent:true})).ok,false);
});
test('relight and make-it-real quotes bind the exact clip, kind and length-based price',async()=>{
 const clip={video:'https://example.test/draft.mp4',seconds:4,prompt:'Match the light'};
 const priceFor=(_k:string,i?:unknown)=>({enabled:true,estimateUsd:.05*Number((i as {seconds?:number}|undefined)?.seconds??0)});
 const g=createGreyMediaConsent({store:memoryGreyQuoteStore(),identity:async()=>'account-one',policy:priceFor});
 const q=await g.quote('relight',clip);assert.ok(q.ok);assert.equal(q.estimateUsd,.2);const approval={quoteId:q.id,consent:true as const};
 assert.equal((await g.consume('real',clip,approval)).ok,false);
 assert.equal((await g.consume('relight',{...clip,seconds:8},approval)).ok,false);
 assert.equal((await g.consume('relight',{...clip,video:'https://example.test/other.mp4'},approval)).ok,false);
 assert.equal((await g.consume('relight',clip)).ok,false);
 assert.equal((await g.consume('relight',clip,approval)).ok,true);
 assert.equal((await g.consume('relight',clip,approval)).ok,false);
 const none=await g.quote('real',{...clip,seconds:0});assert.equal(none.ok,false);
});
