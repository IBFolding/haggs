/** Local-only integration check: no provider calls or uploads. */
import assert from "node:assert/strict";
import {mkdtemp,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import sharp from "sharp";
import {POST} from "../src/app/api/grey/render/route";
import {addStandInProp} from "../src/story/grey-space";
assert.ok(!process.env.BLOB_READ_WRITE_TOKEN,"Run only without hosted storage configured");
assert.notEqual(process.env.NODE_ENV,"production");
const root=await mkdtemp(join(tmpdir(),"grey-render-check-")),before=process.env.HAGGS_LOCAL_MEDIA;
try{
 process.env.HAGGS_LOCAL_MEDIA=root;
 await sharp({create:{width:320,height:180,channels:3,background:"#808080"}}).png().toFile(join(root,"source.png"));
 const box=addStandInProp({}).props![0]!;
 const scene={source:{url:"/api/local/source.png",kind:"image"},props:[{...box,material:"wood"},{...box,id:"hidden",primitive:undefined,hidden:true,url:"http://127.0.0.1/private"}]};
 const send=(scene:unknown)=>POST(new Request("http://localhost/api/grey/render",{method:"POST",body:JSON.stringify({scene,footage:"/api/local/source.png",seconds:.5})}));
 const response=await send(scene),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.ok,true);
 assert.ok((await stat(join(root,decodeURIComponent(result.url.replace("/api/local/",""))))).size>100);
 for(const url of [box.url,"file:///etc/passwd","http://127.0.0.1/private"]){const denied=await send({...scene,props:[{...box,primitive:undefined,url}]});assert.equal(denied.status,400);}
 console.log("PASS actual local draft FFmpeg render with visible box and hidden untrusted prop; ordinary SVG/file/http URLs denied");
}finally{if(before===undefined)delete process.env.HAGGS_LOCAL_MEDIA;else process.env.HAGGS_LOCAL_MEDIA=before;await rm(root,{recursive:true,force:true});}
