import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { test } from 'node:test';
import { createStorage } from './storage.ts';
import { syntheticPdf } from './testing/fixtures.ts';

const root = process.env.REPORT_TEST_STORAGE;
if (!root || !/\/amr_[a-f0-9]{12}\/test$/.test(root))
  throw new Error('Use the granted report test storage.');
test('immutable owned source round-trips with exact hash and private permissions', async () => {
  const storage = await createStorage({ root });
  const id = randomUUID();
  const bytes = syntheticPdf([['Synthetic retained source']]);
  const saved = await storage.put(id, bytes);
  assert.equal(saved.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await storage.get(id, saved.sha256), bytes);
  assert.deepEqual(await storage.put(id, bytes), saved);
  await assert.rejects(
    storage.put(id, syntheticPdf([['Changed source']])),
    /immutable/,
  );
  await assert.rejects(storage.get('../outside', saved.sha256), /identifier/);
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  assert.equal((await stat(`${root}/${id}.pdf`)).mode & 0o777, 0o600);
});

test('storage rejects symlinks and detects source tampering', async () => {
  const { symlink, writeFile, unlink } = await import('node:fs/promises');
  const storage = await createStorage({ root });
  const id = randomUUID();
  const bytes = syntheticPdf([['Synthetic tamper probe']]);
  const result = await storage.put(id, bytes);
  const fake = randomUUID();
  await symlink(`${root}/${id}.pdf`, `${root}/${fake}.pdf`);
  try {
    await assert.rejects(storage.get(fake, result.sha256));
  } finally {
    await unlink(`${root}/${fake}.pdf`);
  }
  await writeFile(`${root}/${id}.pdf`, 'synthetic tamper');
  await assert.rejects(storage.get(id, result.sha256), /hash/);
  await unlink(`${root}/${id}.pdf`);
});
