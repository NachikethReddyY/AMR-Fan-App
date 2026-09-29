import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { testDatabaseName } from '../../../scripts/local-db.mjs';
import { createDatabase } from '../database/index.ts';
import { migrate } from '../database/migrate.ts';
import { ensureAccount } from '../accounts/store.ts';
import { createSession } from '../auth/session.ts';
import { listMissions, enrollMission } from './missions.ts';
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
    `/${testDatabaseName()}`
)
  throw new Error('Owned test database required');
const pool = createDatabase();
let profile: any, token: string;
const issuer = `urn:amr:gate2:${randomUUID()}`;
before(async () => {
  await migrate(pool);
  const a = await ensureAccount(pool, { issuer, subject: randomUUID() });
  profile = a.profiles.find((p: any) => p.kind === 'real');
  token = (await createSession(pool, a.id)).token;
});
after(async () => {
  await pool.query('DELETE FROM app.mission_progress WHERE profile_id=$1', [
    profile.id,
  ]);
  await pool.query('DELETE FROM app.mission_enrollments WHERE profile_id=$1', [
    profile.id,
  ]);
  await pool.end();
});
test('mission listing exposes seeded attribution and explicit availability', async () => {
  const r = await listMissions(
    pool,
    token,
    { profileId: profile.id },
    new Date('2026-09-29T00:00:00Z'),
  );
  assert.equal(r.kind, 'available');
  assert.ok(r.missions.length >= 3);
  assert.ok(
    r.missions.every(
      (m: any) =>
        m.attribution.sourceLabel ===
        'AMR fan app challenge - independently curated',
    ),
  );
  const upcoming = r.missions.find(
    (m: any) => m.slug === 'singapore-race-week-refill',
  );
  assert.equal(upcoming?.availability, 'upcoming');
});
test('active mission enrollment is idempotent and creates zero progress', async () => {
  const id = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d001';
  const first = await enrollMission(
    pool,
    token,
    id,
    { profileId: profile.id },
    new Date('2026-09-29T00:00:00Z'),
  );
  assert.equal(first.kind, 'enrolled');
  const second = await enrollMission(
    pool,
    token,
    id,
    { profileId: profile.id },
    new Date('2026-09-29T00:00:00Z'),
  );
  assert.equal(second.kind, 'already_enrolled');
  const row = await pool.query(
    'SELECT count FROM app.mission_progress WHERE profile_id=$1 AND mission_id=$2',
    [profile.id, id],
  );
  assert.equal(row.rows[0].count, 0);
});
test('concurrent enrollment creates one enrollment and one progress row', async () => {
  const id = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d002';
  const results = await Promise.allSettled(
    [1, 2, 3].map(() =>
      enrollMission(
        pool,
        token,
        id,
        { profileId: profile.id },
        new Date('2026-09-29T00:00:00Z'),
      ),
    ),
  );
  assert.equal(
    results.filter(
      (x) => x.status === 'fulfilled' && x.value.kind === 'enrolled',
    ).length,
    1,
  );
  assert.equal(
    results.filter(
      (x) => x.status === 'fulfilled' && x.value.kind === 'already_enrolled',
    ).length,
    2,
  );
  const row = await pool.query(
    'SELECT count(*)::int AS n FROM app.mission_progress WHERE profile_id=$1 AND mission_id=$2',
    [profile.id, id],
  );
  assert.equal(row.rows[0].n, 1);
});
test('upcoming mission enrollment rejects explicit state', async () => {
  const id = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d003';
  await assert.rejects(
    enrollMission(
      pool,
      token,
      id,
      { profileId: profile.id },
      new Date('2026-09-29T00:00:00Z'),
    ),
    /Mission is upcoming/,
  );
});
test('expired mission rejects enrollment without creating progress', async () => {
  const id = '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d003';
  await assert.rejects(
    enrollMission(
      pool,
      token,
      id,
      { profileId: profile.id },
      new Date('2026-10-12T00:00:00Z'),
    ),
    /Mission is expired/,
  );
  const r = await pool.query(
    'SELECT count(*)::int AS n FROM app.mission_progress WHERE profile_id=$1 AND mission_id=$2',
    [profile.id, id],
  );
  assert.equal(r.rows[0].n, 0);
});
test('owner isolation rejects other-account mission reads and enrollment', async () => {
  const a = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const otherToken = (await createSession(pool, a.id)).token;
  const missionId = ['4d7b7ad7', '0f6f', '4b98', '9876', '5e3c4e90d001'].join(
    '-',
  );
  await assert.rejects(
    listMissions(pool, otherToken, { profileId: profile.id }),
  );
  await assert.rejects(
    enrollMission(pool, otherToken, missionId, {
      profileId: profile.id,
    }),
  );
});
test('demo enrollment rejects and its missions remain unavailable', async () => {
  const a = await ensureAccount(pool, { issuer, subject: randomUUID() });
  const demo = a.profiles.find((p: any) => p.kind === 'demo');
  assert.ok(demo);
  const t = (await createSession(pool, a.id)).token;
  const r = await listMissions(pool, t, { profileId: demo.id });
  assert.ok(r.missions.every((m: any) => m.availability === 'unavailable'));
  await assert.rejects(
    enrollMission(pool, t, '4d7b7ad7-0f6f-4b98-9876-5e3c4e90d001', {
      profileId: demo.id,
    }),
  );
});
