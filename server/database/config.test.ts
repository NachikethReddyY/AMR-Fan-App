import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';
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

test('rejects every URL query parameter that pg could reinterpret', () => {
  const overrides = [
    'host=remote.example',
    'hostaddr=127.0.0.1',
    'port=4444',
    'user=other',
    'password=other',
    'database=other',
    'dbname=other',
    'ssl=0',
    'sslmode=disable',
    'sslrootcert=/tmp/fixture',
    'sslcert=/tmp/fixture',
    'sslkey=/tmp/fixture',
    'sslnegotiation=direct',
    'uselibpqcompat=true',
    'options=-c%20statement_timeout%3D0',
    'statement_timeout=0',
    'unknown=future-option',
  ];
  for (const query of overrides) {
    assert.throws(
      () =>
        databaseConfig({
          NODE_ENV: 'development',
          DATABASE_URL: `postgres://u:p@localhost/db?${query}`,
        }),
      /query parameters/,
    );
    assert.throws(
      () =>
        databaseConfig({
          NODE_ENV: 'production',
          DATABASE_URL: `postgres://u:p@remote.example/db?${query}`,
        }),
      /query parameters/,
    );
  }
});

test('pg effective authority and TLS match validated local and Azure configuration', () => {
  const previous = process.env.PGSSLMODE;
  process.env.PGSSLMODE = 'no-verify';
  try {
    for (const { url, env, host, port, ssl } of [
      {
        url: 'postgres://u:p@127.example.com:5432/db',
        env: 'development',
        host: '127.example.com',
        port: 5432,
        ssl: { rejectUnauthorized: true },
      },
      {
        url: 'postgres://u:p@LOCALHOST:55432/db',
        env: 'development',
        host: 'localhost',
        port: 55432,
        ssl: false,
      },
      {
        url: 'postgres://u:p@example.postgres.database.azure.com:5432/db',
        env: 'production',
        host: 'example.postgres.database.azure.com',
        port: 5432,
        ssl: { rejectUnauthorized: true },
      },
    ]) {
      const client = new Client(
        databaseConfig({ NODE_ENV: env, DATABASE_URL: url }),
      );
      const effective: unknown = Reflect.get(client, 'connectionParameters');
      assert.ok(effective && typeof effective === 'object');
      assert.equal(Reflect.get(effective, 'host'), host);
      assert.equal(Reflect.get(effective, 'port'), port);
      assert.equal(Reflect.get(effective, 'user'), 'u');
      assert.equal(Reflect.get(effective, 'database'), 'db');
      assert.deepEqual(Reflect.get(effective, 'ssl'), ssl);
    }
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previous;
  }
});

test('production rejects normalized loopback aliases and socket authorities', () => {
  for (const host of [
    'LOCALHOST',
    '%6cocalhost',
    '127.1',
    '2130706433',
    '[::1]',
    '[::ffff:127.0.0.1]',
    '%2Ftmp',
  ]) {
    assert.throws(() =>
      databaseConfig({
        NODE_ENV: 'production',
        DATABASE_URL: `postgres://u:p@${host}/db`,
      }),
    );
  }
});
