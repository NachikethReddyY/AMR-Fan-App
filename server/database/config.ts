import type { PoolConfig } from 'pg';

export function databaseConfig(
  env: { NODE_ENV?: string; DATABASE_URL?: string } = process.env,
): PoolConfig {
  if (!env.DATABASE_URL)
    throw new Error('DATABASE_URL is required on the server.');
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  ) {
    throw new Error(
      'DATABASE_URL must identify a PostgreSQL host and database.',
    );
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  // URL SSL options can override pg's verified TLS object. Do not accept both.
  if (
    Array.from(url.searchParams.keys()).some((key) =>
      key.toLowerCase().startsWith('ssl'),
    )
  ) {
    throw new Error(
      'Configure verified TLS through the server, not URL SSL options.',
    );
  }
  if (env.NODE_ENV === 'production' && local) {
    throw new Error('Production cannot use the local development database.');
  }
  return {
    connectionString: env.DATABASE_URL,
    ssl: local ? undefined : { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: 'amr-server',
  };
}
