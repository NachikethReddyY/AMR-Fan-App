import { createDatabase } from '../../database/index.ts';
import { createPostgresAiCostStore } from '../postgres-cost-store.ts';
import { aiCostReservationSchema } from '../cost-reservation.ts';

// Synthetic child-process fixture, never a provider dispatcher.
if (process.env.AMR_AI_COST_ISOLATED !== 'true')
  throw new Error('Isolated test only');
const pool = createDatabase();
try {
  const reservation = aiCostReservationSchema.parse(
    JSON.parse(process.argv[3]),
  );
  const store = createPostgresAiCostStore(pool);
  const result =
    process.argv[2] === 'claim'
      ? await store.claimCall({
          scope: reservation.scope,
          operationId: reservation.operationId,
          fingerprint: reservation.fingerprint,
          callId: reservation.calls[0].id,
        })
      : await store.reserve(reservation);
  process.stdout.write(JSON.stringify(result));
} finally {
  await pool.end();
}
