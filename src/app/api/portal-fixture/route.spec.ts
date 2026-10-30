import {test} from 'node:test';import assert from 'node:assert/strict';
import {GET,POST,PUT} from './route';
test('fixture routes stay unavailable in production even when their flag is set',async()=>{
 const env=process.env as Record<string,string|undefined>,old=env.NODE_ENV,flag=env.HAGGS_PORTAL_FIXTURE;
 env.NODE_ENV='production';env.HAGGS_PORTAL_FIXTURE='1';
 try{for(const method of [GET,POST,PUT])assert.equal((await method(new Request('https://example.test',{method:'POST'}))).status,404);}
 finally{if(old===undefined)delete env.NODE_ENV;else env.NODE_ENV=old;if(flag===undefined)delete env.HAGGS_PORTAL_FIXTURE;else env.HAGGS_PORTAL_FIXTURE=flag;}
});
