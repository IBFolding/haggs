import { join } from "node:path";
import type { GreyScene } from "../story/grey-scene";
import { greyPlan } from "../story/grey-render";
import { stageHosted } from "./render-hosted";

/** Stage only media referenced by the composite, using the same store and size checks as MP4 export. */
export async function stageGreyFiles(scene: GreyScene, footage: string, scratch: string, fetcher: typeof fetch = fetch, privateReader?: (url: string) => Promise<Response>): Promise<Map<string, string>> {
  const generated = new Set(["shadow", "light", "air", "primitive"]);
  const plan = greyPlan(scene, { w: 1920, h: 1080 }, 4, footage);
  const refs = [...new Set([...plan.inputs.filter(i => !generated.has(i.role)).map(i => i.ref)])];
  const staged = await stageHosted({ clips: refs.map((url, i) => ({ shotId: String(i), index: i, heading: "", url, kind: "video", start: 0, from: 0, seconds: 4 })), total: 4, voices: [], music: null, aspect: "16:9", skipped: [] }, scratch, fetcher, undefined, privateReader);
  return new Map(refs.map((url, i) => [url, join(scratch, staged.clips[i]!.url.slice("/api/local/".length))]));
}
