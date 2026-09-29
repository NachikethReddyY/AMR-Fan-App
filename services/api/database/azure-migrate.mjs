const ownerUrl = process.env.AZURE_MIGRATION_DATABASE_URL;
const runtimePassword = process.env.AZURE_RUNTIME_DATABASE_PASSWORD;

if (!ownerUrl || !runtimePassword)
  throw new Error(
    'Migration credentials must be supplied through the process environment.',
  );
if (!/^[A-Za-z0-9_-]{48,128}$/.test(runtimePassword))
  throw new Error('Runtime password must be a random 48-128 character value.');
const parsed = new URL(ownerUrl);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
  throw new Error('Migration URL must be a PostgreSQL URL.');
if (parsed.username !== 'amr_migration_owner')
  throw new Error(
    'Migration URL must use amr_migration_owner; the runtime role is not accepted.',
  );
if (parsed.search || parsed.hash)
  throw new Error('Migration URL must not contain query or fragment parameters.');
if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
  throw new Error('Azure migration refuses a local database URL.');

// Fail closed until a reviewed table/column ACL plan covers every migration.
// This executable path intentionally cannot create a partially privileged role
// or apply schema changes under an unreviewed deployment identity.
throw new Error(
  'Azure migration is held: obtain the reviewed runtime ACL plan before running migrations.',
);
