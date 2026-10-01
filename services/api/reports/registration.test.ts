import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApi } from '../api/app.ts';
import { createDatabase } from '../database/index.ts';
import { ensureAccount, assignRole } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';

// This acceptance gate must use the actual application composition.
if (
  process.env.NODE_ENV !== 'test' ||
  !/\/amr_[a-f0-9]{12}_test$/.test(
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname,
  )
)
  throw new Error('Use allocated test DB.');
test('real createApi registers the authenticated report listing', async () => {
  const pool = createDatabase();
  const server = createApi({
    pool,
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
      REPORT_FAILED_UPLOAD_TTL_SECONDS: '3600',
      REPORT_STORAGE_ROOT: process.env.REPORT_TEST_STORAGE,
      REPORT_PARSER_MODE: process.env.REPORT_PARSER_IMAGE ? 'docker' : 'native',
      REPORT_PARSER_IMAGE: process.env.REPORT_PARSER_IMAGE,
    },
  });
  try {
    const account = await ensureAccount(pool, {
      issuer: `urn:amr:reports-registration:${randomUUID()}`,
      subject: 'synthetic-admin',
    });
    await assignRole(
      pool,
      account.id,
      'admin',
      'Synthetic report registration proof',
    );
    const session = await createSession(pool, account.id);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/admin/reports`,
      { headers: { Authorization: `Bearer ${session.token}` } },
    );
    assert.equal(
      response.status,
      200,
      'Shared createApi registration is still pending.',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
