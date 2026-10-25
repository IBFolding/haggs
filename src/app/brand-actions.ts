"use server";

import { readSite, type SiteRead } from "../server/read-site";

/** Works out a company's brand from its website. Free. */
export async function readBrand(address: string): Promise<SiteRead> {
  return readSite(String(address).slice(0, 300));
}
