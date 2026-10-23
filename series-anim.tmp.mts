import { readFileSync, writeFileSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { createCloudRunner, minimaxWorkflow } from "./src/providers/cloud";
const W="/Users/brain/.codex/.chatgpt-projects/g-p-6a9615ab19208191bcc9ac0ddc90fe4e/open-higgs/app/artifacts/waylight";
const R=join(W,"haggs-renders"), OUT=join(W,"haggs-import/series-test"); mkdirSync(OUT,{recursive:true});
const apiKey=/^COMFY_API_KEY=(.*)$/m.exec(readFileSync(".env.local","utf8"))?.[1]?.trim().replace(/^["']|["']$/g,"")!;
let name=""; const runner=createCloudRunner({apiKey,keep:async(b,e)=>{const p=join(OUT,`${name}.${e}`);writeFileSync(p,b);return p;}});
const shots=[
 ["hair_floor","2026-10-23-21ecc24b","Slow push-in. Her hair slowly keeps flowing across the tiled floor like a dark river, she looks down in disbelief. Natural motion."],
 ["hair_busstop","2026-10-23-e472061f","Slow camera drift. The hair sways around the lamp post, commuters glance over and look away, a bus passes behind."],
 ["scissors","2026-10-23-8db9adad","Slow push-in on the scissors as the hairdresser sighs and starts to cut, hair drifts down in dramatic light."],
 ["eye","2026-10-23-ffee0025","Macro, almost still. The unblinking eye trembles slightly, the tear slides down the cheek, light flickers."],
 ["desk","2026-10-23-1609abed","Slow push-in. The man stares at the screen, eyes wide and glassy, the screen light flickers on his face."]];
for (const [n,f,p] of shots) {
  name=n;
  try {
    const img=await runner.uploadBytes(new Uint8Array(readFileSync(join(R,f+".png"))),"image/png");
    const r=await runner.run(minimaxWorkflow({prompt:p,seconds:4,resolution:"768P",ratio:"9:16",seed:7,firstFrame:img})); console.log(n,"ok",r.kind);
  } catch(e){ console.log("STOP",n,e instanceof Error?e.message:e); break; }
}
