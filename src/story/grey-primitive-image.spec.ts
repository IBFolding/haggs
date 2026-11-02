import {test} from "node:test";
import assert from "node:assert/strict";
import {boxSvg,propImage} from "./grey-primitive-image";
import {addStandInProp,MATERIALS} from "./grey-space";
test("box previews follow each validated material without rewriting the saved asset",()=>{
 const box=addStandInProp({}).props![0]!,saved=JSON.stringify(box);
 for(const [material,appearance] of Object.entries(MATERIALS)){
  const preview=propImage({...box,material:material as keyof typeof MATERIALS});
  assert.ok(decodeURIComponent(preview).includes(`fill="${appearance.color}"`));
 }
 assert.equal(JSON.stringify(box),saved);
 assert.notEqual(propImage({...box,material:"wood"}),propImage({...box,material:"concrete"}));
});
test("primitive previews ignore untrusted URLs and reject arbitrary SVG material markup",()=>{
 const box=addStandInProp({}).props![0]!;
 assert.equal(propImage({...box,url:'https://private.invalid/asset.svg'}),propImage(box));
 assert.equal(boxSvg('<image href="file:///secret"/>'),boxSvg(undefined));
 assert.ok(!propImage({...box,url:'file:///secret'}).includes('secret'));
});
test("legacy image layers keep their exact original asset URL and data",()=>{
 const image={url:'https://assets.example/actor.png',material:'wood' as const};
 assert.equal(propImage(image),image.url);
});
