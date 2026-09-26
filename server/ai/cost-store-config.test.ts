import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiCostDatabaseConfig } from './cost-store-config.ts';

test('cost storage is absent unless its explicit shared database is configured', () => {
  assert.equal(aiCostDatabaseConfig({}), undefined);
  assert.equal(
    aiCostDatabaseConfig({ DATABASE_URL: 'postgres://unused.example/app' }),
    undefined,
  );
});
test('hosted shared store validates TLS and rejects production loopback', () => {
  const config = aiCostDatabaseConfig({
    AI_COST_DATABASE_URL: 'postgres://fixture:placeholder@budget.example/app',
    NODE_ENV: 'production',
  });
  assert.deepEqual(config?.ssl, { rejectUnauthorized: true });
  assert.throws(() =>
    aiCostDatabaseConfig({
      AI_COST_DATABASE_URL: 'postgres://fixture:placeholder@127.0.0.1/app',
      NODE_ENV: 'production',
    }),
  );
  assert.throws(() =>
    aiCostDatabaseConfig({
      AI_COST_DATABASE_URL:
        'postgres://fixture:placeholder@budget.example/app?sslmode=disable',
    }),
  );
});
