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
 const allowed=new Set(['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens','service_tier','inference_geo']);
 // Future surcharges/tools/cache fields must be reviewed before any reservation is released.
 if(Object.keys(u).some(k=>!allowed.has(k)&&u[k]!==null&&u[k]!==undefined))return null;
 const micros=(u.input_tokens as number)*2+(u.output_tokens as number)*10;
 return Number.isSafeInteger(micros)?micros/1_000_000:null;
}
