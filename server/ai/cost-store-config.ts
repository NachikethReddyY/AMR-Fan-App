import { databaseConfig } from '../database/config.ts';
import { aiCostScope } from './cost-reservation.ts';

/** Never fall back to an app/worktree database: every caller must use one store. */
export function aiCostDatabaseConfig(env: Record<string, string | undefined>) {
  // Optional assertion only, never a selector for another allowance.
  if (env.AI_COST_SCOPE !== undefined && env.AI_COST_SCOPE !== aiCostScope)
    throw new Error('Invalid shared AI cost scope configuration.');
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
