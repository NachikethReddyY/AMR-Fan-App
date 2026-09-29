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
              created_at: '2026-09-26T00:00:00Z',
              metadata: { size: bytes.length },
            })),
      );
    if (init?.method === 'DELETE') {
      const body = JSON.parse(String(init.body));
      for (const name of body.prefixes) files.delete(name);
      return Response.json([]);
    }
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

test('real HTTP missing-key envelopes allow first upload; other errors never upload', async (t) => {
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');
  const missing = { statusCode: '404', code: 'NoSuchKey', error: 'not_found' };
  let status = 404,
    body = '',
    declaredLength: number | undefined;
  let uploads = 0,
    lists = 0;
  const files = new Map<string, Buffer>();
  const server = createServer(async (req, res) => {
    const path = req.url ?? '';
    const json = (value: unknown) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    };
    if (path === '/storage/v1/bucket/amr-report-originals')
      return json({
        id: 'amr-report-originals',
        public: false,
        file_size_limit: 10485760,
      });
    if (path === '/storage/v1/object/list/amr-report-originals') {
      lists++;
      return json(
        Array.from(files, ([name, bytes]) => ({
          name,
          metadata: { size: bytes.length },
        })),
      );
    }
    const name = path.split('/').pop()!;
    if (req.method === 'POST') {
      uploads++;
      assert.equal(req.headers['x-upsert'], 'false');
      assert.equal(files.has(name), false);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      files.set(name, Buffer.concat(chunks));
      return json({ Key: name });
    }
    if (files.has(name)) return res.end(files.get(name));
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    if (declaredLength !== undefined)
      res.setHeader('Content-Length', declaredLength);
    // Explicit write exercises the byte limit without Content-Length as well.
    res.write(body);
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
    const store = await createSupabaseStorage({
      credential,
      exclusive,
      transport,
    });
    for (const [name, wire, envelope] of [
      ['wire404', 404, ''],
      ['legacy error', 400, JSON.stringify(missing)],
      [
        'numeric semantic status',
        400,
        JSON.stringify({ ...missing, statusCode: 404 }),
      ],
      [
        'current error code',
        400,
        JSON.stringify({ ...missing, error: 'NoSuchKey' }),
      ],
    ] as const) {
      await t.test(name, async () => {
        status = wire;
        body = envelope;
        files.clear();
        uploads = 0;
        lists = 0;
        const id = randomUUID(),
          bytes = Buffer.from('%PDF-1.7 synthetic');
        assert.deepEqual(await store.put(id, bytes), {
          sha256: hash(bytes),
          bytes: bytes.length,
        });
        assert.deepEqual(await store.get(id, hash(bytes)), bytes);
        await store.put(id, bytes);
        await assert.rejects(store.put(id, Buffer.from('changed')), {
          status: 409,
        });
        assert.equal(uploads, 1);
        assert.equal(lists, 1);
        await assert.rejects(store.get(randomUUID(), hash(bytes)), {
          status: 404,
        });
      });
    }
    const oversized = JSON.stringify({
      ...missing,
      message: 'x'.repeat(16384),
    });
    for (const [name, wire, envelope, length] of [
      [
        'unrelated400',
        400,
        JSON.stringify({ error: 'InvalidRequest' }),
        undefined,
      ],
      [
        'forbidden400',
        400,
        JSON.stringify({ ...missing, statusCode: '403', code: 'AccessDenied' }),
        undefined,
      ],
      ['wire403 cannot masquerade', 403, JSON.stringify(missing), undefined],
      [
        'wrong semantic status',
        400,
        JSON.stringify({ ...missing, statusCode: 403 }),
        undefined,
      ],
      [
        'wrong error',
        400,
        JSON.stringify({ ...missing, error: 'AccessDenied' }),
        undefined,
      ],
      [
        'missing code',
        400,
        JSON.stringify({ statusCode: '404', error: 'not_found' }),
        undefined,
      ],
      [
        'bucket absence',
        400,
        JSON.stringify({ ...missing, code: 'NoSuchBucket' }),
        undefined,
      ],
      ['malformed', 400, '{', undefined],
      ['null', 400, 'null', undefined],
      ['array', 400, JSON.stringify([missing]), undefined],
      ['oversized streamed', 400, oversized, undefined],
      ['oversized declared', 400, oversized, Buffer.byteLength(oversized)],
    ] as const) {
      await t.test(name, async () => {
        status = wire;
        body = envelope;
        declaredLength = length;
        files.clear();
        uploads = 0;
        lists = 0;
        await assert.rejects(
          store.put(randomUUID(), Buffer.from('synthetic')),
          {
            status: 503,
            message: 'Private report storage is unavailable.',
          },
        );
        assert.equal(uploads, 0);
        assert.equal(lists, 0);
      });
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('legacy source inventory retains initial timestamp and deletion is bounded and idempotent', async () => {
  const f = fixture();
  const store = await createSupabaseStorage({
    credential,
    exclusive,
    transport: f.transport,
  });
  const id = randomUUID();
  await store.put(id, Buffer.from('%PDF-1.7 synthetic cleanup'));
  assert.deepEqual(await store.list(), [
    { id, createdAt: Date.parse('2026-09-26T00:00:00Z') },
  ]);
  await store.remove(id);
  await store.remove(id);
  assert.equal(f.files.size, 0);
  await assert.rejects(store.remove('../foreign'), { status: 400 });
  f.setMalformed();
  await assert.rejects(store.list(), { status: 503 });
});

test('cleanup reaches expired and saved originals beyond1000 without deletion shifting offsets', async () => {
  const { sweepSources } = await import('./retention.ts');
  const entries = new Map(
    Array.from({ length: 2005 }, (_, index) => {
      const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
      return [
        id + '.pdf',
        { id, createdAt: index === 0 || index >= 2000 ? 0 : 10000 },
      ] as const;
    }),
  );
  const savedId = entries.get('00000000-0000-4000-8000-0000000007cf.pdf')!.id;
  const offsets: number[] = [];
  let deleting = false;
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/bucket/amr-report-originals'))
      return Response.json({
        id: 'amr-report-originals',
        public: false,
        file_size_limit: 10485760,
      });
    if (url.endsWith('/object/list/amr-report-originals')) {
      assert.equal(
        deleting,
        false,
        'snapshot must finish before deletion changes offsets',
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.limit, 1000);
      assert.deepEqual(body.sortBy, { column: 'name', order: 'asc' });
      offsets.push(body.offset);
      return Response.json(
        [...entries]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(body.offset, body.offset + body.limit)
          .map(([name, entry]) => ({
            name,
            created_at: new Date(entry.createdAt).toISOString(),
          })),
      );
    }
    if (init?.method === 'DELETE') {
      deleting = true;
      for (const name of JSON.parse(String(init.body)).prefixes)
        entries.delete(name);
      return Response.json([]);
    }
    return new Response(null, {
      status: entries.has(url.split('/').pop()!) ? 200 : 404,
    });
  };
  const storage = await createSupabaseStorage({
    credential,
    exclusive,
    transport,
  });
  await sweepSources({
    storage,
    expiresBefore: new Date(5000),
    saved: async (ids) => ids.filter((id) => id === savedId),
  });
  assert.deepEqual(offsets, [0, 1000, 2000]);
  assert.equal(entries.size, 1998);
  assert.ok(
    [...entries.values()].every(
      (entry) => entry.createdAt > 5000 && entry.id !== savedId,
    ),
  );
});

test('incomplete or nonprogressing inventory fails before cleanup deletes anything', async (t) => {
  const { sweepSources } = await import('./retention.ts');
  const page = Array.from({ length: 1000 }, (_, index) => ({
    name: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}.pdf`,
    created_at: '2026-01-01T00:00:00Z',
  }));
  for (const failure of ['repeated page', 'provider failure'] as const) {
    await t.test(failure, async () => {
      let lists = 0,
        deletes = 0;
      let deadline: AbortSignal | null | undefined;
      const transport: typeof fetch = async (input, init) => {
        if (String(input).endsWith('/bucket/amr-report-originals'))
          return Response.json({
            id: 'amr-report-originals',
            public: false,
            file_size_limit: 10485760,
          });
        if (init?.method === 'DELETE') {
          deletes++;
          return Response.json([]);
        }
        lists++;
        if (lists === 1) deadline = init?.signal;
        else
          assert.equal(init?.signal, deadline, 'all pages share one deadline');
        return lists === 1 || failure === 'repeated page'
          ? Response.json(page)
          : new Response(null, { status: 503 });
      };
      const storage = await createSupabaseStorage({
        credential,
        exclusive,
        transport,
      });
      await assert.rejects(
        sweepSources({
          storage,
          expiresBefore: new Date('2026-02-01'),
          saved: async (ids) => ids,
        }),
        { status: 503 },
      );
      assert.equal(lists, 2);
      assert.equal(deletes, 0);
    });
  }
});
