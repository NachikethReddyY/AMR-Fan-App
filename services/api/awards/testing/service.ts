import { executeSettlement, type SettlementArgs } from '../operation.ts';

// Test-only server entry; never imported by the HTTP adapter or API startup.
// executeSettlement requires NODE_ENV=test AND the locked fixture's provenance.
export function settleSyntheticJourneyAward(args: SettlementArgs) {
  return executeSettlement(args, 'synthetic_test');
}
