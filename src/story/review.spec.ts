import { test } from "node:test";
import assert from "node:assert/strict";
import { newShot } from "./model";
import { applyReviewFix } from "./review";
test("only an approved fix updates its stable shot, preserving selected media",()=>{
 const base=newShot(); const media={url:"clip.mp4",kind:"video" as const,usd:1,promptHash:"old",at:1};
 const shot={...base,beat:"Original action",render:media,review:[{id:"n",shotId:base.id,at:2,text:"Wrong eyeline",fix:"Look screen left",status:"approved" as const}]};
 const fixed=applyReviewFix(shot,"n");assert.equal(fixed.render,media);assert.match(fixed.beat,/Original action/);assert.match(fixed.beat,/Look screen left/);assert.equal(fixed.review![0]!.status,"applied");assert.equal(applyReviewFix(fixed,"n"),fixed);
 assert.equal(applyReviewFix({...shot,review:shot.review.map(n=>({...n,status:"open" as const}))},"missing").beat,shot.beat);
 assert.equal(applyReviewFix({...shot,id:"another"},"n").beat,shot.beat);
});
