import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { parseSubmissionInput } from './contracts.ts';
import { ApiError } from '../accounts/types.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { serveSubmissionAdmin } from './admin.ts';

test('one paid submission accepts a question or activity as text with an optional descriptive tag', () => {
  const requestId = randomUUID();
  assert.deepEqual(
    parseSubmissionInput({
      requestId,
      text: '  What inspired your race preparation?  ',
      confirmedFee: 500,
    }),
    {
      requestId,
      text: 'What inspired your race preparation?',
      tag: null,
      confirmedFee: 500,
      resubmissionOf: null,
    },
  );
  for (const tag of ['question', 'activity', 'other']) {
    const result = parseSubmissionInput({
      requestId,
      text: 'Fan suggestion',
      tag,
      confirmedFee: 500,
    });
    assert.equal(result.tag, tag);
    assert.equal(result.confirmedFee, 500);
  }
});

test('submission fields are bounded and reject forged authority, uploads and unconfirmed fees', () => {
  const input = {
    requestId: randomUUID(),
    text: 'A question',
    confirmedFee: 500,
  };
  for (const invalid of [
    { ...input, text: '' },
    { ...input, text: ' '.repeat(10) },
    { ...input, text: 'x'.repeat(1601) },
    { ...input, text: 'question\u0000' },
    { ...input, text: 'question\u001b' },
    { ...input, text: 'question\u202e' },
    { ...input, tag: 'vip' },
    { ...input, confirmedFee: 0 },
    { ...input, confirmedFee: '500' },
    { ...input, requestId: 'not-a-uuid' },
    { ...input, ownerId: randomUUID() },
    { ...input, role: 'admin' },
    { ...input, balance: 1000 },
    { ...input, status: 'approved' },
    { ...input, rankingPoints: 500 },
    { ...input, upload: 'https://example.test/file' },
  ])
    assert.throws(
      () => parseSubmissionInput(invalid),
      (error) => error instanceof ApiError && error.status === 400,
    );
  const text = '<script>alert("test")</script>\nLine two';
  assert.equal(parseSubmissionInput({ ...input, text }).text, text);
  assert.equal(
    parseSubmissionInput({ ...input, text: 'x'.repeat(1600) }).text.length,
    1600,
  );
});

test('owned admin assets use an explicit allowlist and a script-restricting CSP', async () => {
  const server = createServer(async (req, res) => {
    if (!(await serveSubmissionAdmin(req.url ?? '/', res))) {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const base = `http://127.0.0.1:${address.port}`;
    const page = await fetch(`${base}/admin/submissions/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /^text\/html/);
    assert.equal(
      page.headers.get('content-security-policy'),
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    assert.match(await page.text(), /Submission review/);
    const script = await fetch(`${base}/admin/submissions/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type') ?? '', /^text\/javascript/);
    await script.text();
    assert.equal(
      (await fetch(`${base}/admin/submissions/contracts.ts`)).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/admin/submissions/%2e%2e%2findex.ts`)).status,
      404,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
