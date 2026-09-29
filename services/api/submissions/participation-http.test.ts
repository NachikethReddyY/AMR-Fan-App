import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { handleParticipationRequest } from './participation-http.ts';

test('owned adapter only claims its explicit routes and rejects unsupported methods before reading a body', async () => {
  const pool = new Pool();
  try {
    const base = {
      pool,
      token: '',
      query: {},
      body: async () => {
        throw new Error('Body must not be read');
      },
    };
    assert.equal(
      await handleParticipationRequest({
        ...base,
        method: 'GET',
        path: '/v1/admin/submissions',
      }),
      null,
    );
    assert.equal(
      await handleParticipationRequest({
        ...base,
        method: 'POST',
        path: '/v1/submissions/votes',
      }),
      null,
    );
    for (const path of [
      '/v1/submissions/ranking',
      '/v1/profiles/a/submission-participation',
      '/v1/profiles/a/submissions/b/contributions',
      '/v1/admin/submission-sessions',
      '/v1/admin/submission-sessions/a/close',
      '/v1/admin/submission-selections/a/resolve',
    ]) {
      await assert.rejects(
        handleParticipationRequest({ ...base, method: 'DELETE', path }),
        (error: unknown) => error instanceof ApiError && error.status === 405,
      );
    }
  } finally {
    await pool.end();
  }
});
