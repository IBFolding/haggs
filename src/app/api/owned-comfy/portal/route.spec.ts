import {test} from 'node:test';import assert from 'node:assert/strict';import {POST} from './route';
test('customer execution stays disabled in production even if preview flag is set',async()=>{
 const e=process.env as Record<string,string|undefined>,old=e.NODE_ENV,flag=e.HAGGS_OWN_COMFY_PORTAL_PREVIEW;e.NODE_ENV='production';e.HAGGS_OWN_COMFY_PORTAL_PREVIEW='1';
 try{const result=await POST(new Request('https://example.test',{method:'POST',body:'not json'}));assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'no-store');}
 finally{if(old===undefined)delete e.NODE_ENV;else e.NODE_ENV=old;if(flag===undefined)delete e.HAGGS_OWN_COMFY_PORTAL_PREVIEW;else e.HAGGS_OWN_COMFY_PORTAL_PREVIEW=flag;}
});
test('preview rejects an unsigned request before parsing or provider access',async()=>{
 const e=process.env as Record<string,string|undefined>,old=e.NODE_ENV,flag=e.HAGGS_OWN_COMFY_PORTAL_PREVIEW;e.NODE_ENV='test';e.HAGGS_OWN_COMFY_PORTAL_PREVIEW='1';
 try{const result=await POST(new Request('https://example.test',{method:'POST',body:'not json'}));assert.equal(result.status,401);}
 finally{if(old===undefined)delete e.NODE_ENV;else e.NODE_ENV=old;if(flag===undefined)delete e.HAGGS_OWN_COMFY_PORTAL_PREVIEW;else e.HAGGS_OWN_COMFY_PORTAL_PREVIEW=flag;}
});
