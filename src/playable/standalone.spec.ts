import assert from "node:assert/strict";
import test from "node:test";
import {standaloneGame} from "./standalone";
import {atlasDemo} from "./atlas-demo";
const url="/api/media/haggs/u-11111111-1111-4111-8111-111111111111/results/synthetic.png";
test("standalone HTML packages authorized images and keeps scripts in an opaque sandbox",async()=>{
 const spec=atlasDemo({prompt:"Hero",shape:"circle",color:"#ffffff",url},{prompt:"Effect",shape:"circle",color:"#ffffff",url});let reads=0;
 const html=await standaloneGame(spec,async()=>{reads++;return new Response(new Uint8Array([137,80,78,71]),{headers:{"content-type":"image/png"}});});
 assert.equal(reads,1);assert.ok(!html.includes('/api/media/'));assert.match(html,/data:image\/png;base64/);assert.match(html,/sandbox="allow-scripts"/);assert.doesNotMatch(html,/allow-same-origin/);assert.ok(!html.includes('<script>'));
 await assert.rejects(standaloneGame({...spec,three:true}),/3D games/);
});
