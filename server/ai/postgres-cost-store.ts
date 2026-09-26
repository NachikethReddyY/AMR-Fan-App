import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { transaction } from '../database/index.ts';
import {
  aiCostReservationSchema,
  type AiCostStore,
} from './cost-reservation.ts';

const scope = 'amr-tokenrouter-dev-and-demo';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const identitySchema = z.strictObject({
  scope: z.literal(scope),
  operationId: id,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  callId: id,
});
const money = z.int().min(0).max(10_000_000_000);
const accountingSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('reported'), chargedNanoUsd: money }),
  z.strictObject({
    kind: z.literal('held'),
    heldNanoUsd: money,
    reason: z.enum(['usage-unknown', 'bound-exceeded']),
  }),
]);
const callRow = z.object({
  state: z.enum([
    'reserved',
    'started',
    'held',
    'reported',
    'disputed',
    'cancelled',
  ]),
  reserved_nano_usd: z.coerce.bigint(),
  accounted_nano_usd: z.coerce.bigint(),
  bound_exceeded: z.boolean(),
});
type Identity = Parameters<AiCostStore['claimCall']>[0];

async function budget(client: PoolClient) {
  const result = await client.query(
    'SELECT committed_nano_usd, suspended FROM app.ai_cost_budget WHERE scope = $1 FOR UPDATE',
    [scope],
  );
  return z
    .object({ committed_nano_usd: z.coerce.bigint(), suspended: z.boolean() })
    .parse(result.rows[0]);
}
async function loadCall(client: PoolClient, identity: Identity) {
  const result = await client.query(
    `SELECT c.* FROM app.ai_cost_calls c
    JOIN app.ai_cost_operations o USING (operation_id)
    WHERE o.scope = $1 AND o.operation_id = $2 AND o.fingerprint = $3 AND c.call_id = $4`,
    [scope, identity.operationId, identity.fingerprint, identity.callId],
  );
  return result.rows.length ? callRow.parse(result.rows[0]) : undefined;
}
async function available(client: PoolClient, operationId: string) {
  // Evaluate wall time after waiting for the scope lock, never transaction start time.
  const result = await client.query(
    `SELECT rate_expires_at_ms > floor(extract(epoch FROM clock_timestamp()) * 1000) AS valid
    FROM app.ai_cost_operations WHERE operation_id = $1`,
    [operationId],
  );
  return z.object({ valid: z.boolean() }).parse(result.rows[0]).valid;
}
async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new Error('AI cost store unavailable or conflicting operation.');
  }
}

