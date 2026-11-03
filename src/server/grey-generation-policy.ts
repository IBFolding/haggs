/** Independent opt-ins: planning can launch without enabling still or video charges. */
export const GREY_GENERATION_HOLD="This Grey Room media operation is not enabled. You can keep editing and use local previews.";
export const greyStillEnabled=(env:Record<string,string|undefined>=process.env)=>env.HAGGS_GREY_STILL_ENABLED==='1';
export const greyVideoEnabled=(env:Record<string,string|undefined>=process.env)=>env.HAGGS_GREY_VIDEO_ENABLED==='1';
/** Compatibility summary for callers which only need to know whether any media operation is enabled. */
export const greyGenerationEnabled=(env:Record<string,string|undefined>=process.env)=>greyStillEnabled(env)||greyVideoEnabled(env);
/** Cut-out and area finding on Comfy Cloud: needs both the switch and an owner-set estimate per run. No number is invented here. */
export const greyMatteEstimateUsd=(env:Record<string,string|undefined>=process.env)=>{const n=Number(env.HAGGS_GREY_MATTE_ESTIMATE_USD);return Number.isFinite(n)&&n>0?n:undefined;};
export const greyMatteEnabled=(env:Record<string,string|undefined>=process.env)=>env.HAGGS_GREY_MATTE_ENABLED==='1'&&greyMatteEstimateUsd(env)!==undefined;
