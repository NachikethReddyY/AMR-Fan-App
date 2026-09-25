import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../database/index.ts';
import { lockOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { authenticateSession } from '../auth/session.ts';
import {
  candidatePolicy,
  batchSchema,
  finishSchema,
  id,
  parse,
  policySchema,
  prepareSchema,
  retentionMs,
  routeSchema,
  storedSampleSchema,
  startSchema,
  summarySchema,
  type Journey,
} from './contracts.ts';
import { assessJourney } from './evidence.ts';

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
  const requestedPolicy = parse(policySchema, policy);
  const retainedPolicy = {
    ...requestedPolicy,
    version: `journey-assessment-v1-${fingerprint(requestedPolicy).slice(0, 32)}`,
  };
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
      const result = await operation(client, actor.principalId);
      // Lock waits and bounded work may outlive the session. Recheck before commit.
      const current = await client.query(
        'SELECT 1 FROM app.sessions WHERE token_hash = $1 AND expires_at > clock_timestamp() AND revoked_at IS NULL',
        [fingerprintToken(token)],
      );
      if (current.rowCount !== 1) throw new ApiError(401, 'Sign in again.');
      return result;
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
    await purge(client, journeyId, clock());
    return parse(summarySchema, current.rows[0]?.summary);
  }
  async function purge(client: PoolClient, journeyId: string, now: number) {
    const result = await client.query(
      'UPDATE app.journeys SET snapshot = NULL WHERE id = $1 AND precise_expires_at <= $2 AND snapshot IS NOT NULL',
      [journeyId, new Date(now)],
    );
    const samples = await client.query(
      `DELETE FROM app.journey_samples WHERE journey_id = $1 AND (expires_at <= $2 OR EXISTS (
        SELECT 1 FROM app.journeys WHERE id = $1 AND precise_expires_at <= $2))`,
      [journeyId, new Date(now)],
    );
    return { journeys: result.rowCount ?? 0, samples: samples.rowCount ?? 0 };
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
  async function assess(client: PoolClient, journey: Journey) {
    const snapshot = await client.query<{ snapshot: unknown }>(
      'SELECT snapshot FROM app.journeys WHERE id = $1',
      [journey.id],
    );
    const route = parse(routeSchema, snapshot.rows[0]?.snapshot);
    const stored = await client.query<{ sample: unknown }>(
      'SELECT sample FROM app.journey_samples WHERE journey_id = $1 ORDER BY acquired_at, sample_id',
      [journey.id],
    );
    if (journey.startedAtMs === null)
      throw new ApiError(409, 'Journey has not started.');
    const result = {
      ...journey,
      assessment: assessJourney({
        route,
        policy: journey.policy,
        startedAtMs: journey.startedAtMs,
        finishedAtMs: journey.finishedAtMs,
        finishReason: journey.finishReason,
        revision: journey.evidenceRevision,
        samples: stored.rows.map(
          (row) => parse(storedSampleSchema, row.sample).evidence,
        ),
      }),
    };
    await client.query('UPDATE app.journeys SET summary = $2 WHERE id = $1', [
      journey.id,
      result,
    ]);
    return result;
  }

  return {
    async cleanup() {
      const now = clock();
      return transaction(pool, async (client) => {
        const expired = await client.query<{ id: string }>(
          'SELECT id FROM app.journeys WHERE precise_expires_at <= $1 AND snapshot IS NOT NULL ORDER BY precise_expires_at, id LIMIT 100 FOR UPDATE SKIP LOCKED',
          [new Date(now)],
        );
        const counts = { journeys: 0, samples: 0 };
        for (const row of expired.rows) {
          const removed = await purge(client, row.id, now);
          counts.journeys += removed.journeys;
          counts.samples += removed.samples;
        }
        return counts;
      });
    },
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
            maxObservedSpeedMps: null,
            modePlausibility: 'unassessed',
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
          policy: retainedPolicy,
          startedAtMs: now,
          captureSessionId: input.captureSessionId,
          assessment: {
            ...journey.assessment,
            version: retainedPolicy.version,
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
    async appendEvidence(token: string, rawId: unknown, raw: unknown) {
      const journeyId = parse(id, rawId);
      const input = parse(batchSchema, raw);
      return authorized(token, async (client, principalId) => {
        await requestLock(client, principalId, input.requestId);
        const journey = await owned(client, principalId, journeyId);
        const hash = fingerprint({ action: 'evidence', journeyId, input });
        const previous = await replay(
          client,
          principalId,
          input.requestId,
          hash,
        );
        if (previous) return previous;
        const now = clock();
        if (
          journey.startedAtMs === null ||
          journey.captureSessionId !== input.captureSessionId ||
          now >= journey.preciseExpiresAtMs
        )
          throw new ApiError(409, 'Journey capture session is not available.');
        const stored = await client.query<{ sample: unknown }>(
          'SELECT sample FROM app.journey_samples WHERE journey_id = $1 AND sample_id = ANY($2::uuid[])',
          [journeyId, input.samples.map((sample) => sample.id)],
        );
        const existingSamples = new Map(
          stored.rows.map((row) => {
            const sample = parse(storedSampleSchema, row.sample).evidence;
            return [sample.id, sample];
          }),
        );
        const newSamples: typeof input.samples = [];
        for (const sample of input.samples) {
          if (
            sample.acquiredAtMs < journey.startedAtMs ||
            sample.acquiredAtMs > now ||
            sample.receivedAtMs < sample.acquiredAtMs ||
            sample.receivedAtMs > now ||
            sample.acquiredAtMs + retentionMs <= now ||
            (journey.finishedAtMs !== null &&
              sample.acquiredAtMs > journey.finishedAtMs)
          )
            throw new ApiError(
              409,
              'Evidence timestamp is outside the capture interval.',
            );
          const existing = existingSamples.get(sample.id);
          if (existing) {
            if (fingerprint(existing) !== fingerprint(sample))
              throw new ApiError(
                409,
                'Sample ID already has different evidence.',
              );
            continue;
          }
          existingSamples.set(sample.id, sample);
          newSamples.push(sample);
        }
        const count = await client.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM app.journey_samples WHERE journey_id = $1',
          [journeyId],
        );
        if (count.rows[0].count + newSamples.length > 4096)
          throw new ApiError(413, 'Journey evidence limit reached.');
        if (newSamples.length)
          await client.query(
            `INSERT INTO app.journey_samples(journey_id, sample_id, acquired_at, expires_at, sample)
           SELECT $1, e.* FROM unnest($2::uuid[], $3::timestamptz[], $4::timestamptz[], $5::jsonb[]) AS e`,
            [
              journeyId,
              newSamples.map((s) => s.id),
              newSamples.map((s) => new Date(s.acquiredAtMs)),
              newSamples.map((s) => new Date(s.acquiredAtMs + retentionMs)),
              newSamples.map((evidence) => ({
                evidence,
                serverReceivedAtMs: now,
              })),
            ],
          );
        const result = await assess(client, {
          ...journey,
          evidenceRevision:
            journey.evidenceRevision + (newSamples.length > 0 ? 1 : 0),
        });
        return record(client, principalId, input.requestId, hash, result);
      });
    },
    async finish(token: string, rawId: unknown, raw: unknown) {
      const journeyId = parse(id, rawId);
      const input = parse(finishSchema, raw);
      return authorized(token, async (client, principalId) => {
        await requestLock(client, principalId, input.requestId);
        const journey = await owned(client, principalId, journeyId);
        const hash = fingerprint({ action: 'finish', journeyId, input });
        const previous = await replay(
          client,
          principalId,
          input.requestId,
          hash,
        );
        if (previous) return previous;
        const now = clock();
        if (
          journey.state !== 'active' ||
          journey.startedAtMs === null ||
          journey.captureSessionId !== input.captureSessionId ||
          input.endedAtMs < journey.startedAtMs ||
          input.endedAtMs > now ||
          now >= journey.preciseExpiresAtMs
        )
          throw new ApiError(
            409,
            'Journey cannot be finished with this capture interval.',
          );
        const latest = await client.query<{ beyond: boolean }>(
          'SELECT EXISTS(SELECT 1 FROM app.journey_samples WHERE journey_id = $1 AND acquired_at > $2) AS beyond',
          [journeyId, new Date(input.endedAtMs)],
        );
        if (latest.rows[0].beyond)
          throw new ApiError(409, 'Finish precedes already recorded evidence.');
        const result = await assess(client, {
          ...journey,
          state: 'finished',
          finishedAtMs: input.endedAtMs,
          finishReason: input.reason,
        });
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
