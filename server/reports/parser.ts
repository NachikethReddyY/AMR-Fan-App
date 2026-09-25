import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../accounts/types.ts';
import {
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_TEXT_CHARACTERS,
  PARSER_VERSION,
  integer,
  object,
  onlyKeys,
  type Page,
} from './contracts.ts';

export type ParsedReport = { pages: Page[]; parserVersion: string };
const MAX_OUTPUT = 8 * 1024 * 1024;
let active = false;

/** Local macOS parser. No unsandboxed fallback; cloud needs a network-disabled runner. */
export function createParser({
  timeoutMs = 10000,
}: { timeoutMs?: number } = {}) {
  integer(timeoutMs, 1, 60000);
  return {
    async parse(bytes: Buffer): Promise<ParsedReport> {
      if (bytes.length > MAX_FILE_BYTES)
        throw new ApiError(413, 'PDF exceeds 10 MiB.');
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString('ascii')))
        throw new ApiError(415, 'Use a valid text-layer PDF.');
      if (active) throw new ApiError(503, 'Another report is being parsed.');
      if (process.platform !== 'darwin')
        throw new ApiError(
          503,
          'A network-disabled PDF parser runner must be configured for this host.',
        );
      active = true;
      try {
        return await new Promise<ParsedReport>((resolve, reject) => {
          const child = spawn(
            '/usr/bin/sandbox-exec',
            [
              '-p',
              '(version 1) (allow default) (deny network*) (deny file-write*)',
              process.execPath,
              '--max-old-space-size=384',
              ...process.execArgv.filter((arg) => arg !== '--test'),
              fileURLToPath(new URL('./parser-worker.ts', import.meta.url)),
            ],
            {
              stdio: ['pipe', 'pipe', 'pipe'],
              env: { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' },
            },
          );
          let output = Buffer.alloc(0);
          let combined = 0;
          let failure: ApiError | null = null;
          const fail = (error: ApiError) => {
            failure ??= error;
            child.kill('SIGKILL');
          };
          const timer = setTimeout(
            () => fail(new ApiError(422, 'PDF parsing timed out.')),
            timeoutMs,
          );
          // RSS is checked from the parent so blocked parser JavaScript cannot disable the bound.
          const memory = setInterval(() => {
            if (!child.pid) return;
            const ps = spawn(
              '/bin/ps',
              ['-o', 'rss=', '-p', String(child.pid)],
              { stdio: ['ignore', 'pipe', 'ignore'] },
            );
            let rss = '';
            ps.stdout.on('data', (value) => {
              rss += String(value);
            });
            ps.on('error', () =>
              fail(new ApiError(503, 'Parser memory measurement unavailable.')),
            );
            ps.on('close', () => {
              if (Number(rss.trim()) > 768 * 1024)
                fail(new ApiError(422, 'PDF parsing memory limit exceeded.'));
            });
          }, 50);
          const collect = (chunk: Buffer, stdout: boolean) => {
            combined += chunk.length;
            if (combined > MAX_OUTPUT)
              fail(new ApiError(422, 'PDF parser output limit exceeded.'));
            else if (stdout) output = Buffer.concat([output, chunk]);
          };
          child.stdout.on('data', (chunk) => collect(chunk, true));
          child.stderr.on('data', (chunk) => collect(chunk, false));
          child.stdin.on('error', () => {});
          child.on('error', () => {
            failure = new ApiError(503, 'PDF parser could not start.');
          });
          child.on('close', (code) => {
            clearTimeout(timer);
            clearInterval(memory);
            if (failure) {
              reject(failure);
              return;
            }
            try {
              const value = object(JSON.parse(output.toString('utf8')));
              if (code !== 0)
                throw new ApiError(
                  422,
                  typeof value.error === 'string'
                    ? `PDF could not be parsed (${value.error}).`
                    : 'PDF could not be parsed.',
                );
              onlyKeys(value, ['pages', 'parserVersion']);
              if (
                value.parserVersion !== PARSER_VERSION ||
                !Array.isArray(value.pages) ||
                !value.pages.length ||
                value.pages.length > MAX_PAGES
              )
                throw new Error();
              const pages = value.pages.map((p: unknown, i: number) => {
                const row = object(p);
                onlyKeys(row, ['page', 'text']);
                if (row.page !== i + 1 || typeof row.text !== 'string')
                  throw new Error();
                return { page: i + 1, text: row.text };
              });
              if (
                pages.reduce((n, p) => n + p.text.length, 0) >
                MAX_TEXT_CHARACTERS
              )
                throw new Error();
              resolve({ pages, parserVersion: PARSER_VERSION });
            } catch (error) {
              reject(
                error instanceof ApiError
                  ? error
                  : new ApiError(422, 'PDF parser returned invalid data.'),
              );
            }
          });
          child.stdin.end(bytes);
        });
      } finally {
        active = false;
      }
    },
  };
}
