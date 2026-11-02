/** Conservative reconciliation for the exact reviewed default Sonnet tariff.
 * Missing/unknown billing dimensions retain the reservation; zero is never inferred.
 * This calculates API token charges, not taxes or an invoice-level account total.
 */
export function greyClaudeCharge(receipt:{model?:unknown;usage?:unknown},env:Record<string,string|undefined>):number|null{
 if(receipt.model!=='claude-sonnet-5-5'||env.HAGGS_GREY_AI_PRICING_MODEL!==receipt.model||Number(env.HAGGS_GREY_AI_INPUT_USD_PER_MILLION)!==2||Number(env.HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION)!==10)return null;
 if(!receipt.usage||typeof receipt.usage!=='object')return null;
 const u=receipt.usage as Record<string,unknown>;
 if(u.service_tier!=='standard'||u.inference_geo!=='global')return null;
 for(const k of ['input_tokens','output_tokens'])if(!Number.isSafeInteger(u[k])||(u[k] as number)<0)return null;
 for(const k of ['cache_creation_input_tokens','cache_read_input_tokens'])if(u[k]!==0)return null;
 if(u.speed!==undefined&&u.speed!==null&&u.speed!=='standard')return null;
 const zeroDetails=(value:unknown,keys:string[])=>value===undefined||value===null||(typeof value==='object'&&!Array.isArray(value)&&Object.entries(value as Record<string,unknown>).every(([k,v])=>keys.includes(k)&&v===0));
 if(!zeroDetails(u.cache_creation,['ephemeral_1h_input_tokens','ephemeral_5m_input_tokens'])||!zeroDetails(u.server_tool_use,['web_fetch_requests','web_search_requests']))return null;
 // Thinking is already included in output_tokens, not a separate charge.
 if(u.output_tokens_details!==undefined&&u.output_tokens_details!==null){const d=u.output_tokens_details as Record<string,unknown>;if(typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>k!=='thinking_tokens')||!Number.isSafeInteger(d.thinking_tokens)||(d.thinking_tokens as number)<0||(d.thinking_tokens as number)>(u.output_tokens as number))return null;}
 const allowed=new Set(['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens','service_tier','inference_geo','speed','cache_creation','server_tool_use','output_tokens_details']);
 // Future surcharges/tools/cache fields must be reviewed before any reservation is released.
 if(Object.keys(u).some(k=>!allowed.has(k)&&u[k]!==null&&u[k]!==undefined))return null;
 const micros=(u.input_tokens as number)*2+(u.output_tokens as number)*10;
 return Number.isSafeInteger(micros)?micros/1_000_000:null;
}
