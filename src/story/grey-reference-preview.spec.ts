import {test} from "node:test";
import assert from "node:assert/strict";
import {retainSelectedReferences} from "./grey-reference-preview";
import {proposalContext} from "./grey-proposal-context";
import {defaultGrey} from "./grey";

test("select then remove allows a text-only proposal and does not select a re-added image",()=>{
 const selected=["removed"],references=[{id:"remaining",name:"Room",url:"/room.png"}];
 const retained=retainSelectedReferences(selected,references);
 assert.deepEqual(retained,[]);assert.deepEqual(selected,["removed"]);
 const context=proposalContext({description:"Stage the room",references,grey:defaultGrey(),scene:{references}});
 assert.equal(context.description,"Stage the room");assert.equal(context.images,undefined);
 assert.deepEqual(retainSelectedReferences(retained,[...references,{id:"new-id",name:"Re-added room",url:"/room.png"}]),[]);
});
test("removal frees slots while retaining other choices without a repeated state update",()=>{
 const selected=["kept","removed"],references=[{id:"other"},{id:"kept"}];
 const retained=retainSelectedReferences(selected,references);
 assert.deepEqual(retained,["kept"]);assert.equal(retainSelectedReferences(retained,references),retained);
 assert.deepEqual(retainSelectedReferences(retained,[]),[]);
});
