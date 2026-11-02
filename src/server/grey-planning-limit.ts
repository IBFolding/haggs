/** Reviewed 2026-11-02: Sonnet 5.5, 1M context, $2/$10 per MTok.
 * https://platform.claude.com/docs/en/models/sonnet-5-5/overview
 * One standard/global uncached Messages request, no tools, retries or fast mode.
 * Reserve the FULL input window plus enforced output maximum, rounded UP to cents.
 * This bounds API token charges, not taxes or unrelated account activity.
 */
export const GREY_PLANNING_OUTPUT_TOKENS=2500;
export const GREY_PLANNING_RESERVATION_USD=2.03;
export function greyPlanningMaximum(env:Record<string,string|undefined>):number|undefined{
 return env.HAGGS_GREY_AI_PRICING_MODEL==='claude-sonnet-5-5'&&Number(env.HAGGS_GREY_AI_INPUT_USD_PER_MILLION)===2&&Number(env.HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION)===10?GREY_PLANNING_RESERVATION_USD:undefined;
}
