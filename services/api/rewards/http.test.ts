import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { dispatchRewards } from './http.ts';

const pool = createDatabase({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/amr_fixture_test',
});
after(() => pool.end());

test('unrelated routes are left to the existing API without reading a body or using a database', async () => {
  const result = await dispatchRewards({
    pool,
    token: 'unused',
    method: 'GET',
    path: '/v1/me',
    query: {},
    body: async () => {
      throw new Error('Unexpected body use');
    },
  });
  assert.equal(result, null);
});
