import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLKITS, localToolkitUrl, toolkitPacket } from './toolkits';
test('toolkit launches stay on the explicitly chosen local/private host',()=>{
 for(const root of ['http://localhost:8188','http://127.0.0.1:8188','http://192.168.1.8:8188','http://10.1.2.3:8188','http://172.16.1.3:8188','http://[::1]:8188'])assert.match(localToolkitUrl(root,'/oneshot-mv/'),/oneshot-mv\/$/);
 for(const root of ['https://example.com','http://169.254.169.254','http://172.32.0.1','http://user:pass@localhost:8188','http://localhost:8188?key=secret','javascript:alert(1)','http://localhost:8188/not-root'])assert.throws(()=>localToolkitUrl(root,'/'));
 assert.throws(()=>localToolkitUrl('http://localhost:8188','//evil.example'));
});
test('all 16 credited projects have explicit requirements and packets never claim submission',()=>{
 assert.equal(TOOLKITS.length,16);assert.equal(new Set(TOOLKITS.map(t=>t.repo)).size,16);
 for(const t of TOOLKITS){assert.ok(t.license&&t.requirements&&t.handoff);const p=toolkitPacket(t,'Prepare my shot');assert.equal(p.jobSubmitted,false);assert.equal(p.credentialsIncluded,false);assert.equal(p.status,'manual-external-handoff');}
});
