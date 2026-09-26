import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { createAi } from '../ai/index.ts';
import { createReports } from './index.ts';
import { createParser } from './parser.ts';
import { createStorage } from './storage.ts';

export function isReportPath(path: string) {
  return (
    path === '/v1/impact/official' ||
    /^\/v1\/admin\/(reports(?:\/|$)|report-candidates\/)/.test(path)
  );
}

/** Lazy initialization keeps an unconfigured report feature from breaking other API routes. */
export function reportRuntime(
  pool: Pool,
  env: Record<string, string | undefined>,
) {
  let pending: Promise<ReturnType<typeof createReports>> | undefined;
  return async () => {
    if (!env.REPORT_STORAGE_ROOT)
      throw new ApiError(503, 'Private report storage is not configured.');
    if (!pending)
      pending = (async () => {
        const mode = env.REPORT_PARSER_MODE ?? 'native';
        if (!['native', 'docker'].includes(mode))
          throw new Error('Invalid report parser mode.');
        if (
          mode === 'docker' &&
          !/^sha256:[a-f0-9]{64}$/.test(env.REPORT_PARSER_IMAGE ?? '')
        )
          throw new Error('An immutable report parser image is required.');
        const storage = await createStorage({ root: env.REPORT_STORAGE_ROOT! });
        await storage.cleanupIncomplete();
        const ai = createAi(
          Object.fromEntries(
            [
              'LUNA_BASE_URL',
              'LUNA_API_KEY',
              'LUNA_REPORT_EXTRACTION_ENABLED',
              'LAYA_BASE_URL',
              'LAYA_ADVISORY_ENABLED',
            ]
              .filter((key) => env[key])
              .map((key) => [key, env[key]]),
          ),
        );
        return createReports({
          pool,
          storage,
          parser: createParser({
            dockerImage: mode === 'docker' ? env.REPORT_PARSER_IMAGE : '',
          }),
          extractReport: ai.extractReport,
          allowPermittedSources: true,
        });
      })().catch(() => {
        pending = undefined;
        throw new ApiError(503, 'Report processing is not ready.');
      });
    return pending;
  };
}
