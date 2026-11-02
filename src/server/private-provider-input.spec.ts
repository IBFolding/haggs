import assert from "node:assert/strict";
import test from "node:test";
import {privateProviderInputs} from "./private-provider-input";
const url="/api/media/haggs/u-11111111-1111-4111-8111-111111111111/uploads/reference.png";
test("private provider references become authorized bytes without forwarding application credentials or URLs",async()=>{
 const read:string[]=[];const result=await privateProviderInputs([url,"https://public.example/image.png"],async source=>{read.push(source);return{bytes:new Uint8Array([1,2,3]),mime:"image/png"};});assert.deepEqual(read,[url]);assert.deepEqual(result,["data:image/png;base64,AQID","https://public.example/image.png"]);assert.ok(!JSON.stringify(result).includes('/api/media/'));
 await assert.rejects(privateProviderInputs([url],async()=>{throw Error('wrong owner');}),/wrong owner/);
});
