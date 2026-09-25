import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseConfig } from './config.ts';

test('production requires verified TLS and rejects local or URL SSL overrides', () => {
  for (const url of [
    'postgres://u:p@127.0.0.1/x',
    'postgres://u:p@db.example/x?sslmode=no-verify',
  ]) {
    assert.throws(() =>
      databaseConfig({ NODE_ENV: 'production', DATABASE_URL: url }),
    );
  }
  assert.deepEqual(
    databaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db.example/x',
    }).ssl,
    { rejectUnauthorized: true },
  );
});
test('missing or malformed configuration fails without echoing credentials', () => {
  assert.throws(() => databaseConfig({}), /DATABASE_URL/);
  assert.throws(
    () => databaseConfig({ DATABASE_URL: 'not-a-url' }),
    /PostgreSQL/,
  );
});