export function createPostgresAiCostStore(pool: Pool): AiCostStore & {
  cancelCall: (
    call: Parameters<AiCostStore['claimCall']>[0],
  ) => Promise<boolean>;
} {
  return {
    reserve(input) {
      return guarded(async () => {
        const reservation = aiCostReservationSchema.parse(input);
        return transaction(pool, async (client) => {
          const current = await budget(client);
          const existing = await client.query(
            'SELECT reservation FROM app.ai_cost_operations WHERE operation_id = $1',
            [reservation.operationId],
          );
          if (existing.rows.length) {
            const stored = aiCostReservationSchema.parse(
              existing.rows[0].reservation,
            );
            if (!isDeepStrictEqual(stored, reservation))
              throw new Error('Conflicting reservation');
            return 'duplicate';
          }
          if (
            current.suspended ||
            current.committed_nano_usd + BigInt(reservation.reservedNanoUsd) >
              10_000_000_000n
          )
            return 'exhausted';
          await client.query(
            `INSERT INTO app.ai_cost_operations(operation_id, scope, fingerprint, reservation, rate_expires_at_ms)
          VALUES ($1, $2, $3, $4, $5)`,
            [
              reservation.operationId,
              scope,
              reservation.fingerprint,
              reservation,
              reservation.rateExpiresAtMs,
            ],
          );
          if (!(await available(client, reservation.operationId)))
            throw new Error('Expired rates');
          for (const call of reservation.calls) {
            await client.query(
              `INSERT INTO app.ai_cost_calls(operation_id, call_id, reserved_nano_usd, accounted_nano_usd)
            VALUES ($1, $2, $3, $3)`,
              [reservation.operationId, call.id, call.reservedNanoUsd],
            );
          }
          await client.query(
            'UPDATE app.ai_cost_budget SET committed_nano_usd = committed_nano_usd + $1 WHERE scope = $2',
            [reservation.reservedNanoUsd, scope],
          );
          return 'reserved';
        });
      });
    },
    claimCall(input) {
      return guarded(async () => {
        const identity = identitySchema.parse(input);
        return transaction(pool, async (client) => {
          const current = await budget(client);
          const call = await loadCall(client, identity);
          if (
            current.suspended ||
            !call ||
            call.state !== 'reserved' ||
            !(await available(client, identity.operationId))
          )
            return false;
          await client.query(
            "UPDATE app.ai_cost_calls SET state = 'started' WHERE operation_id = $1 AND call_id = $2",
            [identity.operationId, identity.callId],
          );
          return true;
        });
      });
    },
    reconcile(input) {
      return guarded(async () => {
        const { accounting: raw, ...rawIdentity } = input;
        const identity = identitySchema.parse(rawIdentity);
        const accounting = accountingSchema.parse(raw);
        const conflict = await transaction(pool, async (client) => {
          await budget(client);
          const call = await loadCall(client, identity);
          if (!call || call.state === 'reserved' || call.state === 'cancelled')
            throw new Error('Call not started');
          const next = BigInt(
            accounting.kind === 'reported'
              ? accounting.chargedNanoUsd
              : accounting.heldNanoUsd,
          );
          if (
            next > call.reserved_nano_usd ||
            (accounting.kind === 'held' && next !== call.reserved_nano_usd)
          )
            throw new Error('Invalid accounting');
          if (call.state === 'disputed') return true;
          // Bound violations dominate earlier reports and permanently stop admission.
          const exceeded =
            accounting.kind === 'held' &&
            accounting.reason === 'bound-exceeded';
          if (exceeded) {
            await client.query(
              'UPDATE app.ai_cost_budget SET suspended = true WHERE scope = $1',
              [scope],
            );
          } else if (call.bound_exceeded) return;
          else if (call.state === 'reported') {
            if (
              accounting.kind === 'reported' &&
              next !== call.accounted_nano_usd
            ) {
              // Preserve the original receipt; the disputed state retains its
              // full reservation as exposure until a reviewed operator recovery.
              await client.query(
                'UPDATE app.ai_cost_budget SET committed_nano_usd = committed_nano_usd + $1, suspended = true WHERE scope = $2',
                [
                  (call.reserved_nano_usd - call.accounted_nano_usd).toString(),
                  scope,
                ],
              );
              await client.query(
                "UPDATE app.ai_cost_calls SET state = 'disputed' WHERE operation_id = $1 AND call_id = $2",
                [identity.operationId, identity.callId],
              );
              return true;
            }
            return;
          }
          // A late violation restores the full hold even above the admission cap.
          // The suspension persists; never understate uncertain exposure.
          await client.query(
            `UPDATE app.ai_cost_budget SET committed_nano_usd = committed_nano_usd + $1
          WHERE scope = $2`,
            [(next - call.accounted_nano_usd).toString(), scope],
          );
          await client.query(
            `UPDATE app.ai_cost_calls SET state = $1, accounted_nano_usd = $2, bound_exceeded = $3
          WHERE operation_id = $4 AND call_id = $5`,
            [
              accounting.kind,
              next.toString(),
              exceeded,
              identity.operationId,
              identity.callId,
            ],
          );
        });
        // Throw only after the conservative hold and suspension have committed.
        if (conflict) throw new Error('Conflicting receipt');
      });
    },
    cancelCall(input) {
      return guarded(async () => {
        const identity = identitySchema.parse(input);
        return transaction(pool, async (client) => {
          await budget(client);
          const call = await loadCall(client, identity);
          if (!call) return false;
          if (call.state === 'cancelled') return true;
          if (call.state !== 'reserved') return false;
          await client.query(
            'UPDATE app.ai_cost_budget SET committed_nano_usd = committed_nano_usd - $1 WHERE scope = $2',
            [call.accounted_nano_usd.toString(), scope],
          );
          await client.query(
            "UPDATE app.ai_cost_calls SET state = 'cancelled', accounted_nano_usd = 0 WHERE operation_id = $1 AND call_id = $2",
            [identity.operationId, identity.callId],
          );
          return true;
        });
      });
    },
  };
}
