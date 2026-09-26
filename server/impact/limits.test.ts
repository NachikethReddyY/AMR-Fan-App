import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkScanBudget, maxScanRows, rethrowScanError } from './limits.ts';
test('whole lifetime read fails closed when its work or time budget expires', () => {
  checkScanBudget({ rows: 100, elapsedMs: 100 });
  assert.throws(
    () => checkScanBudget({ rows: maxScanRows + 1, elapsedMs: 100 }),
    { status: 503 },
  );
  assert.throws(() => checkScanBudget({ rows: 0, elapsedMs: 5001 }), {
    status: 503,
  });
});

test('database scan timeouts become the same recoverable unavailable response', () => {
  assert.throws(() => rethrowScanError({ code: '57014' }), { status: 503 });
  const other = new Error('storage failure');
  assert.throws(
    () => rethrowScanError(other),
    (error) => error === other,
  );
});
