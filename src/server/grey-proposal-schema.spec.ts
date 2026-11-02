import {test} from "node:test";
import assert from "node:assert/strict";
import {GREY_PROVIDER_SCHEMA} from "./grey-proposal-schema";
import {PROPOSAL_SCHEMA} from "../story/grey-proposal";
import {sceneProposalSchema} from "../story/grey-space";
import {defaultGrey} from "../story/grey";

test("provider schema uses the supported subset without weakening local or manual bounds",()=>{
 const before=JSON.stringify(PROPOSAL_SCHEMA);
 function walk(value:unknown){
  if(!value||typeof value!=="object")return;
  if(Array.isArray(value)){value.forEach(walk);return;}
  const node=value as Record<string,unknown>;
  for(const key of ["minimum","maximum","exclusiveMinimum","exclusiveMaximum","multipleOf","minLength","maxLength","maxItems"])assert.equal(node[key],undefined,key);
  if(node.minItems!==undefined)assert.ok(node.minItems===0||node.minItems===1);
  if(node.type==="object")assert.equal(node.additionalProperties,false);
  Object.values(node).forEach(walk);
 }
 walk(GREY_PROVIDER_SCHEMA);
 assert.match(JSON.stringify(GREY_PROVIDER_SCHEMA),/maximum|Maximum|maxItems|maxLength/);
 assert.equal(JSON.stringify(PROPOSAL_SCHEMA),before);assert.match(before,/"maximum":/);
 const g=defaultGrey(),valid={version:1,summary:"Room",room:{floor:"wood",wall:"plaster"},people:[],props:[],camera:g.cam,light:g.light};
 assert.equal(sceneProposalSchema.safeParse(valid).success,true);
 for(const invalid of [{...valid,camera:{...g.cam,lens:999}},{...valid,people:Array.from({length:7},()=>({label:"Person",x:0,z:0}))},{...valid,summary:"x".repeat(1001)}])assert.equal(sceneProposalSchema.safeParse(invalid).success,false);
});
