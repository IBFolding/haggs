import {test} from 'node:test';import assert from 'node:assert/strict';import {saveManagedArtifact,type Artifact,type ArtifactJournal} from './managed-artifact-save';
test('partial bundle save recovers each existing artifact without a repeat upload',async()=>{
 const rows=new Map<string,Artifact>(),objects=new Map<string,Uint8Array>();let writes=0,fail=true;
 const journal:ArtifactJournal={read:async(u,s,r)=>{const e=rows.get(`${s}/${r}`);return e?.userId===u?e:null;},claim:async e=>{const k=`${e.submissionId}/${e.role}`;if(rows.has(k))return 'existing';rows.set(k,e);return 'created';},verifyAndCommit:async e=>{if(!objects.has(e.pathname))throw Error('not confirmed');return `saved:${e.role}`;}};
 const base={userId:'11111111-1111-4111-8111-111111111111',submissionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bytes:new Uint8Array([1,2]),allowance:100,existing:[]};
 const upload=async(e:Artifact,b:Uint8Array)=>{writes++;objects.set(e.pathname,b);if(e.role==='manifest'&&fail){fail=false;throw Error('lost response');}};
 assert.equal(await saveManagedArtifact({...base,role:'atlas'},journal,upload),'saved:atlas');
 await assert.rejects(saveManagedArtifact({...base,role:'manifest'},journal,upload),/may have succeeded/);
 assert.equal(await saveManagedArtifact({...base,role:'atlas'},journal,upload),'saved:atlas');
 assert.equal(await saveManagedArtifact({...base,role:'manifest'},journal,upload),'saved:manifest');assert.equal(writes,2);
 await assert.rejects(saveManagedArtifact({...base,role:'atlas',bytes:new Uint8Array([3])},journal,upload),/conflict/);
});
