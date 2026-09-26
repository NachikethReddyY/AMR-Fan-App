import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createDatabase } from '../../../database/index.ts';
import { migrate } from '../../../database/migrate.ts';
import { ensureAccount, assignRole } from '../../../accounts/store.ts';
import { createSession } from '../../../auth/session.ts';
import { adjustPoints } from '../../../points/index.ts';
import { createSubmission, moderateSubmission } from '../../index.ts';
import {
  contributeToSubmission,
  createInteractionSession,
  closeInteractionSession,
  listInteractionSessions,
  resolveSubmissionSelection,
} from '../../participation.ts';
import { requireOwnTestDatabase } from '../test-server.ts';

requireOwnTestDatabase();
const pool = createDatabase();
before(async () => {
  const actual = await pool.query('SELECT current_database() AS name');
  assert.equal(
    `/${actual.rows[0].name}`,
    new URL(process.env.DATABASE_URL ?? '').pathname,
  );
  await pool.query(
    'DROP SCHEMA IF EXISTS app CASCADE; DROP TABLE IF EXISTS public.schema_migrations',
  );
  await migrate(pool);
});
after(() => pool.end());

test('admin session read joins immutable selected content without changing original action receipts or exposing profile details', async () => {
  const admin = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-admin-read',
    subject: randomUUID(),
  });
  await assignRole(pool, admin.id, 'admin', 'Owned admin read fixture');
  const token = (await createSession(pool, admin.id)).token;
  const fan = await ensureAccount(pool, {
    issuer: 'urn:amr:participation-admin-read',
    subject: randomUUID(),
  });
  const fanToken = (await createSession(pool, fan.id)).token;
  const profile = fan.profiles.find((p) => p.kind === 'demo');
  assert.ok(profile);
  await adjustPoints(pool, token, {
    targetProfileId: profile.id,
    requestId: randomUUID(),
    delta: 510,
    reason: 'Owned admin read fixture',
  });
  const text = '<img src=x onerror="alert(1)">Demo activity';
  const created = await createSubmission(pool, fanToken, profile.id, {
    requestId: randomUUID(),
    text,
    tag: 'activity',
    confirmedFee: 500,
  });
  await moderateSubmission(pool, token, created.outcome.id, {
    requestId: randomUUID(),
    status: 'approved',
  });
  await contributeToSubmission({
    pool,
    token: fanToken,
    profileId: profile.id,
    submissionId: created.outcome.id,
    value: { requestId: randomUUID(), points: 10 },
  });
  const session = await createInteractionSession({
    pool,
    token,
    value: { requestId: randomUUID() },
  });
  const closeInput = { requestId: randomUUID() };
  const closed = await closeInteractionSession({
    pool,
    token,
    sessionId: session.id,
    value: closeInput,
  });
  const chosen = closed.selections.find(
    (s) => s.submissionId === created.outcome.id,
  );
  assert.ok(chosen);
  const read = async () =>
    (await listInteractionSessions({ pool, token })).items.find(
      (x) => x.session.id === session.id,
    );
  const item = await read();
  assert.ok(item);
  assert.deepEqual(
    item.content.find((x) => x.id === created.outcome.id),
    { id: created.outcome.id, text, tag: 'activity' },
  );
  assert.deepEqual(item.session, closed);
  await resolveSubmissionSelection({
    pool,
    token,
    selectionId: chosen.id,
    value: {
      requestId: randomUUID(),
      action: 'release',
      reason: 'Retain selected content and original snapshot',
    },
  });
  assert.deepEqual((await read())?.content, item.content);
  assert.deepEqual(
    await closeInteractionSession({
      pool,
      token,
      sessionId: session.id,
      value: closeInput,
    }),
    closed,
  );
  await assert.rejects(listInteractionSessions({ pool, token: fanToken }), {
    status: 403,
  });
});
