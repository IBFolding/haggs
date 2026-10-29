import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stageGreyFiles } from "./grey-hosted";

const footage = "https://abc.public.blob.vercel-storage.com/haggs/footage.mp4";
const backdrop = "https://abc.public.blob.vercel-storage.com/haggs/place.png";
test("hosted Grey Room stages source and backdrop without fetching generated lights", async () => {
  const root = await mkdtemp(join(tmpdir(), "grey-stage-test-"));
  try {
    const fetched: string[] = [];
    const files = await stageGreyFiles({backdrop:{url:backdrop,name:"Coast",scale:1,x:0.5,y:0.5,blur:0}}, footage, root, (async (url) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch);
    assert.deepEqual(new Set(fetched), new Set([footage, backdrop]));
    assert.equal(files.size,2);
    for (const file of files.values()) { assert.ok(file.startsWith(root + "/media/")); assert.equal((await readFile(file)).length,3); }
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("hosted Grey Room refuses local and arbitrary remote footage before fetching", async () => {
  const root = await mkdtemp(join(tmpdir(), "grey-stage-test-"));
  try {
    for (const url of ["file:///etc/passwd", "http://127.0.0.1/private", "/api/local/secret.mp4"]) {
      let calls=0;
      await assert.rejects(stageGreyFiles({},url,root,(async()=>{calls++;return new Response();}) as typeof fetch),/store/);
      assert.equal(calls,0);
    }
  } finally { await rm(root,{recursive:true,force:true}); }
});
