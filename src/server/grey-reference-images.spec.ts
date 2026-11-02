import {test} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {prepareGreyReferenceImages} from "./grey-reference-images";
import {createGreyProposalGateway,type ProposalPolicy} from "./grey-proposal-gateway";
import {memoryGreyQuoteStore} from "./grey-quote-store";
import {proposalContext} from "../story/grey-proposal-context";
import {defaultGrey} from "../story/grey";
import {askClaude} from "../writer/draft";
import {MAX_REFERENCE_BYTES,type ReferenceImage} from "../writer/image-input";
import {CLAUDE_COOKIE,CLAUDE_WORKSPACE_COOKIE,keyIn,claudeWorkspaceIn} from "./keys";
const image=async(color="red"):Promise<ReferenceImage>=>({name:"Chosen room",mediaType:"image/png",data:(await sharp({create:{width:1000,height:600,channels:3,background:color}}).png().toBuffer()).toString("base64")});
const context=()=>proposalContext({description:"Stage this room",references:[{id:"private",name:"Reference name",url:"https://private.invalid/original"}],grey:defaultGrey(),scene:{}});
const proposal={version:1 as const,summary:"Room",room:{floor:"wood" as const,wall:"plaster" as const},people:[],props:[],camera:defaultGrey().cam,light:defaultGrey().light};
const enabled:ProposalPolicy={enabled:true,visionEnabled:true,model:"mock",inputUsdPerMillion:3,outputUsdPerMillion:15};
test("Grey Room reuses the writer's saved Claude connection and rejects changed connection quotes",async()=>{
 const saved=new Map([[CLAUDE_COOKIE,"existing-test-key"],[CLAUDE_WORKSPACE_COOKIE,"wrkspc_existing"]]);
 const jar={get:(name:string)=>saved.has(name)?{value:saved.get(name)!}:undefined} as Parameters<typeof keyIn>[0];
 let sends=0;
 const gateway=createGreyProposalGateway({store:memoryGreyQuoteStore(),policy:()=>enabled,
  credentials:async()=>{const key=keyIn(jar,CLAUDE_COOKIE);return key?{key,workspaceId:claudeWorkspaceIn(jar)}:undefined;},
  send:async credentials=>{sends++;assert.equal(credentials.key,"existing-test-key");assert.equal(credentials.workspaceId,"wrkspc_existing");return {ok:true,draft:proposal,usage:{input:1,output:1}};},
 });
 const ctx={...context(),images:[await image()]},quote=await gateway.quote(ctx);assert.ok(quote.ok);assert.equal(sends,0);
 assert.doesNotMatch(JSON.stringify(quote),/existing-test-key|wrkspc_existing/);
 saved.set(CLAUDE_WORKSPACE_COOKIE,"wrkspc_changed");assert.equal((await gateway.generate(ctx,quote.id,true)).ok,false);assert.equal(sends,0);
 saved.set(CLAUDE_WORKSPACE_COOKIE,"wrkspc_existing");assert.equal((await gateway.generate(ctx,quote.id,true)).ok,true);assert.equal(sends,1);
});
test("reference bytes are decoded, resized and stripped of metadata without changing their original",async()=>{
 const bytes=await sharp({create:{width:1200,height:800,channels:3,background:"blue"}}).withExif({IFD0:{Artist:"PRIVATE ARTIST"}}).jpeg().toBuffer();
 const raw:ReferenceImage={name:"Room",mediaType:"image/jpeg",data:bytes.toString("base64")},before=JSON.stringify(raw);
 const [clean]=await prepareGreyReferenceImages([raw]);const metadata=await sharp(Buffer.from(clean!.data,"base64")).metadata();
 assert.equal(metadata.width,768);assert.equal(metadata.height,512);assert.equal(metadata.format,"jpeg");assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(JSON.stringify(raw),before);
});
test("invalid, mismatched, oversized and excessive images never become provider input",async()=>{
 const valid=await image();
 for(const raw of [[{...valid,data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString("base64")}],[{...valid,mediaType:"image/jpeg"}],[{...valid,data:"https://private.invalid/image"}],[valid,valid,valid],[{...valid,data:Buffer.alloc(MAX_REFERENCE_BYTES+1).toString("base64")}]] as unknown[][])await assert.rejects(()=>prepareGreyReferenceImages(raw as ReferenceImage[]));
 const huge={...valid,data:(await sharp({create:{width:2100,height:2100,channels:3,background:"white"}}).png().toBuffer()).toString("base64")};await assert.rejects(()=>prepareGreyReferenceImages([huge]));
});
test("vision has its own fail-closed gate before credentials, decode, store or provider work",async()=>{
 let credentials=0,sends=0;const gateway=createGreyProposalGateway({store:memoryGreyQuoteStore(),policy:()=>({...enabled,visionEnabled:false}),credentials:async()=>{credentials++;return {key:"fake"};},send:async()=>{sends++;throw Error("No call");}});
 const result=await gateway.quote({...context(),images:[await image()]});assert.equal(result.ok,false);assert.equal(credentials,0);assert.equal(sends,0);
});
test("image quote binds exact bytes, includes image allowance and sends sanitized inline images once after consent",async()=>{
 const raw=await image(),ctx={...context(),images:[raw]},store=memoryGreyQuoteStore();let sends=0,stored="",policy=enabled;
 const gateway=createGreyProposalGateway({store:{...store,put:async(id,row)=>{stored=JSON.stringify(row);return store.put(id,row);}},policy:()=>policy,credentials:async()=>({key:"sk-mock",workspaceId:"wrkspc_mock"}),send:(credentials,request,schema)=>askClaude({...credentials,request,schema,read:value=>value as typeof proposal,fetch:(async(url,init)=>{
  sends++;assert.equal(url,"https://api.anthropic.com/v1/messages");const headers=init!.headers as Record<string,string>;assert.equal(headers["x-api-key"],"sk-mock");assert.equal(headers["anthropic-workspace-id"],"wrkspc_mock");
  const body=JSON.parse(String(init!.body));const blocks=body.messages[0].content;const sent=blocks.find((b:{type:string})=>b.type==="image");assert.equal(sent.source.type,"base64");assert.equal(sent.source.media_type,"image/jpeg");assert.notEqual(sent.source.data,raw.data);assert.equal((await sharp(Buffer.from(sent.source.data,"base64")).metadata()).width,768);
  assert.doesNotMatch(String(init!.body),/private.invalid|\/original/);assert.ok(body.output_config.format.schema);
  return new Response(JSON.stringify({stop_reason:"end_turn",content:[{type:"text",text:JSON.stringify(proposal)}],usage:{input_tokens:10,output_tokens:10}}));
 }) as typeof fetch})});
 const text=await gateway.quote(context()),quote=await gateway.quote(ctx);assert.ok(text.ok&&quote.ok);assert.equal(quote.imageCount,1);assert.ok(quote.estimateUsd>text.estimateUsd);assert.equal(sends,0);assert.ok(!stored.includes(raw.data));
 assert.equal((await gateway.generate(ctx,quote.id,false)).ok,false);
 assert.equal((await gateway.generate({...ctx,images:[await image("green")]},quote.id,true)).ok,false);
 policy={...enabled,visionEnabled:false};assert.equal((await gateway.generate(ctx,quote.id,true)).ok,false);policy=enabled;
 assert.equal(sends,0);const results=await Promise.all([gateway.generate(ctx,quote.id,true),gateway.generate(ctx,quote.id,true)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(sends,1);
 assert.equal((await gateway.generate(ctx,quote.id,true)).ok,false);assert.equal(sends,1);
});
