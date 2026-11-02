import assert from "node:assert/strict";
import test from "node:test";
import {memoryKv} from "./kv";
import {recoveryReferences} from "./recovery-references";
test("owner recovery references survive reopening without signed links and do not disappear beyond the recent provider list",async()=>{
 const kv=memoryKv(),owner='owner-a';const old={job:'older-job',filename:'old.mp4',subfolder:'haggs',kind:'video',at:1,preview:'https://provider.example/expired?token=private'};
 await recoveryReferences(kv,owner).remember([old]);
 const reopened=recoveryReferences(kv,owner),saved=await reopened.remember([{...old,job:'new-job',at:2}]);assert.equal(saved.length,2);assert.equal(saved[1]!.job,'older-job');assert.equal(saved[1]!.preview,null);
 assert.deepEqual(await recoveryReferences(kv,'owner-b').read(),[]);assert.ok(!JSON.stringify(await reopened.read()).includes('https:'));
});
