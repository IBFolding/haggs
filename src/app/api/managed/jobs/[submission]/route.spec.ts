import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from './route';

test('managed job status requires an authenticated user before configuration or provider access',async()=>{
  const response=await GET(new Request('https://haggs.example/api/managed/jobs/a5a9b26a-2063-4548-994d-0c7eb076b766'),{params:Promise.resolve({submission:'a5a9b26a-2063-4548-994d-0c7eb076b766'})});
  assert.equal(response.status,401);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
