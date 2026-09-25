import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../database/index.ts';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import {
  candidatePolicy,
  id,
  parse,
  policySchema,
  prepareSchema,
  retentionMs,
  routeSchema,
  startSchema,
  summarySchema,
  type Journey,
} from './contracts.ts';

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createJourneyService({
  pool,
  env = process.env,
  policy = candidatePolicy,
  clock = Date.now,
}: {
  pool: Pool;
  env?: Record<string, string | undefined>;
  policy?: unknown;
  clock?: () => number;
}) {
  const retainedPolicy = parse(policySchema, policy);
  if (
    env.JOURNEY_FIXTURES_ENABLED &&
    !['true', 'false'].includes(env.JOURNEY_FIXTURES_ENABLED)
  )
    throw new Error('JOURNEY_FIXTURES_ENABLED must be true or false.');
  if (
    env.NODE_ENV === 'production' &&
    (env.JOURNEY_FIXTURES_ENABLED === 'true' || clock !== Date.now)
  )
    throw new Error(
      'Journey fixtures and injected clocks are disabled in production.',
    );
  const fixturesAllowed =
    ['test', 'development'].includes(env.NODE_ENV ?? '') &&
    env.JOURNEY_FIXTURES_ENABLED === 'true';

  async function authorized<T>(
    token: string,
    operation: (client: PoolClient, principalId: string) => Promise<T>,
  ) {
    const actor = await authenticateSession(pool, token);
    return transaction(pool, async (client) => {
      // Hold the current session against revocation for this operation, before profile locks.
      const session = await client.query(
        `SELECT principal_id FROM app.sessions WHERE token_hash = $1 AND principal_id = $2
         AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR SHARE`,
        [fingerprintToken(token), actor.principalId],
      );
      if (session.rowCount !== 1) throw new ApiError(401, 'Sign in again.');
      return operation(client, actor.principalId);
    });
  }
  async function owned(
    client: PoolClient,
    principalId: string,
    journeyId: string,
  ) {
    const row = await client.query<{ profile_id: string }>(
      'SELECT profile_id FROM app.journeys WHERE id = $1',
      [journeyId],
    );
    const target = row.rows[0];
    if (!target) throw new ApiError(404, 'Journey not found.');
    await lockOwnedProfile(client, principalId, target.profile_id);
    const current = await client.query<{ summary: unknown }>(
      'SELECT summary FROM app.journeys WHERE id = $1 FOR UPDATE',
      [journeyId],
    );
    return parse(summarySchema, current.rows[0]?.summary);
  }
  async function requestLock(
    client: PoolClient,
    principalId: string,
    requestId: string,
  ) {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`journey:${principalId}:${requestId}`],
    );
  }
  async function replay(
    client: PoolClient,
    principalId: string,
    requestId: string,
    hash: string,
  ) {
    const previous = await client.query<{
      fingerprint: string;
      result: unknown;
    }>(
      'SELECT fingerprint, result FROM app.journey_requests WHERE principal_id = $1 AND request_id = $2',
      [principalId, requestId],
    );
    const row = previous.rows[0];
    if (!row) return null;
    if (row.fingerprint !== hash)
      throw new ApiError(
        409,
        'Request ID already has a different journey intent.',
      );
    return parse(summarySchema, row.result);
  }
  async function record(
    client: PoolClient,
    principalId: string,
    requestId: string,
    hash: string,
    result: Journey,
  ) {
    await client.query(
      'INSERT INTO app.journey_requests(principal_id, request_id, journey_id, fingerprint, result) VALUES ($1,$2,$3,$4,$5)',
      [principalId, requestId, result.id, hash, result],
    );
    return result;
  }

  return {
    async prepare(token: string, raw: unknown, serverRoute: unknown) {
      const input = parse(prepareSchema, raw);
      const route = parse(routeSchema, serverRoute);
      if (route.source.kind === 'fixture' && !fixturesAllowed)
        throw new ApiError(403, 'Synthetic journey routes are disabled.');
      return authorized(token, async (client, principalId) => {
        await requestLock(client, principalId, input.requestId);
        const profile = await lockOwnedProfile(
          client,
          principalId,
          input.profileId,
        );
        if (profile.kind !== 'real')
          throw new ApiError(
            409,
            'Real journey recording requires the real profile.',
          );
        const hash = fingerprint({ action: 'prepare', input, route });
        const previous = await replay(
          client,
          principalId,
          input.requestId,
          hash,
        );
        if (previous) return previous;
        const now = clock();
        const acquired = Date.parse(route.fetchedAt);
        if (acquired > now || acquired + retentionMs <= now)
          throw new ApiError(
            409,
            'Route plan expired or has an invalid timestamp.',
          );
        const result: Journey = {
          id: randomUUID(),
          profileId: profile.id,
          state: 'prepared',
          source: route.source,
          mode: route.mode,
          basis: route.basis,
          policy: retainedPolicy,
          preparedAtMs: now,
          startedAtMs: null,
          finishedAtMs: null,
          finishReason: null,
          captureSessionId: null,
          preciseExpiresAtMs: acquired + retentionMs,
          evidenceRevision: 0,
          assessment: {
            version: retainedPolicy.version,
            calibration: 'unvalidated',
            revision: 0,
            status: 'unfinished',
            reasons: ['not_started'],
            startRecorded: false,
            arrivalRecorded: false,
            sampleCount: 0,
            elapsedMs: null,
            observedDistanceMeters: 0,
          },
        };
        await client.query(
          'INSERT INTO app.journeys(id, profile_id, summary, snapshot, precise_expires_at) VALUES ($1,$2,$3,$4,$5)',
          [
            result.id,
            profile.id,
            result,
            route,
            new Date(result.preciseExpiresAtMs),
          ],
        );
        return record(client, principalId, input.requestId, hash, result);
      });
    },
    async start(token: string, rawId: unknown, raw: unknown) {
      const journeyId = parse(id, rawId);
      const input = parse(startSchema, raw);
      return authorized(token, async (client, principalId) => {
        await requestLock(client, principalId, input.requestId);
        const journey = await owned(client, principalId, journeyId);
        const hash = fingerprint({ action: 'start', journeyId, input });
        const previous = await replay(
          client,
          principalId,
          input.requestId,
          hash,
        );
        if (previous) return previous;
        const now = clock();
        if (journey.state !== 'prepared' || now >= journey.preciseExpiresAtMs)
          throw new ApiError(409, 'Journey cannot be started.');
        const result: Journey = {
          ...journey,
          state: 'active',
          startedAtMs: now,
          captureSessionId: input.captureSessionId,
          assessment: {
            ...journey.assessment,
            reasons: ['missing_start', 'missing_arrival'],
          },
        };
        await client.query(
          'UPDATE app.journeys SET summary = $2 WHERE id = $1',
          [journeyId, result],
        );
        return record(client, principalId, input.requestId, hash, result);
      });
    },
    async read(token: string, rawId: unknown) {
      const journeyId = parse(id, rawId);
      return authorized(token, (client, principalId) =>
        owned(client, principalId, journeyId),
      );
    },
  };
}

function fingerprintToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
