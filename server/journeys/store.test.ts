import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { createJourneyService } from './store.ts';
import { routeFixture } from './fixtures.ts';

if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    '/amr_a64639f40c71_test'
) {
  throw new Error('Use only the allocated journey worktree test database.');
}
const pool = createDatabase();
const env = { NODE_ENV: 'test', JOURNEY_FIXTURES_ENABLED: 'true' };
const journeys = createJourneyService({ pool, env });
const issuer = `urn:amr:journey-test:${randomUUID()}`;
let token = '';
let profileId = '';
before(async () => {
  await migrate(pool);
  const account = await ensureAccount(pool, { issuer, subject: 'a' });
  const profile = account.profiles.find((p) => p.kind === 'real');
  assert.ok(profile);
  profileId = profile.id;
  token = (await createSession(pool, account.id)).token;
});
after(async () => {
  await pool.query('DELETE FROM app.principals WHERE issuer = $1', [issuer]);
  await pool.end();
});

test('owner prepares an immutable server route and reads the same prepared journey after reconnecting', async () => {
  const result = await journeys.prepare(
    token,
    { profileId, requestId: randomUUID() },
    routeFixture(),
  );
  assert.equal(result.state, 'prepared');
  assert.equal(result.profileId, profileId);
  assert.equal(result.source.kind, 'fixture');
  const reconnected = createDatabase();
  try {
    assert.deepEqual(
      await createJourneyService({ pool: reconnected, env }).read(
        token,
        result.id,
      ),
      result,
    );
  } finally {
    await reconnected.end();
  }
});

test('prepare/start retries are stable, changed requests conflict, and foreign or revoked sessions cannot access journeys', async () => {
  const route = routeFixture();
  const input = { profileId, requestId: randomUUID() };
  const [one, repeated] = await Promise.all([
    journeys.prepare(token, input, route),
    journeys.prepare(token, input, route),
  ]);
  assert.deepEqual(repeated, one);
  await assert.rejects(
    journeys.prepare(token, input, { ...route, routeId: 'changed' }),
    { status: 409 },
  );
  const other = await ensureAccount(pool, { issuer, subject: 'b' });
  const otherToken = (await createSession(pool, other.id)).token;
  await assert.rejects(journeys.read(otherToken, one.id), { status: 404 });
  await assert.rejects(
    journeys.prepare(otherToken, { profileId, requestId: randomUUID() }, route),
    { status: 404 },
  );
  await assert.rejects(journeys.read('invalid', one.id), { status: 401 });
  const start = { requestId: randomUUID(), captureSessionId: randomUUID() };
  const active = await journeys.start(token, one.id, start);
  assert.equal(active.state, 'active');
  assert.deepEqual(await journeys.start(token, one.id, start), active);
  await assert.rejects(
    journeys.start(token, one.id, { ...start, captureSessionId: randomUUID() }),
    { status: 409 },
  );
  await assert.rejects(
    journeys.start(token, one.id, { ...start, requestId: randomUUID() }),
    { status: 409 },
  );
  const temporary = await createSession(pool, other.id);
  await pool.query(
    'UPDATE app.sessions SET revoked_at = now() WHERE principal_id = $1',
    [other.id],
  );
  await assert.rejects(journeys.read(temporary.token, one.id), { status: 401 });
  await assert.rejects(
    journeys.prepare(
      token,
      { ...input, requestId: randomUUID(), geometry: route.points },
      route,
    ),
    { status: 400 },
  );
});
