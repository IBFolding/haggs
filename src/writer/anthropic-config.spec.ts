import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicHeaders, anthropicOptions, anthropicErrorReason, validateWorkspaceId, WORKSPACE_HELP } from './anthropic-config';
import { askClaude } from './draft';
import { CLAUDE_COOKIE, CLAUDE_WORKSPACE_COOKIE, claudeWorkspaceIn } from '../server/keys';

test('workspace metadata is optional, trimmed and rejects unsafe IDs', () => {
  assert.deepEqual(anthropicHeaders(), {});
  assert.deepEqual(anthropicHeaders('  '), {});
  assert.deepEqual(anthropicHeaders(' wrkspc_Test123 '), {'anthropic-workspace-id':'wrkspc_Test123'});
  for (const value of ['org_123', 'sk-ant-test', 'wrkspc_x\r\nInjected: yes', 'https://example.com', 'wrkspc_']) assert.throws(() => validateWorkspaceId(value), /workspace ID/);
});

test('SDK requests carry workspace header only when configured, with no automatic retries', async () => {
  for (const workspace of [undefined, 'wrkspc_Test123']) {
    let calls = 0;
    const options = anthropicOptions('test-only-key', workspace);
    assert.equal(options.maxRetries, 0);
    const client = new Anthropic({...options, fetch: async (input, init) => {
      calls++;
      const request = new Request(input, init);
      assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
      assert.equal(request.headers.get('anthropic-workspace-id'), workspace ?? null);
      return new Response(JSON.stringify({id:'msg_test',type:'message',role:'assistant',model:'test',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:0,output_tokens:0}}),{status:200,headers:{'content-type':'application/json'}});
    }});
    await client.messages.create({model:'test',max_tokens:1,messages:[{role:'user',content:'fixture'}]});
    assert.equal(calls, 1);
  }
});

test('draft transport validates before sending and returns a safe actionable workspace error', async () => {
  const request = {system:'fixture',user:'fixture',maxTokens:10};
  let calls=0;
  const fake = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('anthropic-workspace-id'),'wrkspc_Test123');
    return new Response(JSON.stringify({error:{message:'This API key is not scoped to a workspace; use anthropic-workspace-id. test-only-sensitive-content'}}),{status:400});
  }) as typeof fetch;
  const invalid = await askClaude({key:'test-only-key',workspaceId:'invalid',request,fetch:fake});
  assert.equal(invalid.ok,false);assert.equal(calls,0);
  const result = await askClaude({key:'test-only-key',workspaceId:'wrkspc_Test123',request,fetch:fake});
  assert.deepEqual(result,{ok:false,reason:WORKSPACE_HELP});assert.equal(calls,1);
  assert.ok(!JSON.stringify(result).includes('test-only-sensitive-content'));
});

test('unknown provider errors never echo raw request or credential text', () => {
  const result=anthropicErrorReason(400,'test-only-private-key prompt secret');
  assert.ok(!result.includes('private-key'));assert.ok(!result.includes('prompt secret'));
  assert.match(anthropicErrorReason(403,'workspace forbidden'),/already has access/);
});

test('a browser Claude key does not inherit a different environment key workspace', () => {
  const jar = {get:(name:string)=>name===CLAUDE_COOKIE?{value:'test-browser-key'}:undefined} as unknown as Parameters<typeof claudeWorkspaceIn>[0];
  assert.equal(claudeWorkspaceIn(jar),undefined);
  const configured = {get:(name:string)=>name===CLAUDE_WORKSPACE_COOKIE?{value:' wrkspc_Test123 '}:undefined} as unknown as Parameters<typeof claudeWorkspaceIn>[0];
  assert.equal(claudeWorkspaceIn(configured),'wrkspc_Test123');
});
