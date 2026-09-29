import { createServer } from 'node:http';
import type { Pool } from 'pg';
import { ApiError } from '../../accounts/types.ts';
import { handleParticipationRequest } from '../participation-http.ts';
import { testDatabaseName } from '../../../../scripts/local-db.mjs';

export function requireOwnTestDatabase() {
  if (
    process.env.NODE_ENV !== 'test' ||
    new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
      `/${testDatabaseName()}`
  )
    throw new Error('Use only this canonical worktree test database.');
}

// Test-only transport for the owned adapter. It is not the registered application API.
export function participationTestServer(pool: Pool) {
  requireOwnTestDatabase();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://test.invalid');
      const result = await handleParticipationRequest({
        pool,
        token: req.headers.authorization?.replace(/^Bearer /, '') ?? '',
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: async () => {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4096) throw new ApiError(413, 'Too large');
            chunks.push(Buffer.from(chunk));
          }
          try {
            return JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            throw new ApiError(400, 'Invalid JSON');
          }
        },
      });
      res.writeHead(result?.status ?? 404, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(result?.value ?? { error: 'Not found' }));
    } catch (error) {
      res.writeHead(error instanceof ApiError ? error.status : 500, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: error instanceof ApiError ? error.message : 'Request failed',
        }),
      );
    }
  });
}
