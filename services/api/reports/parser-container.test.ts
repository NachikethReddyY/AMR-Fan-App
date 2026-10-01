import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createParser } from './parser.ts';
import { syntheticPdf } from './testing/fixtures.ts';

const image = process.env.REPORT_PARSER_IMAGE;
if (!image)
  throw new Error(
    'Build the owned parser image and set REPORT_PARSER_IMAGE to its immutable ID.',
  );
const execute = promisify(execFile);
test('configured offline parser extracts real PDF and recovers after a child deadline', async () => {
  const pdf = syntheticPdf([
    ['Synthetic container result 42 kWh in 2025.', 'Unicode: 水 café CO₂'],
    ['Second retained page'],
  ]);
  const parser = createParser({ dockerImage: image });
  const first = await parser.parse(pdf);
  assert.equal(first.pages.length, 2);
  assert.match(first.pages[0].text, /Unicode: 水 café CO₂/);
  await assert.rejects(
    createParser({ dockerImage: image, timeoutMs: 1 }).parse(pdf),
    /timed out/,
  );
  assert.deepEqual(await parser.parse(pdf), first);
});
test('missing immutable image fails closed without pulling', async () => {
  await assert.rejects(
    createParser({ dockerImage: 'sha256:' + '0'.repeat(64) }).parse(
      syntheticPdf([['Synthetic']]),
    ),
    /not ready/,
  );
});
test('actual parser job has cgroup limits, no network or mounts and is removed', async () => {
  const parser = createParser({ dockerImage: image });
  const parsing = parser.parse(
    syntheticPdf(
      Array.from({ length: 100 }, () => ['A'.repeat(10000)]),
      { fontSize: 0.01, lineStep: 0.01 },
    ),
  );
  const settled = parsing.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
  let inspected: Record<string, any> | undefined;
  for (let i = 0; i < 30; i++) {
    const result = await execute(
      'docker',
      ['ps', '--quiet', '--filter', `ancestor=${image}`],
      { timeout: 3000, maxBuffer: 4096 },
    );
    const id = result.stdout.trim();
    if (id) {
      inspected = JSON.parse(
        (
          await execute('docker', ['inspect', id], {
            timeout: 3000,
            maxBuffer: 32768,
          })
        ).stdout,
      )[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const result = await settled;
  assert.ok(
    inspected,
    'Observe the actual parser job, not an unrelated fixture container.',
  );
  assert.equal(inspected.HostConfig.Memory, 256 * 1024 * 1024);
  assert.equal(inspected.HostConfig.MemorySwap, 256 * 1024 * 1024);
  assert.equal(inspected.HostConfig.PidsLimit, 64);
  assert.equal(inspected.HostConfig.NanoCpus, 1e9);
  assert.equal(inspected.HostConfig.NetworkMode, 'none');
  assert.equal(inspected.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspected.HostConfig.Privileged, false);
  assert.deepEqual(inspected.Mounts, []);
  assert.equal(inspected.Config.User, 'node');
  assert.equal(result.ok, true);
  await assert.rejects(
    execute('docker', ['inspect', inspected.Id], {
      timeout: 3000,
      maxBuffer: 4096,
    }),
  );
});
