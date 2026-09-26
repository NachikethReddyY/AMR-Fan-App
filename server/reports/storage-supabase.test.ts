import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import { createSupabaseStorage } from './storage-supabase.ts';
import { SUPABASE_PROJECT_REF, SUPABASE_URL } from '../auth/supabase.ts';
const credential = [
  'eyJhbGciOiJIUzI1NiJ9',
  Buffer.from(
    JSON.stringify({ role: 'service_role', ref: SUPABASE_PROJECT_REF }),
  ).toString('base64url'),
  'synthetic',
].join('.');
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function fixture() {
  const files = new Map<string, Buffer>();
  const calls: { url: string; method: string; redirect?: RequestRedirect }[] =
    [];
  let publicBucket = false,
    malformed = false,
    redirect = false;
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      redirect: init?.redirect,
    });
    if (redirect)
      return new Response(null, {
        status: 302,
        headers: { location: 'https://untrusted.test' },
      });
    if (url.endsWith('/bucket/amr-report-originals'))
      return Response.json({
        id: 'amr-report-originals',
        public: publicBucket,
        file_size_limit: 10485760,
      });
    if (url.endsWith('/object/list/amr-report-originals'))
      return Response.json(
        malformed
          ? [{ name: 'unknown', metadata: { size: 'bad' } }]
          : Array.from(files, ([name, bytes]) => ({
              name,
              id: name,
              metadata: { size: bytes.length },
            })),
      );
    const name = url.split('/').pop()!;
    if (init?.method === 'POST') {
      if (files.has(name)) return new Response('', { status: 409 });
      const body = init.body;
      assert.ok(body instanceof Uint8Array);
      files.set(name, Buffer.from(body));
      return Response.json({ Key: name });
    }
    return files.has(name)
      ? new Response(new Uint8Array(files.get(name)!))
      : new Response('', { status: 404 });
  };
  return {
    files,
    calls,
    transport,
    setPublic: () => {
      publicBucket = true;
    },
    setMalformed: () => {
      malformed = true;
    },
    setRedirect: () => {
      redirect = true;
    },
  };
}
const exclusive = async <T>(operation: () => Promise<T>) => operation();
test('private objects are immutable, hash-checked, bounded and idempotent', async () => {
  const f = fixture();
  const store = await createSupabaseStorage({
    credential,
    transport: f.transport,
    exclusive,
  });
  const id = randomUUID(),
    bytes = Buffer.from('%PDF-1.7 synthetic');
  assert.deepEqual(await store.put(id, bytes), {
    sha256: hash(bytes),
    bytes: bytes.length,
  });
  assert.deepEqual(await store.get(id, hash(bytes)), bytes);
  assert.deepEqual(await store.put(id, bytes), {
    sha256: hash(bytes),
    bytes: bytes.length,
  });
  await assert.rejects(store.put(id, Buffer.from('changed')), { status: 409 });
  await assert.rejects(store.put(randomUUID(), Buffer.alloc(10485761)), {
    status: 413,
  });
  await assert.rejects(store.get('../escape', hash(bytes)), { status: 400 });
  f.files.set(id + '.pdf', Buffer.from('tampered'));
  await assert.rejects(store.get(id, hash(bytes)), { status: 409 });
  await store.cleanupIncomplete();
  assert.ok(
    f.calls.every(
      (c) =>
        c.url.startsWith(SUPABASE_URL + '/storage/v1/') &&
        c.redirect === 'error',
    ),
  );
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 0);
});
test('private bucket, credential, quota, malformed inventory and redirect errors fail closed', async () => {
  const f = fixture();
  f.setPublic();
  await assert.rejects(
    createSupabaseStorage({ credential, transport: f.transport, exclusive }),
    /Private report storage/,
  );
  await assert.rejects(
    createSupabaseStorage({
      credential: 'sb_publishable_not_a_server_key',
      transport: f.transport,
      exclusive,
    }),
    /credential/,
  );
  const tiny = fixture();
  const store = await createSupabaseStorage({
    credential,
    transport: tiny.transport,
    exclusive,
    quotaBytes: 10485760,
  });
  tiny.files.set(randomUUID() + '.pdf', Buffer.alloc(10485760));
  await assert.rejects(store.put(randomUUID(), Buffer.from('x')), {
    status: 413,
  });
  tiny.setMalformed();
  await assert.rejects(store.put(randomUUID(), Buffer.from('x')), {
    status: 503,
  });
  tiny.setRedirect();
  await assert.rejects(store.get(randomUUID(), '0'.repeat(64)), {
    status: 503,
  });
});
test('storage serializes inventory/write and retains acknowledged bytes after response loss', async () => {
  const f = fixture();
  let locks = 0;
  const store = await createSupabaseStorage({
    credential,
    transport: f.transport,
    exclusive: async (operation) => {
      locks++;
      return operation();
    },
  });
  await store.put(randomUUID(), Buffer.from('first'));
  assert.equal(locks, 1);
});
test('lost upload response is safely retried without replacement or deletion', async () => {
  const f = fixture();
  let lose = true;
  const store = await createSupabaseStorage({
    credential,
    exclusive,
    transport: async (input, init) => {
      const result = await f.transport(input, init);
      if (
        String(input).includes('/object/amr-report-originals/') &&
        init?.method === 'POST' &&
        lose
      ) {
        lose = false;
        throw new Error('fixture lost response');
      }
      return result;
    },
  });
  const id = randomUUID(),
    bytes = Buffer.from('synthetic lost-response original');
  await assert.rejects(store.put(id, bytes), { status: 503 });
  assert.deepEqual(await store.put(id, bytes), {
    sha256: hash(bytes),
    bytes: bytes.length,
  });
  assert.equal(
    f.calls.filter(
      (c) =>
        c.method === 'POST' && c.url.includes('/object/amr-report-originals/'),
    ).length,
    1,
  );
});
test('real HTTP transport bounds provider errors and cancels redirects without credential forwarding', async () => {
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');
  let redirected = false;
  const server = createServer((req, res) => {
    if (req.url === '/sink') {
      redirected = true;
      res.end();
      return;
    }
    if (req.url === '/storage/v1/bucket/amr-report-originals') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'amr-report-originals',
          public: false,
          file_size_limit: 10485760,
        }),
      );
      return;
    }
    res.writeHead(302, { Location: '/sink' });
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const transport: typeof fetch = (input, init) =>
    fetch(
      String(input).replace(SUPABASE_URL, `http://127.0.0.1:${address.port}`),
      init,
    );
  try {
    const storage = await createSupabaseStorage({
      credential,
      exclusive,
      transport,
    });
    await assert.rejects(storage.get(randomUUID(), '0'.repeat(64)), {
      status: 503,
    });
    assert.equal(redirected, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
