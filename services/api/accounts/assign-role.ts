import { createDatabase } from '../database/index.ts';
import { assignRole } from './store.ts';

const [principalId, role, reason, ...extra] = process.argv.slice(2);
if (
  !principalId ||
  !/^[0-9a-f-]{36}$/i.test(principalId) ||
  (role !== 'fan' && role !== 'admin') ||
  !reason ||
  extra.length
) {
  throw new Error(
    'Usage: node services/api/accounts/assign-role.ts <principal-uuid> <fan|admin> <reason>',
  );
}
const pool = createDatabase();
try {
  await assignRole(pool, principalId, role, reason);
  process.stdout.write('Role assignment recorded.\n');
} finally {
  await pool.end();
}
