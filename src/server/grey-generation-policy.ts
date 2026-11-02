/** Operator rollout gate for all paid Grey Room still/video generation. Never reads credentials. */
export const GREY_GENERATION_HOLD="Paid Grey Room generation is not enabled. You can keep editing and use local previews.";
export const greyGenerationEnabled=(env:Record<string,string|undefined>=process.env)=>env.HAGGS_GREY_AI_ENABLED==="1";
