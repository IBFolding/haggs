import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultGrey } from "../story/grey";
import { addStandInProp } from "../story/grey-space";
import { renderControlVideo } from "./grey-control-video";
import { ffmpegBin,ffprobeBin } from "./ffmpeg";
const exec = promisify(execFile);
test("spatial materials and props encode locally into a decodable control video without a model call", async()=>{
 const grey=defaultGrey();grey.camKeys=[{...grey.cam,t:0},{...grey.cam,t:1,distance:4}];
 const scene=addStandInProp({space:{floor:"wood",wall:"plaster"}});
 const clip=await renderControlVideo(grey,{w:320,h:180},scene);
 assert.ok(clip.bytes.length>1000);assert.ok(clip.seconds>0 && clip.seconds<=1);
 const dir=await mkdtemp(join(tmpdir(),"grey-spatial-test-"));
 try {
  const file=join(dir,"control.mp4");await writeFile(file,clip.bytes);
  const probe=await exec(ffprobeBin(),["-v","error","-show_entries","format=duration","-of","json",file]);
  assert.equal(Number(JSON.parse(probe.stdout).format.duration),clip.seconds,"reported duration includes the encoded final frame");
  const {stdout}=await exec(ffmpegBin(),["-v","error","-i",file,"-frames:v","1","-f","rawvideo","-pix_fmt","rgb24","-"],{encoding:"buffer",maxBuffer:320*180*3+1000});
  assert.equal(stdout.length,320*180*3);
  const offset=(10*320+10)*3;assert.ok(stdout[offset]!>stdout[offset+2]!,"plaster wall is warm, rather than legacy grey-blue");
 } finally {await rm(dir,{recursive:true,force:true});}
});
