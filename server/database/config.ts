import type { PoolConfig } from 'pg';
import { isIP } from 'node:net';

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
  // pg merges every URL query entry over its configuration, including host,
  // credentials and TLS. Keep one authority instead of an evolving denylist.
  if (url.searchParams.size > 0) {
    throw new Error(
      'DATABASE_URL query parameters are not supported. Configure the server explicitly.',
    );
  }
  // Network URL parsing normalizes case/encoded host and alternative IPv4 forms.
  // Reject Unix-socket authorities before pg can decode them as a different target.
  try {
    url.hostname = new URL(`http://${url.hostname}`).hostname;
  } catch {
    throw new Error('DATABASE_URL must use a network PostgreSQL host.');
  }
  const host = url.hostname.toLowerCase();
  const local =
    host === 'localhost' ||
    host === 'localhost.' ||
    (isIP(host) === 4 && host.startsWith('127.')) ||
    host === '[::1]' ||
    host.startsWith('[::ffff:7f');
  if (env.NODE_ENV === 'production' && local) {
    throw new Error('Production cannot use the local development database.');
  }
  return {
    connectionString: url.href,
    ssl: local ? false : { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: 'amr-server',
  };
}
