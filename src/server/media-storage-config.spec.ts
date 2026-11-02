import assert from "node:assert/strict";
import test from "node:test";
import { mediaWriteToken } from "./media-storage-config";
import { privateBlobToken } from "./private-media";
import { handleBlobUpload } from "./blob-upload";
test("read credential survives write rollback and incomplete private activation fails closed", async () => {
 const keys=["HAGGS_PRIVATE_MEDIA_WRITES","HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN","BLOB_READ_WRITE_TOKEN"];
 const before=keys.map(k=>process.env[k]);
 try {
  process.env.BLOB_READ_WRITE_TOKEN="legacy-fixture";process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN="private-fixture";
  delete process.env.HAGGS_PRIVATE_MEDIA_WRITES;
  assert.equal(mediaWriteToken(),"legacy-fixture");assert.equal(privateBlobToken(),"private-fixture");
  const request=()=>new Request("https://haggs.test/api/blob/upload",{method:"POST",body:JSON.stringify({type:"blob.generate-client-token",payload:{}}),headers:{origin:"https://haggs.test",host:"haggs.test"}});
  assert.equal((await handleBlobUpload(request(),true)).status,503);
  process.env.HAGGS_PRIVATE_MEDIA_WRITES="1";
  assert.equal(mediaWriteToken(),"private-fixture");assert.equal((await handleBlobUpload(request(),false)).status,503);
  process.env.HAGGS_PRIVATE_MEDIA_WRITES="0";
  assert.equal(privateBlobToken(),"private-fixture");assert.equal(mediaWriteToken(),"legacy-fixture");
  process.env.HAGGS_PRIVATE_MEDIA_WRITES="1";delete process.env.HAGGS_PRIVATE_BLOB_READ_WRITE_TOKEN;
  assert.throws(()=>mediaWriteToken(),/not configured/);
 } finally {keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});}
});
