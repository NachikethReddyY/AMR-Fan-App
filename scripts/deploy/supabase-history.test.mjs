import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { bootstrapDatabase } from './supabase-database.mjs';

const directory = new URL('../../server/database/migrations/', import.meta.url);
const history = await Promise.all(
  (await readdir(directory))
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort()
    .map(async (name) => ({
      name,
      checksum: createHash('sha256')
        .update(await readFile(new URL(name, directory)))
        .digest('hex'),
    })),
);

// These malformed histories must fail before any grant or DDL query.
for (const [name, invalid] of [
  ['too short', history.slice(0, 7)],
  ['missing first entry', history.slice(1)],
  ['missing middle entry', history.filter((_, index) => index !== 4)],
  [
    'changed checksum',
    history.map((row, index) =>
      index === 3 ? { ...row, checksum: '0'.repeat(64) } : row,
    ),
  ],
  [
    'unknown suffix',
    [...history, { name: '9999_unknown.sql', checksum: '0'.repeat(64) }],
  ],
  ['misordered entries', [history[1], history[0], ...history.slice(2)]],
]) {
  test(`refuses ${name} under the transaction lock without mutation`, async () => {
    const queries = [];
    let released = false;
    const client = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes("to_regnamespace('app')"))
          return { rows: [{ app: true, ledger: true, roles: 2 }] };
        if (sql.startsWith('SELECT name,checksum')) return { rows: invalid };
        if (
          [
            'BEGIN',
            'SELECT pg_advisory_xact_lock(48136291)',
            'ROLLBACK',
          ].includes(sql)
        )
          return { rows: [] };
        throw new Error(`Unexpected query after invalid history: ${sql}`);
      },
      release() {
        released = true;
      },
    };
    await assert.rejects(
      bootstrapDatabase({ connect: async () => client }, 'x'.repeat(48)),
      /Migration checksum collision/,
    );
    assert.equal(queries[0], 'BEGIN');
    assert.equal(queries[1], 'SELECT pg_advisory_xact_lock(48136291)');
    assert.equal(queries.at(-1), 'ROLLBACK');
    assert.equal(released, true);
  });
}

for (const count of [8, 9, 10, 11]) {
  test(`accepts exact retained prefix ${count} before checking privileges`, async () => {
    const checked = new Error('Reached privilege validation');
    const queries = [];
    const client = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes("to_regnamespace('app')"))
          return { rows: [{ app: true, ledger: true, roles: 2 }] };
        if (sql.startsWith('SELECT name,checksum'))
          return { rows: history.slice(0, count) };
        if (sql.includes('has_database_privilege')) throw checked;
        if (
          [
            'BEGIN',
            'SELECT pg_advisory_xact_lock(48136291)',
            'ROLLBACK',
          ].includes(sql)
        )
          return { rows: [] };
        throw new Error(`Unexpected query: ${sql}`);
      },
      release() {},
    };
    await assert.rejects(
      bootstrapDatabase({ connect: async () => client }, 'x'.repeat(48)),
      (error) => error === checked,
    );
    assert.equal(queries.at(-1), 'ROLLBACK');
  });
}

