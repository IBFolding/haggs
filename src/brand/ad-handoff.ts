export type AdDestination = "Video" | "Edit";
export type AdHandoff = { url: string; to: AdDestination; prompt: string };
export const AD_HANDOFF_KEY = "haggs.handoff";

/** Same contract consumed by Studio; preparing a handoff never generates media. */
export async function prepareAdHandoff(
  url: string,
  to: AdDestination,
  prompt: string,
  deps: { shrink: (url: string, max: number) => Promise<string>; save: (key: string, value: string) => void },
): Promise<"/video" | "/edit"> {
  if (!url.trim()) throw new Error("Choose an ad image first.");
  const gift: AdHandoff = {
    url: await deps.shrink(url, 1536), to,
    prompt: to === "Video" ? "Animate this finished ad with subtle camera movement. Preserve the product, composition and lettering." : prompt,
  };
  deps.save(AD_HANDOFF_KEY, JSON.stringify(gift));
  return to === "Video" ? "/video" : "/edit";
}
