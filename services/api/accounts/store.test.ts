import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createDatabase, transaction } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount, readAccount, lockOwnedProfile } from './store.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
) {
  throw new Error(
    'Use pnpm db:run-test for this worktree disposable database.',
  );
}
const pool = createDatabase();
const identity = {
  issuer: 'https://synthetic.example.test',
  subject: `concurrent-${crypto.randomUUID()}`,
};
let principalId = '';
before(() => migrate(pool));
after(async () => {
  if (principalId)
    await pool.query('DELETE FROM app.principals WHERE id = $1', [principalId]);
  await pool.end();
});
test('concurrent first sign-ins persist one principal and one zero-balance profile per kind', async () => {
  const accounts = await Promise.all(
    Array.from({ length: 12 }, () => ensureAccount(pool, identity)),
  );
  principalId = accounts[0].id;
  assert.equal(new Set(accounts.map((a) => a.id)).size, 1);
  assert.equal(new Set(accounts.map((a) => a.profiles[0].id)).size, 1);
  assert.deepEqual(
    accounts[0].profiles.map((p) => [p.kind, p.balance]),
    [
      ['real', 0],
      ['demo', 0],
    ],
  );
  assert.equal(accounts[0].role, 'fan');
  const anotherConnection = createDatabase();
  try {
    assert.deepEqual(
      await readAccount(anotherConnection, principalId),
      accounts[0],
    );
  } finally {
    await anotherConnection.end();
  }
});
test('sign-in never resets persisted profile data or balance; ownership locks fail closed', async () => {
  const account = await ensureAccount(pool, identity);
  principalId = account.id;
  const profile = account.profiles[0];
  await pool.query('UPDATE app.profiles SET display_name = $1 WHERE id = $2', [
    'Persistent fan',
    profile.id,
  ]);
  const resumed = await ensureAccount(pool, identity);
  assert.equal(resumed.profiles[0].displayName, 'Persistent fan');
  assert.equal(resumed.profiles[0].balance, 0);
  await assert.rejects(
    transaction(pool, (client) =>
      lockOwnedProfile(client, crypto.randomUUID(), profile.id),
    ),
    { status: 404 },
  );
  await transaction(pool, async (client) => {
    assert.equal(
      (await lockOwnedProfile(client, principalId, profile.id)).id,
      profile.id,
    );
  });
});

test('owner lock serializes another transaction at the actual PostgreSQL row', async () => {
  const account = await ensureAccount(pool, identity);
  principalId = account.id;
  const first = await pool.connect();
  const second = await pool.connect();
  try {
    await first.query('BEGIN');
    await lockOwnedProfile(first, principalId, account.profiles[0].id);
    await second.query('BEGIN');
    await second.query("SET LOCAL lock_timeout = '100ms'");
    await assert.rejects(
      lockOwnedProfile(second, principalId, account.profiles[0].id),
      { code: '55P03' },
    );
    await second.query('ROLLBACK');
    await first.query('COMMIT');
    await second.query('BEGIN');
    assert.equal(
      (await lockOwnedProfile(second, principalId, account.profiles[0].id)).id,
      account.profiles[0].id,
    );
    await second.query('COMMIT');
  } finally {
    await first.query('ROLLBACK');
    await second.query('ROLLBACK');
    first.release();
    second.release();
  }
});
