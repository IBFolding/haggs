import assert from "node:assert/strict";
import test from "node:test";
import {privatePicture,packagePrivatePictures} from "./private-picture";
const url="/api/media/haggs/u-11111111-1111-4111-8111-111111111111/uploads/atlas.png";
test("private atlas/export bytes embed unchanged without leaking the authenticated URL",async()=>{
 const bytes=new Uint8Array([137,80,78,71,0,255,20]);let calls=0;
 const fake:typeof fetch=async(input,init)=>{assert.equal(input,url);assert.equal(init?.credentials,"same-origin");assert.equal(init?.redirect,"error");calls++;return new Response(bytes,{headers:{"content-type":"image/png"}});};
 const packed=await packagePrivatePictures({atlas:url,public:"https://example.test/public.png"},fake);
 assert.deepEqual(new Uint8Array(Buffer.from(packed.atlas!.split(',')[1]!,"base64")),bytes);
 assert.equal(packed.public,"https://example.test/public.png");assert.equal(calls,1);assert.ok(!JSON.stringify(packed).includes('/api/media/'));
});
test("unauthorized or active-content private images abort packaging rather than retaining private URLs",async()=>{
 await assert.rejects(privatePicture(url,async()=>new Response(null,{status:401})),/Sign in/);
 await assert.rejects(privatePicture(url,async()=>new Response("svg",{headers:{"content-type":"image/svg+xml"}})),/PNG/);
});
