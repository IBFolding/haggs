import { join } from "node:path";
import type { GreyScene } from "../story/grey-scene";
import { greyPlan } from "../story/grey-render";
import { stageHosted } from "./render-hosted";

/** Stage only media referenced by the composite, using the same store and size checks as MP4 export. */
export async function stageGreyFiles(scene: GreyScene, footage: string, scratch: string, fetcher: typeof fetch = fetch): Promise<Map<string, string>> {
  const generated = new Set(["shadow", "light", "air"]);
  const plan = greyPlan(scene, { w: 1920, h: 1080 }, 4, footage);
  const refs = [...new Set([...plan.inputs.filter(i => !generated.has(i.role)).map(i => i.ref), ...(scene.props ?? []).map(p => p.url)])];
  const staged = await stageHosted({ clips: refs.map((url, i) => ({ shotId: String(i), index: i, heading: "", url, kind: "video", start: 0, from: 0, seconds: 4 })), total: 4, voices: [], music: null, aspect: "16:9", skipped: [] }, scratch, fetcher);
  return new Map(refs.map((url, i) => [url, join(scratch, staged.clips[i]!.url.slice("/api/local/".length))]));
}
