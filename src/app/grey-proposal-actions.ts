"use server";
import { cookies } from "next/headers";
import { CLAUDE_COOKIE, claudeWorkspaceIn, keyIn } from "../server/keys";
import { sharedGreyQuoteStore } from "../server/grey-quote-store";
import { createGreyProposalGateway } from "../server/grey-proposal-gateway";
import { askClaude, WRITER_MODEL } from "../writer/draft";
import { sceneProposalSchema } from "../story/grey-space";

const policy=()=>({enabled:process.env.HAGGS_GREY_AI_ENABLED==="1"&&process.env.HAGGS_GREY_AI_PRICING_MODEL===WRITER_MODEL,visionEnabled:process.env.HAGGS_GREY_AI_VISION_ENABLED==="1",model:WRITER_MODEL,inputUsdPerMillion:Number(process.env.HAGGS_GREY_AI_INPUT_USD_PER_MILLION),outputUsdPerMillion:Number(process.env.HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION)});
const gateway=createGreyProposalGateway({
 store:sharedGreyQuoteStore(process.env),
 policy,
 credentials:async()=>{const jar=await cookies(),key=keyIn(jar,CLAUDE_COOKIE);return key?{key,workspaceId:claudeWorkspaceIn(jar)}:undefined;},
 send:(credentials,request,schema)=>askClaude({...credentials,request,schema,read:value=>sceneProposalSchema.parse(value)}),
});
export async function quoteGreyProposal(context:unknown){return gateway.quote(context);}
export async function generateGreyProposal(context:unknown,quoteId:string,consent:boolean){return gateway.generate(context,quoteId,consent);}
export async function greyProposalAvailability(){const p=policy();return {visionEnabled:p.enabled&&p.visionEnabled&&[p.inputUsdPerMillion,p.outputUsdPerMillion].every(n=>Number.isFinite(n)&&n>0)};}
