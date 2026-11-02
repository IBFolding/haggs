import {test} from "node:test";
import assert from "node:assert/strict";
import {writerMessage} from "./image-input";
import {askClaude} from "./draft";
test("text-only writer messages stay unchanged and inline images precede the scene text",()=>{
 assert.equal(writerMessage("Existing text"),"Existing text");
 const content=writerMessage("Scene",[{name:"Room",mediaType:"image/png",data:"AAAA"}]);assert.ok(Array.isArray(content));assert.equal(content[1]!.type,"image");assert.deepEqual(content.at(-1),{type:"text",text:"Scene"});
});
test("malformed image requests fail before authenticated transport",async()=>{
 let calls=0;const result=await askClaude({key:"mock",request:{system:"x",user:"x",maxTokens:1,images:[{name:"x",mediaType:"image/png",data:"https://private.invalid"}]},fetch:(async()=>{calls++;throw Error("No call");}) as typeof fetch});assert.equal(result.ok,false);assert.equal(calls,0);
});
