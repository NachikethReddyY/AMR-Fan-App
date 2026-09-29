import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { createHostedParser } from './parser-hosted.ts';
import { signJob, verifyJob, sourceHash } from './hosted-protocol.ts';
import { PARSER_VERSION } from './contracts.ts';
const keys = generateKeyPairSync('ed25519');
const signingKey = keys.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
const publicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const verifiedImage = 'sha256:' + 'a'.repeat(64);
const bytes = Buffer.from('%PDF-1.7 synthetic protocol fixture');

test('signed jobs bind bytes, audience and bounded expiry; forged or expired jobs fail', () => {
  const { job, token } = signJob(bytes, signingKey, 1000);
  assert.equal(verifyJob(token, publicKey, 1001).sha256, sourceHash(bytes));
  assert.throws(
    () => verifyJob(token, publicKey, job.expiresAt),
    /Invalid parser job/,
  );
  assert.throws(
    () => verifyJob(token + 'x', publicKey, 1001),
    /Invalid parser job/,
  );
  assert.throws(() => verifyJob(token, publicKey, 0), /Invalid parser job/);
});

test('hosted parser refuses missing/mismatched host evidence before sending a PDF', async () => {
  let calls = 0;
  const parser = createHostedParser({
    endpoint: 'https://parser.example.invalid',
    signingKey,
    verifiedImage,
    transport: async () => {
      calls++;
      return Response.json({ ready: false });
    },
  });
  await assert.rejects(parser.parse(bytes), { status: 503 });
  assert.equal(calls, 1);
  assert.throws(() =>
    createHostedParser({
      endpoint: 'http://parser.example.invalid',
      signingKey,
      verifiedImage,
    }),
  );
  assert.throws(() =>
    createHostedParser({
      endpoint: 'https://parser.example.invalid',
      signingKey,
      verifiedImage: '',
    }),
  );
});

test('hosted parse validates association, bounds and shape and recovers without automatic retry', async () => {
  let wrongHash = true,
    calls = 0;
  const parser = createHostedParser({
    endpoint: 'https://parser.example.invalid',
    signingKey,
    verifiedImage,
    transport: async (input, init) => {
      assert.equal(init?.redirect, 'error');
      assert.equal(init?.credentials, 'omit');
      if (String(input).endsWith('/ready'))
        return Response.json({
          ready: true,
          image: verifiedImage,
          arch: 'x64',
          isolation: 'landlock-seccomp-v1',
        });
      calls++;
      const headers = new Headers(init?.headers);
      const job = verifyJob(headers.get('authorization')!.slice(7), publicKey);
      assert.equal(job.bytes, bytes.length);
      assert.deepEqual(init?.body, new Uint8Array(bytes));
      return Response.json({
        jobId: job.id,
        sha256: wrongHash ? '0'.repeat(64) : job.sha256,
        result: {
          parserVersion: PARSER_VERSION,
          pages: [{ page: 1, text: 'Synthetic 20 litres' }],
        },
      });
    },
  });
  await assert.rejects(parser.parse(bytes), { status: 503 });
  assert.equal(calls, 1);
  wrongHash = false;
  assert.equal(
    (await parser.parse(bytes)).pages[0].text,
    'Synthetic 20 litres',
  );
  assert.equal(calls, 2);
});

test('hosted parser rejects invalid page data and oversized responses without exposing contents', async () => {
  let large = false;
  const parser = createHostedParser({
    endpoint: 'https://parser.example.invalid',
    signingKey,
    verifiedImage,
    transport: async (input, init) => {
      if (String(input).endsWith('/ready'))
        return Response.json({
          ready: true,
          image: verifiedImage,
          arch: 'x64',
          isolation: 'landlock-seccomp-v1',
        });
      if (large) return new Response('x'.repeat(8 * 1024 * 1024 + 1));
      const job = verifyJob(
        new Headers(init?.headers).get('authorization')!.slice(7),
        publicKey,
      );
      return Response.json({
        jobId: job.id,
        sha256: job.sha256,
        result: {
          parserVersion: PARSER_VERSION,
          pages: [{ page: 2, text: 'Synthetic invalid page' }],
        },
      });
    },
  });
  await assert.rejects(parser.parse(bytes), { status: 422 });
  large = true;
  await assert.rejects(parser.parse(bytes), { status: 503 });
});
