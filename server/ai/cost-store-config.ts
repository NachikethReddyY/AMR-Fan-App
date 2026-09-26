import { databaseConfig } from '../database/config.ts';

/** Never fall back to an app/worktree database: every caller must use one store. */
export function aiCostDatabaseConfig(env: Record<string, string | undefined>) {
  if (!env.AI_COST_DATABASE_URL) return undefined;
  try {
    return databaseConfig({
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.AI_COST_DATABASE_URL,
    });
  } catch {
    throw new Error('Invalid shared AI cost database configuration.');
  }
}
