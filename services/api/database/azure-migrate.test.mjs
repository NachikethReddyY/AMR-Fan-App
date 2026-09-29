import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { migrationConfig } from './azure-migrate.mjs';

const config = (overrides = {}) =>
  migrationConfig({
    AZURE_MIGRATION_DATABASE_URL:
      'postgresql://amr_staging_admin:synthetic@amr-test.postgres.database.azure.com:5432/postgres',
    AZURE_RUNTIME_DATABASE_PASSWORD: 'x'.repeat(48),
    ...overrides,
  });

test('Azure migration accepts only the private staging admin URL and bounded runtime password', () => {
  const value = config();
  assert.equal(value.url.username, 'amr_staging_admin');
  assert.equal(value.runtimePassword.length, 48);
  for (const overrides of [
    { AZURE_MIGRATION_DATABASE_URL: '' },
    {
      AZURE_MIGRATION_DATABASE_URL:
        'postgresql://amr_api:synthetic@amr-test.postgres.database.azure.com:5432/postgres',
    },
    {
      AZURE_MIGRATION_DATABASE_URL:
        'postgresql://amr_staging_admin:synthetic@localhost:5432/postgres',
    },
    {
      AZURE_MIGRATION_DATABASE_URL:
        'postgresql://amr_staging_admin:synthetic@amr-test.postgres.database.azure.com:5432/postgres?sslmode=require',
    },
    { AZURE_RUNTIME_DATABASE_PASSWORD: 'short' },
  ]) {
    assert.throws(() => config(overrides));
  }
});

const enabled =
  process.env.AZURE_DATABASE_INTEGRATION === 'true' &&
  process.env.AZURE_MIGRATION_DATABASE_URL &&
  process.env.AZURE_RUNTIME_DATABASE_PASSWORD;

test('Azure migration job applies and verifies the database bootstrap', { skip: !enabled }, () => {
  const result = spawnSync(process.execPath, ['services/api/database/azure-migrate.mjs'], {
    encoding: 'utf8',
    timeout: 120_000,
    env: process.env,
  });
  assert.equal(result.status, 0, 'Azure migration job failed. See sanitized stderr from the job.');
  assert.match(result.stdout, /"status":"migrated"/);
  assert.doesNotMatch(result.stdout, /postgresql:\/\//i);
  assert.doesNotMatch(result.stderr, /password|secret|token|postgresql:\/\//i);
});