test('refuses retained participation ACL drift before applying photo DDL', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push(sql);
      if (sql.includes("to_regnamespace('app')"))
        return { rows: [{ app: true, ledger: true, roles: 2 }] };
      if (sql.startsWith('SELECT name,checksum'))
        return { rows: history.slice(0, 9) };
      if (sql.includes('has_database_privilege'))
        return { rows: [{ create: false }] };
      if (sql.includes("'app.principals','role'"))
        return {
          rows: [{ role: false, assignments: false, public_create: false }],
        };
      if (sql.includes('SELECT rolname,rolcanlogin'))
        return {
          rows: ['amr_migration_owner', 'amr_api'].map((rolname) => ({
            rolname,
            rolcanlogin: rolname === 'amr_api',
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
          })),
        };
      if (sql.includes('FROM pg_auth_members'))
        return { rowCount: 0, rows: [] };
      if (sql.includes('SELECT pg_get_userbyid(n.nspowner)'))
        return { rows: [{ owner: 'amr_migration_owner' }] };
      if (sql.startsWith('SELECT 1 FROM pg_roles'))
        return { rowCount: values[0] === 'amr_api' ? 1 : 0, rows: [] };
      if (sql.includes('has_schema_privilege'))
        return { rows: [{ usage: true, create: false, ledger: false }] };
      if (
        sql.includes('has_table_privilege') &&
        values[1] === 'app.fan_submission_contributions'
      )
        return { rows: [{ read: true, insert: true, elevated: true }] };
      if (
        [
          'BEGIN',
          'SELECT pg_advisory_xact_lock(48136291)',
          'ROLLBACK',
        ].includes(sql)
      )
        return { rows: [] };
      throw new Error(`Unexpected mutation or query: ${sql}`);
    },
    release() {},
  };
  await assert.rejects(
    bootstrapDatabase({ connect: async () => client }, 'x'.repeat(48)),
    /Participation privilege collision/,
  );
  assert.ok(
    queries.every(
      (sql) =>
        !sql.includes('CREATE TABLE') &&
        !sql.includes('GRANT ') &&
        !sql.startsWith('SET LOCAL ROLE'),
    ),
  );
  assert.equal(queries.at(-1), 'ROLLBACK');
});

for (const options of [
  undefined,
  {},
  { aiBudgetInitialization: true },
  { aiBudgetInitialization: 'reviewed-liability-import' },
]) {
  test(`fresh budget refuses unverified initialization ${JSON.stringify(options)}`, async () => {
    const queries = [];
    const client = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes("to_regnamespace('app')"))
          return { rows: [{ app: false, ledger: false, roles: 0 }] };
        if (
          [
            'BEGIN',
            'SELECT pg_advisory_xact_lock(48136291)',
            'ROLLBACK',
          ].includes(sql)
        )
          return { rows: [] };
        throw new Error(`Unexpected mutation: ${sql}`);
      },
      release() {},
    };
    await assert.rejects(
      bootstrapDatabase(
        { connect: async () => client },
        'x'.repeat(48),
        options,
      ),
      /AI budget initialization requires/,
    );
    assert.equal(queries.at(-1), 'ROLLBACK');
    assert.equal(queries.length, 4);
  });
}

for (const targetMigration of [
  '0009_submission_participation.sql',
  '0012_future.sql',
  10,
  null,
  '',
]) {
  test(`rejects unsupported target ${JSON.stringify(targetMigration)} before connecting`, async () => {
    await assert.rejects(
      bootstrapDatabase(
        {
          connect() {
            throw new Error('Connected unexpectedly');
          },
        },
        'x'.repeat(48),
        { targetMigration },
      ),
      /Invalid migration target/,
    );
  });
}
test('target 0010 fresh setup requires no AI initialization assertion', async () => {
  const reached = new Error('Reached role creation');
  const client = {
    async query(sql) {
      if (sql.includes("to_regnamespace('app')"))
        return { rows: [{ app: false, ledger: false, roles: 0 }] };
      if (sql.startsWith('CREATE ROLE')) throw reached;
      if (
        [
          'BEGIN',
          'SELECT pg_advisory_xact_lock(48136291)',
          'ROLLBACK',
        ].includes(sql)
      )
        return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  };
  await assert.rejects(
    bootstrapDatabase({ connect: async () => client }, 'x'.repeat(48), {
      targetMigration: '0010_photo_activity.sql',
    }),
    (error) => error === reached,
  );
});
test('target 0010 refuses an eleven-entry ledger without mutations', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("to_regnamespace('app')"))
        return { rows: [{ app: true, ledger: true, roles: 2 }] };
      if (sql.startsWith('SELECT name,checksum')) return { rows: history };
      if (
        [
          'BEGIN',
          'SELECT pg_advisory_xact_lock(48136291)',
          'ROLLBACK',
        ].includes(sql)
      )
        return { rows: [] };
      throw new Error(`Unexpected mutation or query: ${sql}`);
    },
    release() {},
  };
  await assert.rejects(
    bootstrapDatabase({ connect: async () => client }, 'x'.repeat(48), {
      targetMigration: '0010_photo_activity.sql',
    }),
    /Migration checksum collision/,
  );
  assert.equal(queries.at(-1), 'ROLLBACK');
});
