import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createParser } from './parser.ts';
import { syntheticPdf } from './testing/fixtures.ts';

const parser = createParser();
test('real PDF parsing retains multi-page table, multiline and Unicode source text', async () => {
  const result = await parser.parse(
    syntheticPdf([
      [
        'Synthetic sustainability report',
        'Metric      Result      Unit      Period',
        'Water       1,250       litres    2025',
        'Method: meter readings',
        'Unicode: 水 café CO₂',
      ],
      [
        'Synthetic second page',
        'Energy result 42 kWh in 2025.',
        'Not a real team report.',
      ],
    ]),
  );
  assert.equal(result.pages.length, 2);
  assert.match(result.pages[0]?.text ?? '', /Water\s+1,250\s+litres\s+2025/);
  assert.match(
    result.pages[0]?.text ?? '',
    /Method: meter readings\nUnicode: 水 café CO₂/,
  );
  assert.match(result.pages[1]?.text ?? '', /Energy result 42 kWh in 2025/);
  assert.equal(result.parserVersion, 'amr-pdf-text-v1/pdfjs-dist-6.3.289');
});

test('malformed, blank and excessive-page PDFs fail explicitly', async () => {
  await assert.rejects(
    parser.parse(Buffer.from('%PDF-1.7\nnot a pdf')),
    /could not be parsed/,
  );
  await assert.rejects(parser.parse(syntheticPdf([[]])), /text-unavailable/);
  await assert.rejects(
    parser.parse(
      syntheticPdf(Array.from({ length: 101 }, () => ['Synthetic page'])),
    ),
    /page-limit/,
  );
  await assert.rejects(
    parser.parse(Buffer.alloc(10 * 1024 * 1024 + 1)),
    /10 MiB/,
  );
});

test('parser timeout and busy rejection release the single parser slot', async () => {
  const timed = createParser({ timeoutMs: 1 });
  const first = timed.parse(syntheticPdf([['Synthetic timed report']]));
  await assert.rejects(
    parser.parse(syntheticPdf([['Second report']])),
    /Another report/,
  );
  await assert.rejects(first, /timed out/);
  const result = await parser.parse(
    syntheticPdf([['Synthetic recovery report']]),
  );
  assert.equal(result.pages[0]?.text, 'Synthetic recovery report');
});

test('excessive parsed text fails without truncation', async () => {
  const result = parser.parse(
    syntheticPdf(
      Array.from({ length: 100 }, () => ['A'.repeat(11000)]),
      { fontSize: 0.01, lineStep: 0.01 },
    ),
  );
  await assert.rejects(result, /text-limit|memory limit|timed out/);
});

test('the parser sandbox denies a real loopback network connection', async () => {
  const { spawn } = await import('node:child_process');
  const { createServer } = await import('node:net');
  const server = createServer((socket) => socket.destroy());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const child = spawn(
      '/usr/bin/sandbox-exec',
      [
        '-p',
        '(version 1) (allow default) (deny network*) (deny file-write*)',
        process.execPath,
        '-e',
        `const s=require('node:net').connect(${address.port},'127.0.0.1');s.on('connect',()=>process.exit(2));s.on('error',e=>process.exit(e.code==='EPERM'?0:3));setTimeout(()=>process.exit(4),1000);`,
      ],
      { stdio: 'ignore', env: { PATH: '/usr/bin:/bin' } },
    );
    const [code] = await once(child, 'close');
    assert.equal(code, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
