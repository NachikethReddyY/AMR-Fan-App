import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createParserService } from './service.ts';
import { signJob } from '../hosted-protocol.ts';
import { PARSER_VERSION } from '../contracts.ts';
const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const privateKey = keys.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
const bytes = Buffer.from('%PDF-1.7 synthetic service protocol');

test('actual HTTP job wrapper authenticates before work, refuses replay/hash mismatch and recovers', async () => {
  let calls = 0;
  const server = createParserService({
    publicKey,
    image: 'sha256:' + 'a'.repeat(64),
    ready: true,
    parse: async () => {
      calls++;
      return {
        parserVersion: PARSER_VERSION,
        pages: [{ page: 1, text: 'Synthetic report text' }],
      };
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const request = (token: string, body = bytes) =>
    fetch(base + '/v1/parse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(body),
    });
  try {
    assert.equal((await request('forged')).status, 401);
    assert.equal(calls, 0);
    const { token, job } = signJob(bytes, privateKey);
    const response = await request(token);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).jobId, job.id);
    assert.equal((await request(token)).status, 409);
    const bad = signJob(bytes, privateKey);
    assert.equal(
      (
        await request(
          bad.token,
          Buffer.from(bytes.toString().replace('service', 'changed')),
        )
      ).status,
      400,
    );
    assert.equal(calls, 1);
    assert.equal((await request(signJob(bytes, privateKey).token)).status, 200);
    assert.equal(calls, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('unverified service refuses both readiness and PDF work', async () => {
  const server = createParserService({
    publicKey,
    image: 'sha256:' + 'a'.repeat(64),
    ready: false,
    parse: async () => {
      throw new Error('must not parse');
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    assert.equal(
      (await fetch(`http://127.0.0.1:${address.port}/ready`)).status,
      503,
    );
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${address.port}/v1/parse`, {
          method: 'POST',
        })
      ).status,
      503,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('trial is disabled by default; enabled trials accept only signed approved synthetic fixtures', async () => {
  const { trialFixtures } = await import('./trial-fixtures.ts');
  const { TRIAL_AUDIENCE } = await import('../hosted-protocol.ts');
  const fixture = trialFixtures[0].bytes;
  let calls = 0;
  for (const trial of [false, true]) {
    const server = createParserService({
      publicKey,
      image: 'sha256:' + 'a'.repeat(64),
      ready: false,
      trial,
      parse: async () => {
        calls++;
        return {
          parserVersion: PARSER_VERSION,
          pages: [{ page: 1, text: 'Synthetic trial' }],
        };
      },
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const request = (token: string, body = fixture, path = '/v1/trial') =>
      fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
        body: new Uint8Array(body),
      });
    try {
      const job = signJob(fixture, privateKey, Date.now(), TRIAL_AUDIENCE);
      if (!trial) {
        assert.equal((await request(job.token)).status, 404);
        assert.equal(calls, 0);
        continue;
      }
      assert.equal(
        (
          await request(
            signJob(fixture, privateKey, Date.now() - 61_000, TRIAL_AUDIENCE)
              .token,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            signJob(bytes, privateKey, Date.now(), TRIAL_AUDIENCE).token,
            bytes,
          )
        ).status,
        403,
      );
      assert.equal(
        (await request(signJob(fixture, privateKey).token)).status,
        401,
      );
      assert.equal(calls, 0);
      assert.equal((await request(job.token)).status, 200);
      assert.equal((await request(job.token)).status, 409);
      assert.equal(
        (
          await request(
            signJob(fixture, privateKey).token,
            fixture,
            '/v1/parse',
          )
        ).status,
        503,
      );
      assert.equal(calls, 1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});

test('one active job refuses competing work and cancellation releases the slot', async () => {
  let started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const server = createParserService({
    publicKey,
    image: 'sha256:' + 'a'.repeat(64),
    ready: true,
    parse: async (_bytes, signal) => {
      calls++;
      if (calls === 1) {
        started();
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(new Error('cancelled')),
            { once: true },
          ),
        );
      }
      return {
        parserVersion: PARSER_VERSION,
        pages: [{ page: 1, text: 'Synthetic recovery' }],
      };
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const request = (signal?: AbortSignal) =>
    fetch(`http://127.0.0.1:${address.port}/v1/parse`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${signJob(bytes, privateKey).token}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(bytes),
    });
  const abort = new AbortController();
  const first = request(abort.signal);
  try {
    await began;
    assert.equal((await request()).status, 503);
    assert.equal(calls, 1);
    abort.abort();
    await assert.rejects(first, { name: 'AbortError' });
    // Await close processing, not a guessed duration.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const recovery = await request();
    assert.equal(recovery.status, 200);
    assert.equal(calls, 2);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
