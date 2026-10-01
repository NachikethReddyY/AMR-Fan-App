import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { boundedTransport } from './transport.ts';
import { createAi } from './index.ts';

async function fixture(handle: (res: ServerResponse) => void) {
  let calls = 0;
  const server = createServer((_, res) => {
    calls += 1;
    handle(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    url: `http://127.0.0.1:${address.port}`,
    calls: () => calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

test('timeout and busy response bound calls without a queue or automatic retry', async () => {
  const f = await fixture(() => {});
  try {
    const post = boundedTransport(f.url, 40);
    const pending = post({ task: 'fixture' });
    assert.deepEqual(await post({ task: 'fixture' }), {
      ok: false,
      reason: 'busy',
    });
    assert.deepEqual(await pending, { ok: false, reason: 'timeout' });
    assert.equal(f.calls(), 1);
    assert.deepEqual(await post({ task: 'fixture' }), {
      ok: false,
      reason: 'timeout',
    });
    assert.equal(f.calls(), 2);
  } finally {
    await f.close();
  }
});

for (const [name, handler, reason] of [
  [
    'malformed',
    (r: ServerResponse) => {
      r.setHeader('Content-Type', 'application/json');
      r.end('{');
    },
    'invalid-output',
  ],
  [
    'oversized chunked',
    (r: ServerResponse) => {
      r.setHeader('Content-Type', 'application/json');
      r.write(' '.repeat(65537));
      r.end();
    },
    'invalid-output',
  ],
  [
    'oversized declared',
    (r: ServerResponse) => {
      r.setHeader('Content-Type', 'application/json');
      r.setHeader('Content-Length', 999999);
      r.flushHeaders();
    },
    'invalid-output',
  ],
  [
    'wrong type',
    (r: ServerResponse) => r.end('<html>no</html>'),
    'invalid-output',
  ],
  [
    '429',
    (r: ServerResponse) => {
      r.statusCode = 429;
      r.end('rate limited');
    },
    'provider',
  ],
  [
    '500',
    (r: ServerResponse) => {
      r.statusCode = 500;
      r.end('provider details must not escape');
    },
    'provider',
  ],
  [
    'redirect',
    (r: ServerResponse) => {
      r.statusCode = 302;
      r.setHeader('Location', 'http://127.0.0.1:1/forbidden');
      r.end();
    },
    'provider',
  ],
] as const) {
  test(`${name} is a bounded failure`, async () => {
    const f = await fixture(handler);
    try {
      assert.deepEqual(await boundedTransport(f.url, 300)({}), {
        ok: false,
        reason,
      });
      assert.equal(f.calls(), 1);
    } finally {
      await f.close();
    }
  });
}

test('oversized outgoing request is rejected without traffic', async () => {
  const f = await fixture(() => {});
  try {
    assert.deepEqual(
      await boundedTransport(f.url, 100)({ data: 'a'.repeat(60001) }),
      { ok: false, reason: 'invalid-input' },
    );
    assert.equal(f.calls(), 0);
  } finally {
    await f.close();
  }
});

test('configuration only accepts the assigned loopback protocol and never reflects credentials', () => {
  for (const url of [
    'https://example.com/v1',
    'http://127.0.0.1.evil/v1',
    'http://user:secret@127.0.0.1/v1',
    'http://127.0.0.1/v1?key=secret',
  ]) {
    assert.throws(
      () => createAi({ LUNA_BASE_URL: url, LUNA_API_KEY: 'secret' }),
      /^Error: Invalid AI server configuration$/,
    );
  }
  assert.throws(
    () => createAi({ LUNA_API_KEY: 'secret\nheader' }),
    /^Error: Invalid AI server configuration$/,
  );
});

test('Laya combines missing annotations once, validates answers and preserves human review', async () => {
  const f = await fixture((r) => {
    r.setHeader('Content-Type', 'application/json');
    r.end(
      JSON.stringify({
        answers: {
          tag: { choice: 'question', confidence: 0.99 },
          moderation: { choice: 'none' },
        },
        approved: true,
      }),
    );
  });
  try {
    const ai = createAi({ LAYA_BASE_URL: f.url, LAYA_ADVISORY_ENABLED: true });
    const r = await ai.adviseSubmission({
      text: 'What is your favourite track?',
      tag: null,
      moderation: null,
    });
    assert.equal(r.kind, 'advisory');
    assert.equal(r.reviewRequired, true);
    assert.equal('approved' in r, false);
    assert.equal(f.calls(), 1);
    assert.equal(
      (
        await ai.adviseSubmission({
          text: 'Already reviewed',
          tag: 'question',
          moderation: 'none',
        })
      ).kind,
      'skipped',
    );
    assert.equal(f.calls(), 1);
  } finally {
    await f.close();
  }
});

test('Laya invalid choice leaves admin review open', async () => {
  const f = await fixture((r) => {
    r.setHeader('Content-Type', 'application/json');
    r.end(
      JSON.stringify({
        answers: { category: { choice: 'approve-and-award' } },
      }),
    );
  });
  try {
    const ai = createAi({ LAYA_BASE_URL: f.url, LAYA_ADVISORY_ENABLED: true });
    assert.deepEqual(
      await ai.classifyReport({ text: 'Report text', category: null }),
      { kind: 'unavailable', reason: 'invalid-output', reviewRequired: true },
    );
  } finally {
    await f.close();
  }
});
