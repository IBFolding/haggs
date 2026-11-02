import { test } from "node:test";
import assert from "node:assert/strict";
import { createGreyProposalGateway as makeGateway, type ProposalPolicy } from "./grey-proposal-gateway";
import { proposalContext } from "../story/grey-proposal-context";
import { defaultGrey } from "../story/grey";
import { askClaude } from "../writer/draft";
import { memoryGreyQuoteStore, type GreyQuoteStore } from "./grey-quote-store";
const createGreyProposalGateway=(deps:Omit<Parameters<typeof makeGateway>[0],"store">&{store?:GreyQuoteStore})=>makeGateway({...deps,store:deps.store??memoryGreyQuoteStore(deps.now)});
const proposal={version:1 as const,summary:"Kitchen",room:{floor:"wood" as const,wall:"plaster" as const},people:[],props:[],camera:defaultGrey().cam,light:defaultGrey().light};
const context=()=>proposalContext({description:"A quiet kitchen",references:[{id:"r",name:"Kitchen",url:"https://private.example/secret"}],grey:defaultGrey(),scene:{}});
const enabled:ProposalPolicy={enabled:true,model:"test-model",inputUsdPerMillion:3,outputUsdPerMillion:15};
test("disabled rollout, missing pricing, invalid input and missing credentials never call provider",async()=>{
 let reads=0,sends=0,p={...enabled,enabled:false};
 const gateway=createGreyProposalGateway({policy:()=>p,credentials:async()=>{reads++;return undefined;},send:async()=>{sends++;throw Error("should not run");}});
 assert.equal((await gateway.quote(context())).ok,false);assert.equal(reads,0);
 p={...enabled,inputUsdPerMillion:0};assert.equal((await gateway.quote(context())).ok,false);assert.equal(reads,0);
 p=enabled;assert.equal((await gateway.quote({...context(),description:""})).ok,false);assert.equal(reads,0);
 assert.equal((await gateway.quote({...context(),references:[{name:"Private",url:"https://private.example"}]})).ok,false);assert.equal(reads,0);
 const missing=await gateway.quote(context());assert.ok(!missing.ok&&missing.needsKey);assert.equal(sends,0);
});
test("quote contains estimate only; consent, input, credentials and pricing must still match",async()=>{
 let p=enabled,key="fake-one",sends=0;
 const gateway=createGreyProposalGateway({policy:()=>p,credentials:async()=>({key}),send:async()=>{sends++;return {ok:true,draft:proposal,usage:{input:1,output:1}};}});
 const quote=await gateway.quote(context());assert.ok(quote.ok);assert.ok(quote.estimateUsd>0);assert.equal(sends,0);assert.doesNotMatch(JSON.stringify(quote),/fake-one|quiet kitchen|private.example/);
 assert.equal((await gateway.generate(context(),quote.id,false)).ok,false);
 assert.equal((await gateway.generate({...context(),description:"Changed"},quote.id,true)).ok,false);
 key="fake-two";assert.equal((await gateway.generate(context(),quote.id,true)).ok,false);key="fake-one";
 p={...enabled,outputUsdPerMillion:20};assert.equal((await gateway.generate(context(),quote.id,true)).ok,false);p=enabled;
 assert.equal(sends,0);const result=await gateway.generate(context(),quote.id,true);assert.deepEqual(result,{ok:true,proposal});assert.equal(sends,1);
 assert.equal((await gateway.generate(context(),quote.id,true)).ok,false);assert.equal(sends,1);
});
test("expiry, worker restart and concurrent submissions fail closed without automatic retries",async()=>{
 let clock=100,sends=0;const deps={policy:()=>enabled,now:()=>clock,credentials:async()=>({key:"fake"}),send:async()=>{sends++;return {ok:true as const,draft:proposal,usage:{input:1,output:1}};}};
 const gateway=createGreyProposalGateway(deps);const old=await gateway.quote(context());assert.ok(old.ok);clock=old.expiresAt;
 assert.equal((await gateway.generate(context(),old.id,true)).ok,false);
 const quote=await gateway.quote(context());assert.ok(quote.ok);assert.equal((await createGreyProposalGateway(deps).generate(context(),quote.id,true)).ok,false);
 const results=await Promise.all([gateway.generate(context(),quote.id,true),gateway.generate(context(),quote.id,true)]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(sends,1);
});
test("real authenticated writer transport with mocked fetch sends one bounded schema request and no private image URL",async()=>{
 let calls=0;const gateway=createGreyProposalGateway({policy:()=>enabled,credentials:async()=>({key:"sk-fake",workspaceId:"wrkspc_fake"}),send:(credentials,request,schema)=>askClaude({...credentials,request,schema,read:value=>value as typeof proposal,fetch:(async(_url,init)=>{
  calls++;const headers=init?.headers as Record<string,string>;assert.equal(headers["x-api-key"],"sk-fake");assert.equal(headers["anthropic-workspace-id"],"wrkspc_fake");
  const body=JSON.parse(String(init?.body));assert.equal(body.max_tokens,2500);assert.ok(body.output_config.format.schema);assert.doesNotMatch(String(init?.body),/private.example|secret/);
  return new Response(JSON.stringify({stop_reason:"end_turn",content:[{type:"text",text:JSON.stringify(proposal)}],usage:{input_tokens:40,output_tokens:50}}));
 }) as typeof fetch})});
 const quote=await gateway.quote(context());assert.ok(quote.ok);assert.equal(calls,0);const result=await gateway.generate(context(),quote.id,true);assert.ok(result.ok);assert.equal(calls,1);
});
test("provider failures and malformed output cannot expose secrets or be retried with the same quote",async()=>{
 for(const mode of ["throw","failure","invalid"]){let calls=0;
 const gateway=createGreyProposalGateway({policy:()=>enabled,credentials:async()=>({key:"secret-key"}),send:async()=>{calls++;if(mode==="throw")throw Error("secret-key request body");if(mode==="failure")return {ok:false,reason:"secret-key provider body"};return {ok:true,draft:{} as typeof proposal,usage:{input:0,output:0}};}});
 const quote=await gateway.quote(context());assert.ok(quote.ok);const result=await gateway.generate(context(),quote.id,true);assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/secret-key|request body|provider body/);
 assert.equal((await gateway.generate(context(),quote.id,true)).ok,false);assert.equal(calls,1);
 }
});
test("shared store lets another worker submit exactly once, and a restarted worker cannot replay it",async()=>{
 const {memoryGreyQuoteStore}=await import('./grey-quote-store');const store=memoryGreyQuoteStore();let sends=0;
 const deps={store,policy:()=>enabled,credentials:async()=>({key:"fake-shared"}),send:async()=>{sends++;return {ok:true as const,draft:proposal,usage:{input:1,output:1}};}};
 const first=createGreyProposalGateway(deps),second=createGreyProposalGateway(deps);const q=await first.quote(context());assert.ok(q.ok);
 const results=await Promise.all([first.generate(context(),q.id,true),second.generate(context(),q.id,true)]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(sends,1);
 assert.equal((await createGreyProposalGateway(deps).generate(context(),q.id,true)).ok,false);assert.equal(sends,1);
});
test("shared-store errors including an uncertain claim never invoke the provider",async()=>{
 const {memoryGreyQuoteStore}=await import('./grey-quote-store');const store=memoryGreyQuoteStore();let sends=0;
 const base={store,policy:()=>enabled,credentials:async()=>({key:"fake"}),send:async()=>{sends++;return {ok:true as const,draft:proposal,usage:{input:1,output:1}};}};
 const q=await createGreyProposalGateway(base).quote(context());assert.ok(q.ok);
 const broken=createGreyProposalGateway({...base,store:{...store,claim:async(id,row)=>{await store.claim(id,row);throw Error("connection lost after commit");}}});
 assert.equal((await broken.generate(context(),q.id,true)).ok,false);assert.equal(sends,0);
 assert.equal((await createGreyProposalGateway(base).generate(context(),q.id,true)).ok,false);assert.equal(sends,0);
});


test("quoted automatic proposals retain validated camera motion and reject invalid key ordering",async()=>{
 let draft={...proposal,cameraPath:[{t:0,...proposal.camera},{t:6,...proposal.camera,angle:90}]};
 const gateway=createGreyProposalGateway({policy:()=>enabled,credentials:async()=>({key:"mock-only"}),send:async()=>({ok:true,draft,usage:{input:1,output:1}})});
 const quote=await gateway.quote(context());assert.ok(quote.ok);
 const result=await gateway.generate(context(),quote.id,true);assert.deepEqual(result,{ok:true,proposal:draft});
 draft={...draft,cameraPath:[...draft.cameraPath].reverse()};
 const invalid=await gateway.quote(context());assert.ok(invalid.ok);
 assert.equal((await gateway.generate(context(),invalid.id,true)).ok,false);
});
