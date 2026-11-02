import assert from "node:assert/strict";
import test from "node:test";
import {bundleAppMedia,restoreBundledMedia} from "./media-bundle";
const base="/api/media/haggs/u-11111111-1111-4111-8111-111111111111/results/";
test("image, audio and video bundle round-trip without service URLs, duplicate reads or project mutation",async()=>{
 const original={image:base+"a.png",nested:[base+"b.mp4",base+"c.wav",base+"a.png"],sheets:JSON.stringify({url:base+"b.mp4"})},snapshot=JSON.stringify(original);let reads=0,uploads=0;
 const packed=await bundleAppMedia(original,async(input,init)=>{reads++;assert.equal(init?.credentials,"same-origin");const type=String(input).endsWith('png')?'image/png':String(input).endsWith('wav')?'audio/wav':'video/mp4';return new Response("synthetic",{headers:{"content-type":type}});});
 assert.equal(reads,3);assert.equal(JSON.stringify(original),snapshot);assert.ok(!JSON.stringify(packed).includes('/api/media/'));
 const restored=await restoreBundledMedia(packed,async(file)=>{assert.equal(await file.text(),"synthetic");uploads++;return {ok:true,url:base+file.name};});
 assert.equal(uploads,3);assert.equal(restored.image,restored.nested[2]);assert.equal(JSON.parse(restored.sheets).url,restored.nested[0]);
});
test("failed access/import aborts rather than producing broken or partially replaced projects",async()=>{
 await assert.rejects(bundleAppMedia({url:base+"a.png"},async()=>new Response(null,{status:401})),/could not be bundled/);
 await assert.rejects(restoreBundledMedia({url:"data:image/png;base64,YQ=="},async()=>({ok:false,reason:"quota"})),/project was not replaced/);
});

test("local traversal and unknown web references are never fetched with user credentials",async()=>{
 const original={url:"/api/local/%2e%2e/private",other:"https://provider.example/temporary.mp4"};
 assert.deepEqual(await bundleAppMedia(original,async()=>{throw Error("must not fetch");}),original);
});
test("attachment envelopes validate before upload and restore normal project URLs before final import",async()=>{
 const {createMediaEnvelope,restoreMediaEnvelope}=await import("./media-bundle");
 const {createProject}=await import("./model");const {exportProject,importBundle}=await import("./transfer");
 const project=createProject("Bundle fixture");project.media=[{id:"m1",url:base+"a.png",kind:"image"} as never];
 const packed=await createMediaEnvelope(JSON.parse(exportProject(project)),async()=>new Response("synthetic",{headers:{"content-type":"image/png"}}));
 assert.ok(importBundle(JSON.stringify(packed)).project.media![0]!.url.startsWith("haggs-bundle:"));
 const restored=await restoreMediaEnvelope(packed,async()=>({ok:true,url:base+"restored.png"}));
 assert.equal(importBundle(JSON.stringify(restored)).project.media![0]!.url,base+"restored.png");
 assert.equal(restored.mediaBundle,undefined);
});
