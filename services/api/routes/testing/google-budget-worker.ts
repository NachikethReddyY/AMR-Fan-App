import { createDatabase } from '../../database/index.ts';
import { createGoogleRouteBudget } from '../google-budget.ts';

const pool = createDatabase();
const budget = createGoogleRouteBudget(pool);
const action = process.argv[2];
try {
  if (action === 'before') {
    process.send?.('before');
    await new Promise(() => {});
  } else if (action === 'after') {
    if (!(await budget.reserve(4))) throw new Error('Reservation denied.');
    process.send?.('after');
    await new Promise(() => {});
  } else {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => budget.reserve(4)),
    );
    process.send?.(results.filter(Boolean).length * 4);
  }
} finally {
  await pool.end();
  process.disconnect?.();
}
