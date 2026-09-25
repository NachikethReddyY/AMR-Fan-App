import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { createDatabase, transaction } from './index.ts';
import { migrate } from './migrate.ts';
import { seedLocal } from './seed.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  !process.env.DATABASE_URL ||
  !/^\/amr_[a-f0-9]{12}_test$/.test(new URL(process.env.DATABASE_URL).pathname)
) {
  throw new Error(
    'Integration tests require this worktree disposable test database. Use pnpm db:test.',
  );
}
const pool = createDatabase();
before(async () => {
  await migrate(pool);
  await seedLocal(pool);
});
after(async () => {
  await pool.end();
});

test('real PostgreSQL migrations and synthetic seed are repeatable', async () => {
  const before = await pool.query(
    'SELECT name, checksum, applied_at FROM public.schema_migrations ORDER BY name',
  );
  await Promise.all([migrate(pool), migrate(pool)]);
  await seedLocal(pool);
  await seedLocal(pool);
  const after = await pool.query(
    'SELECT name, checksum, applied_at FROM public.schema_migrations ORDER BY name',
  );
  assert.deepEqual(after.rows, before.rows);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM local_fixture.probes WHERE name = 'synthetic'",
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'app' AND tablename = 'probes'",
      )
    ).rows[0].count,
    0,
  );
});

test('rollback removes every partial write and returns the connection to the pool', async () => {
  await assert.rejects(
    transaction(pool, async (client) => {
      await client.query(
        "INSERT INTO local_fixture.probes VALUES ('rollback', 1, 'Synthetic rollback probe')",
      );
      await client.query(
        "INSERT INTO local_fixture.probes VALUES ('rollback', 2, 'Duplicate forces rollback')",
      );
    }),
    { code: '23505' },
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM local_fixture.probes WHERE name = 'rollback'",
      )
    ).rows[0].count,
    0,
  );
  assert.equal(pool.idleCount, pool.totalCount);
});

test('concurrent transactions serialize a real database write without lost updates', async () => {
  await pool.query(
    "INSERT INTO local_fixture.probes VALUES ('concurrency', 0, 'Synthetic counter, not points') ON CONFLICT (name) DO UPDATE SET value = 0",
  );
  try {
    await Promise.all(
      Array.from({ length: 12 }, () =>
        transaction(pool, async (client) => {
          await client.query(
            "UPDATE local_fixture.probes SET value = value + 1 WHERE name = 'concurrency'",
          );
        }),
      ),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT value FROM local_fixture.probes WHERE name = 'concurrency'",
        )
      ).rows[0].value,
      12,
    );
  } finally {
    await pool.query(
      "DELETE FROM local_fixture.probes WHERE name = 'concurrency'",
    );
  }
});

test('changed applied migration is rejected without changing its recorded checksum', async () => {
  const row = (
    await pool.query(
      'SELECT name, checksum FROM public.schema_migrations ORDER BY name LIMIT 1',
    )
  ).rows[0];
  assert.ok(row);
  try {
    await pool.query(
      'UPDATE public.schema_migrations SET checksum = $1 WHERE name = $2',
      ['deliberately-invalid-fixture', row.name],
    );
    await assert.rejects(migrate(pool), /Applied migration changed/);
  } finally {
    await pool.query(
      'UPDATE public.schema_migrations SET checksum = $1 WHERE name = $2',
      [row.checksum, row.name],
    );
  }
});

test('local role cannot create roles/databases or use superuser authority', async () => {
  const role = (
    await pool.query(
      'SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = current_user',
    )
  ).rows[0];
  assert.deepEqual(role, {
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
  });
  await assert.rejects(pool.query('CREATE ROLE forbidden_infra_fixture'), {
    code: '42501',
  });
});

test('production seed is refused before touching data', async () => {
  await assert.rejects(
    seedLocal(pool, { NODE_ENV: 'production' }),
    /explicit development or test/,
  );
});

test('a checkout missing an applied migration refuses to continue', async () => {
  await pool.query(
    "INSERT INTO public.schema_migrations(name, checksum) VALUES ('9999_peer_fixture.sql', 'synthetic')",
  );
  try {
    await assert.rejects(migrate(pool), /absent from this checkout/);
  } finally {
    await pool.query(
      "DELETE FROM public.schema_migrations WHERE name = '9999_peer_fixture.sql'",
    );
  }
});

test('CLI status executes through absolute paths and same-inode casing aliases', async (t) => {
  const script = fileURLToPath(
    new URL('../../scripts/local-db.mjs', import.meta.url),
  );
  function status(path: string) {
    const result = spawnSync(process.execPath, [path, 'status', '--test'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(
      result.stdout.trim(),
      '',
      'CLI must execute and return status JSON, not silently exit.',
    );
    const value: unknown = JSON.parse(result.stdout);
    assert.ok(value && typeof value === 'object');
    assert.equal(
      Reflect.get(value, 'database'),
      new URL(process.env.DATABASE_URL ?? '').pathname.slice(1),
    );
    assert.equal(
      Reflect.get(value, 'role'),
      new URL(process.env.DATABASE_URL ?? '').username,
    );
    assert.match(String(Reflect.get(value, 'version')), /^PostgreSQL /);
    return value;
  }
  const expected = status(script);
  await t.test('casing alias executes the real status command', (t) => {
    const alias = fileURLToPath(
      new URL('../../SCRIPTS/local-db.mjs', import.meta.url),
    );
    if (!existsSync(alias)) return t.skip('Filesystem is case-sensitive.');
    assert.equal(statSync(script).ino, statSync(alias).ino);
    assert.deepEqual(status(alias), expected);
  });
});
