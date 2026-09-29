import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, utimes, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createStorage } from './storage.ts';
import { sweepSources, sourceText } from './retention.ts';

test('temporary sources expire by initial write time; retries do not extend retention', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'amr-report-retention-')),
  );
  try {
    const storage = await createStorage({ root });
    const expired = randomUUID(),
      recent = randomUUID(),
      saved = randomUUID();
    const bytes = Buffer.from('%PDF-1.7 synthetic only');
    for (const id of [expired, recent, saved]) await storage.put(id, bytes);
    const before = new Date(Date.now() - 60_000);
    await utimes(join(root, `${expired}.pdf`), before, before);
    await storage.put(expired, bytes);
    assert.equal(
      (await storage.list()).find((row) => row.id === expired)?.createdAt,
      before.getTime(),
    );
    await sweepSources({
      storage,
      expiresBefore: new Date(Date.now() - 30_000),
      saved: async (ids) => ids.filter((id) => id === saved),
    });
    assert.deepEqual(
      (await storage.list()).map((row) => row.id),
      [recent],
    );
    await storage.remove(saved); // A lost delete acknowledgement is safe to retry.
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cleanup failure is visible and saved text keeps exact page labels and provenance', async () => {
  const id = randomUUID();
  await assert.rejects(
    sweepSources({
      storage: {
        list: async () => [{ id, createdAt: 0 }],
        remove: async () => {
          throw new Error('delete unavailable');
        },
      },
      expiresBefore: new Date(1),
      saved: async () => [],
    }),
    /delete unavailable/,
  );
  const source = sourceText(
    {
      id,
      title: 'Synthetic source',
      sourceKind: 'synthetic',
      sha256: 'a'.repeat(64),
      bytes: 42,
      parserVersion: 'fixture-v1',
    },
    [
      { page: 1, text: '<script>synthetic</script>\nExact 20 litres' },
      { page: 2, text: '' },
    ],
  );
  assert.match(source, /SHA-256: a{64}/);
  assert.match(
    source,
    /Page 1\n<script>synthetic<\/script>\nExact 20 litres\n\nPage 2\n/,
  );
});
