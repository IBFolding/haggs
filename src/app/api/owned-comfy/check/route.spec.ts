import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';

const URL = 'https://haggs.example/api/owned-comfy/check';
const SUPABASE_URL = 'https://supabase.fixture';
const COMFY_URL = 'https://my-deployment.run.comfy.app/api/v2/jobs?limit=1';
let tokenNumber = 0;

function request(body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}, authenticated = true) {
  return new Request(URL, {
    method: 'POST',
    body,
    headers: authenticated ? { authorization: `Bearer test-token-${++tokenNumber}`, ...headers } : headers,
    ...(typeof body !== 'string' ? { duplex: 'half' } : {}),
  } as RequestInit);
}

function signedIn(fetcher: typeof fetch) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === `${SUPABASE_URL}/auth/v1/user`) {
      return Response.json({ id: 'user-1', email: 'person@example.invalid' });
    }
    return fetcher(input, init);
  }) as typeof fetch;
}

async function enabled(fetcher: typeof fetch, run: () => Promise<void>) {
  const before = {
    preview: process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    fetch: globalThis.fetch,
  };
  process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW = '1';
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-only-publishable-key';
  globalThis.fetch = signedIn(fetcher);
  try { await run(); }
  finally {
    globalThis.fetch = before.fetch;
    for (const [name, value] of [
      ['HAGGS_OWN_COMFY_SETUP_PREVIEW', before.preview],
      ['NEXT_PUBLIC_SUPABASE_URL', before.url],
      ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', before.key],
    ] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

function unexpectedProviderCall(): typeof fetch {
  return (async () => { throw new Error('Unexpected provider call'); }) as typeof fetch;
}

test('setup check is disabled by default and does not read the secret', async () => {
  const before = process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW;
  delete process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW;
  try {
    const response = await POST(request('not json', {}, false));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    if (before !== undefined) process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW = before;
  }
});

test('enabled setup check rejects an unauthenticated request before reading its body', async () => {
  await enabled(unexpectedProviderCall(), async () => {
    class UnreadableRequest extends Request {
      override get body(): ReadableStream<Uint8Array<ArrayBuffer>> { throw new Error('Body must not be read'); }
    }
    const req = new UnreadableRequest(URL, { method: 'POST', body: 'secret' });
    const response = await POST(req);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('enabled setup check rejects an oversize declared body', async () => {
  await enabled(unexpectedProviderCall(), async () => {
    const response = await POST(request('{}', { 'content-length': '4097' }));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('enabled setup check enforces the streamed body limit', async () => {
  await enabled(unexpectedProviderCall(), async () => {
    const response = await POST(request('x'.repeat(4097)));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('enabled setup check rejects malformed JSON without calling Comfy', async () => {
  await enabled(unexpectedProviderCall(), async () => {
    const response = await POST(request('{not-json'));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('successful setup check is uncached and makes one read-only provider request', async () => {
  const calls: string[] = [];
  await enabled(async (input, init) => {
    calls.push(String(input));
    assert.equal(String(input), COMFY_URL);
    assert.equal(init?.method, undefined);
    assert.equal(init?.redirect, 'error');
    return Response.json({ jobs: [] });
  }, async () => {
    const response = await POST(request(JSON.stringify({ address: 'https://my-deployment.run.comfy.app', key: 'not-a-real-key' })));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match((await response.json()).message, /not saved/);
  });
  assert.deepEqual(calls, [COMFY_URL]);
});

test('failed setup check returns a generic uncached response', async () => {
  await enabled(async () => new Response('provider secret', { status: 403 }), async () => {
    const response = await POST(request(JSON.stringify({ address: 'https://my-deployment.run.comfy.app', key: 'not-a-real-key' })));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const text = await response.text();
    assert.doesNotMatch(text, /provider secret|not-a-real-key/);
    assert.match(text, /no workflow was submitted/);
  });
});
