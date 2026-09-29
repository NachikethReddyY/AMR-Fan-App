import { z } from 'zod';
import type { Failure } from './contracts.ts';

const loopback = (suffix: string) =>
  z
    .string()
    .url()
    .refine((s) => {
      const u = new URL(s);
      return (
        u.protocol === 'http:' &&
        u.hostname === '127.0.0.1' &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        u.pathname.replace(/\/$/, '') === suffix
      );
    }, 'Expected loopback endpoint');
const enabled = z
  .union([
    z.boolean(),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
  ])
  .default(false);
export const configSchema = z.strictObject({
  LUNA_BASE_URL: loopback('/v1').default('http://127.0.0.1:8317/v1'),
  LUNA_API_KEY: z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[\x21-\x7e]+$/)
    .optional(),
  LUNA_REPORT_EXTRACTION_ENABLED: enabled,
  LAYA_BASE_URL: loopback('').default('http://127.0.0.1:55434'),
  LAYA_ADVISORY_ENABLED: enabled,
  lunaTimeoutMs: z.int().min(10).max(20000).default(15000),
  layaTimeoutMs: z.int().min(10).max(5000).default(3000),
});
export type Config = z.infer<typeof configSchema>;
export type WireResult =
  | { ok: true; value: unknown; bytes: number; elapsedMs: number }
  | { ok: false; reason: Failure };

// One instance belongs to one server process. No queue and no automatic retries.
export function boundedTransport(url: string, timeoutMs: number, key?: string) {
  let active = false;
  return async (body: unknown): Promise<WireResult> => {
    if (active) return { ok: false, reason: 'busy' };
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 60000)
      return { ok: false, reason: 'invalid-input' };
    active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: encoded,
      });
      if (!response.ok) {
        await response.body?.cancel();
        return { ok: false, reason: 'provider' };
      }
      if (
        !response.headers.get('content-type')?.includes('application/json') ||
        Number(response.headers.get('content-length')) > 65536
      ) {
        await response.body?.cancel();
        return { ok: false, reason: 'invalid-output' };
      }
      const reader = response.body?.getReader();
      if (!reader) return { ok: false, reason: 'invalid-output' };
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 65536) {
          await reader.cancel();
          return { ok: false, reason: 'invalid-output' };
        }
        chunks.push(part.value);
      }
      try {
        return {
          ok: true,
          value: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          bytes,
          elapsedMs: performance.now() - start,
        };
      } catch {
        return { ok: false, reason: 'invalid-output' };
      }
    } catch {
      return {
        ok: false,
        reason: abort.signal.aborted ? 'timeout' : 'provider',
      };
    } finally {
      clearTimeout(timer);
      active = false;
    }
  };
}
