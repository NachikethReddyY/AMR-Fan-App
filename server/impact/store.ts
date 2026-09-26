import { checkScanBudget, rethrowScanError } from './limits.ts';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticateSession } from '../auth/session.ts';
import { readOwnedProfile } from '../accounts/store.ts';
import { ApiError } from '../accounts/types.ts';
import { transaction } from '../database/index.ts';
import {
  assessmentSchema,
  id,
  parse,
  sourceSchema,
} from '../journeys/contracts.ts';
import { receiptSchema } from '../awards/contracts.ts';
import {
  classifyReceipt,
  createSummary,
  estimatePolicy,
  type EstimatePolicy,
} from './aggregate.ts';
import { contributionsSchema, type ImpactSource } from './contracts.ts';

const rowSchema = z.object({
  profile_id: id,
  journey_id: id,
  state: z.enum(['prepared', 'active', 'finished']),
  source: sourceSchema,
  assessment: assessmentSchema.pick({ version: true, revision: true }),
  receipt: receiptSchema.nullable(),
});

export async function readContributions({
  pool,
  token,
  profileId,
  policy = estimatePolicy,
}: {
  pool: Pool;
  token: string;
  profileId: string;
  policy?: EstimatePolicy;
}) {
  const selected = parse(id, profileId);
  const actor = await authenticateSession(pool, token);
  return transaction(pool, async (client) => {
    // One snapshot prevents a top-up between pages from being counted twice.
    await client.query(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const session = await client.query(
      'SELECT 1 FROM app.sessions WHERE token_hash=$1 AND principal_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp()',
      [createHash('sha256').update(token).digest('hex'), actor.principalId],
    );
    if (!session.rowCount) throw new ApiError(401, 'Sign in again.');
    const profile = await readOwnedProfile(client, actor.principalId, selected);
    const personal = createSummary();
    const community = createSummary();
    const sources = new Map<string, ImpactSource>();
    const validation = new Set<'reviewed_release' | 'unvalidated_estimate'>();
    const started = performance.now();
    let scannedRows = 0;
    await client.query("SET LOCAL statement_timeout = '5s'");
    // The state table owns the latest receipt. Never sum append-only assessments
    // or ledger entries: a replay/top-up is still one journey contribution.
    await client.query(`DECLARE impact_rows NO SCROLL CURSOR FOR
      SELECT j.id AS journey_id,j.profile_id,j.summary->>'state' AS state,
        j.summary->'source' AS source,
        jsonb_build_object('version',j.summary->'assessment'->'version',
          'revision',j.summary->'assessment'->'revision') AS assessment,a.receipt
      FROM app.journeys j
      JOIN app.profiles p ON p.id=j.profile_id AND p.kind='real'
      LEFT JOIN app.journey_award_state s ON s.journey_id=j.id AND s.profile_id=j.profile_id
      LEFT JOIN app.journey_award_assessments a ON a.id=s.latest_receipt_id
      WHERE j.summary->>'state'='finished' AND j.summary->'source'->>'kind'='live'`);
    while (true) {
      const remainingMs = checkScanBudget({
        rows: scannedRows,
        elapsedMs: performance.now() - started,
      });
      await client.query("SELECT set_config('statement_timeout',$1,true)", [
        `${remainingMs}ms`,
      ]);
      const rows = await client.query('FETCH FORWARD 100 FROM impact_rows');
      scannedRows += rows.rows.length;
      checkScanBudget({
        rows: scannedRows,
        elapsedMs: performance.now() - started,
      });
      for (const raw of rows.rows) {
        const row = rowSchema.parse(raw);
        if (row.source.kind === 'fixture' || row.state !== 'finished') continue;
        if (
          row.receipt &&
          (row.receipt.journeyId !== row.journey_id ||
            row.receipt.profileId !== row.profile_id ||
            row.receipt.assessmentIdentity.journeyId !== row.journey_id)
        )
          throw new Error('Stored impact receipt identity mismatch.');
        // Evidence can advance the journey before its next award settlement.
        // The read must exclude that old receipt without settling it itself.
        const contribution =
          row.receipt &&
          row.receipt.assessmentIdentity.version === row.assessment.version &&
          row.receipt.assessmentIdentity.revision === row.assessment.revision
            ? classifyReceipt(row.receipt, policy)
            : ({ kind: 'unavailable', reason: 'assessment_pending' } as const);
        community.include(contribution);
        if (row.profile_id === selected) personal.include(contribution);
        if (contribution.kind === 'eligible') {
          if (contribution.validation) validation.add(contribution.validation);
          for (const source of contribution.sources ?? [])
            sources.set(JSON.stringify(source), source);
          // Fail explicitly instead of dropping attribution from a lifetime total.
          if (sources.size > 100)
            throw new ApiError(
              503,
              'Impact sources exceed the supported response size.',
            );
        }
      }
      if (rows.rows.length < 100) break;
    }
    checkScanBudget({
      rows: scannedRows,
      elapsedMs: performance.now() - started,
    });
    return contributionsSchema.parse({
      period: 'lifetime',
      unit: 'kgCO2e',
      personal:
        profile.kind === 'demo'
          ? { kind: 'unavailable', reasons: ['demo_profile'] }
          : personal.total(),
      community: community.total(),
      sources: [...sources.values()],
      validation: [...validation].sort(),
    });
  }).catch(rethrowScanError);
}
