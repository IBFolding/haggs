import assert from "node:assert/strict";
import test from "node:test";
import {GET,POST} from "./route";
test("hosted recovery is disabled without activation and rejects unauthenticated requests before body/provider access",async()=>{
 const was=process.env.HAGGS_HOSTED_OUTPUT_RECOVERY;try{delete process.env.HAGGS_HOSTED_OUTPUT_RECOVERY;const disabled=await GET(new Request('https://haggs.test/api/recovery/outputs'));assert.equal((await disabled.json()).enabled,false);assert.equal((await POST(new Request('https://haggs.test/api/recovery/outputs',{method:'POST',body:'invalid'}))).status,503);process.env.HAGGS_HOSTED_OUTPUT_RECOVERY='1';assert.equal((await GET(new Request('https://haggs.test/api/recovery/outputs'))).status,401);assert.equal((await POST(new Request('https://haggs.test/api/recovery/outputs',{method:'POST',body:'invalid'}))).status,401);}finally{if(was===undefined)delete process.env.HAGGS_HOSTED_OUTPUT_RECOVERY;else process.env.HAGGS_HOSTED_OUTPUT_RECOVERY=was;}
});
