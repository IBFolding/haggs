import { cookies } from "next/headers";

import { PARTNER_REFUSAL, openOnlyIn } from "../comfy/open-only";

/** The refusal for a partner-model run while Open weights only is on, or null. */
export async function partnerRefusal(): Promise<string | null> {
  return openOnlyIn(await cookies()) ? PARTNER_REFUSAL : null;
}

export async function openOnly(): Promise<boolean> {
  return openOnlyIn(await cookies());
}
