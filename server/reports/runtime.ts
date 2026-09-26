import type { Pool } from 'pg';
import { ApiError } from '../accounts/types.ts';
import { createAi } from '../ai/index.ts';
import { createReports } from './index.ts';
import { createParser } from './parser.ts';
import { createHostedParser } from './parser-hosted.ts';
import { createStorage } from './storage.ts';
import { createSupabaseStorage } from './storage-supabase.ts';
import { transaction } from '../database/index.ts';
import { sweepSources } from './retention.ts';

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
  let cleanup: (() => Promise<void>) | undefined;
  let cleaning: Promise<void> | undefined;
  const clean = async () => {
    if (!cleanup) return;
    cleaning ??= cleanup().finally(() => {
      cleaning = undefined;
    });
    await cleaning;
  };
  return async () => {
    const storageProvider = env.REPORT_STORAGE_PROVIDER ?? 'local';
    if (!['local', 'supabase'].includes(storageProvider))
      throw new ApiError(503, 'Private report storage is not configured.');
    if (storageProvider === 'local' && !env.REPORT_STORAGE_ROOT)
      throw new ApiError(503, 'Private report storage is not configured.');
    const ttl = Number(env.REPORT_FAILED_UPLOAD_TTL_SECONDS ?? '86400');
    if (
      ttl !== null &&
      (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > 31_536_000)
    )
      throw new ApiError(
        503,
        'Report upload expiry must be configured explicitly.',
      );
    if (!pending)
      pending = (async () => {
        const mode = env.REPORT_PARSER_MODE ?? 'native';
        if (!['native', 'docker', 'hosted'].includes(mode))
          throw new Error('Invalid report parser mode.');
        if (
          mode === 'docker' &&
          !/^sha256:[a-f0-9]{64}$/.test(env.REPORT_PARSER_IMAGE ?? '')
        )
          throw new Error('An immutable report parser image is required.');
        const storage =
          storageProvider === 'supabase'
            ? await createSupabaseStorage({
                credential: env.SUPABASE_STORAGE_KEY ?? '',
                exclusive: (operation) =>
                  transaction(pool, async (client) => {
                    await client.query("SET LOCAL lock_timeout='1s'");
                    await client.query(
                      'SELECT pg_advisory_xact_lock(48136294)',
                    );
                    return operation();
                  }),
              })
            : await createStorage({ root: env.REPORT_STORAGE_ROOT! });
        cleanup = async () => {
          await storage.cleanupIncomplete();
          await sweepSources({
            storage: {
              ...storage,
              async remove(id) {
                await transaction(pool, async (db) => {
                  const lock = await db.query<{ acquired: boolean }>(
                    'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired',
                    [`report-upload:${id}`],
                  );
                  if (lock.rows[0]?.acquired) await storage.remove(id);
                });
              },
            },
            expiresBefore:
              ttl === null ? null : new Date(Date.now() - ttl * 1000),
            saved: async (ids) =>
              (
                await pool.query<{ id: string }>(
                  "SELECT id FROM app.report_documents WHERE id=ANY($1::uuid[]) AND status='review' AND EXISTS (SELECT 1 FROM app.report_pages p WHERE p.document_id=report_documents.id)",
                  [ids],
                )
              ).rows.map((row) => row.id),
          });
        };
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
          parser:
            mode === 'hosted'
              ? {
                  async parse(bytes) {
                    try {
                      return await createHostedParser({
                        endpoint: env.REPORT_PARSER_URL ?? '',
                        signingKey: env.REPORT_PARSER_SIGNING_KEY ?? '',
                        verifiedImage: env.REPORT_PARSER_VERIFIED_IMAGE ?? '',
                      }).parse(bytes);
                    } catch (error) {
                      if (error instanceof ApiError) throw error;
                      throw new ApiError(
                        503,
                        'Hosted report processing is not ready.',
                      );
                    }
                  },
                }
              : createParser({
                  dockerImage: mode === 'docker' ? env.REPORT_PARSER_IMAGE : '',
                }),
          extractReport: ai.extractReport,
          allowPermittedSources: true,
        });
      })().catch(() => {
        pending = undefined;
        throw new ApiError(503, 'Report processing is not ready.');
      });
    const reports = await pending;
    // Every report operation retries cleanup. Hosted scheduling must invoke this while idle.
    await clean();
    return reports;
  };
}
