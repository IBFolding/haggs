import assert from "node:assert/strict";
import test from "node:test";
import {planLegacyCopies,verifiedReferenceMap,rewriteMediaReferences} from "./legacy-media-migration";
const owner="11111111-1111-4111-8111-111111111111",origin="https://synthetic.public.blob.vercel-storage.com";
const object={owner,url:`${origin}/haggs/u-${owner}/uploads/synthetic.mp4`,bytes:9,sha256:"a".repeat(64)};
test("legacy plans are deterministic, owner-bound and reject foreign or ambiguous sources",()=>{
 assert.deepEqual(planLegacyCopies([object],origin),planLegacyCopies([object],origin));
 for(const objects of [[{...object,url:object.url.replace("synthetic.public","foreign.public")}],[{...object,owner:"22222222-2222-4222-8222-222222222222"}],[object,object],[{...object,sha256:""}],[{...object,url:object.url+"?secret=x"}]])assert.throws(()=>planLegacyCopies(objects,origin));
});
test("only verified copies permit reversible snapshot rewrites and preserve unrelated project state",()=>{
 const plan=planLegacyCopies([object],origin),copy={source:object.url,destination:plan[0]!.destination,bytes:9,sha256:object.sha256};
 for(const copies of [[],[{...copy,sha256:"b".repeat(64)}],[{...copy,bytes:8}],[{...copy,destination:"/api/media/wrong"}],[copy,copy]])assert.throws(()=>verifiedReferenceMap(plan,copies));
 const mapping=verifiedReferenceMap(plan,[copy]);
 const before={shots:[{url:object.url,takes:[object.url,"other.mp4"],trim:2}],script:"unrelated",settings:{seed:4}},snapshot=JSON.stringify(before);
 const after=rewriteMediaReferences(before,mapping);
 assert.equal(JSON.stringify(before),snapshot);
 assert.deepEqual(after,{...before,shots:[{...before.shots[0],url:copy.destination,takes:[copy.destination,"other.mp4"]}]});
 assert.deepEqual(rewriteMediaReferences(after,new Map([...mapping].map(([a,b])=>[b,a]))),before);
});
