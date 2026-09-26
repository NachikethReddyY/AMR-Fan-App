import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
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
const execute = promisify(execFile);
const dockerEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  HOME: homedir(),
  NODE_ENV: 'production',
});
let active = false;

/** Native macOS sandbox or a pinned, disposable offline Linux child. No unsandboxed fallback. */
export function createParser({
  timeoutMs = 10000,
  dockerImage = '',
}: { timeoutMs?: number; dockerImage?: string } = {}) {
  integer(timeoutMs, 1, dockerImage ? 45000 : 60000);
  if (dockerImage && !/^sha256:[a-f0-9]{64}$/.test(dockerImage))
    throw new Error('Use an immutable parser image ID.');
  return {
    async parse(bytes: Buffer): Promise<ParsedReport> {
      if (bytes.length > MAX_FILE_BYTES)
        throw new ApiError(413, 'PDF exceeds 10 MiB.');
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString('ascii')))
        throw new ApiError(415, 'Use a valid text-layer PDF.');
      if (active) throw new ApiError(503, 'Another report is being parsed.');
      if (!dockerImage && process.platform !== 'darwin')
        throw new ApiError(
          503,
          'A network-disabled PDF parser runner must be configured for this host.',
        );
      active = true;
      const container = dockerImage ? `amr-report-${randomUUID()}` : '';
      let launched = false;
      try {
        if (dockerImage) {
          try {
            await execute(
              'docker',
              ['image', 'inspect', dockerImage, '--format', '{{.Id}}'],
              { env: dockerEnv(), timeout: 3000, maxBuffer: 4096 },
            );
            launched = true;
            await execute(
              'docker',
              [
                'create',
                '--pull=never',
                '--name',
                container,
                '--network=none',
                '--memory=256m',
                '--memory-swap=256m',
                '--cpus=1',
                '--pids-limit=64',
                '--read-only',
                '--cap-drop=ALL',
                '--security-opt=no-new-privileges:true',
                '--ulimit=core=0',
                '--shm-size=16m',
                '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m',
                '--log-driver=none',
                '--interactive',
                dockerImage,
              ],
              { env: dockerEnv(), timeout: 3000, maxBuffer: 4096 },
            );
          } catch {
            throw new ApiError(503, 'Offline report parser is not ready.');
          }
        }
        return await new Promise<ParsedReport>((resolve, reject) => {
          launched = true;
          const child = spawn(
            dockerImage ? 'docker' : '/usr/bin/sandbox-exec',
            dockerImage
              ? ['start', '--attach', '--interactive', container]
              : [
                  '-p',
                  '(version 1) (allow default) (deny network*) (deny file-write*)',
                  process.execPath,
                  '--max-old-space-size=384',
                  ...process.execArgv.filter((arg) => arg !== '--test'),
                  fileURLToPath(new URL('./parser-worker.ts', import.meta.url)),
                ],
            {
              stdio: ['pipe', 'pipe', 'pipe'],
              env: dockerImage
                ? dockerEnv()
                : {
                    PATH: '/usr/bin:/bin',
                    LANG: 'en_US.UTF-8',
                    NODE_ENV: 'production',
                  },
            },
          );
          let output = Buffer.alloc(0);
          let combined = 0;
          let failure: ApiError | null = null;
          let measurementFailure: ReturnType<typeof setTimeout> | undefined;
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
            // The offline child container has a kernel-enforced cap; CLI RSS is unrelated.
            if (dockerImage) return;
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
            ps.on('close', (code) => {
              // A departed parser needs no measurement. A live one must not lose its guard.
              if (child.exitCode !== null || child.signalCode !== null) return;
              if (code !== 0 || !/^\s*\d+\s*$/.test(rss) || Number(rss) <= 0) {
                // ps can observe exit before Node receives it. Allow one sample interval
                // for that notification, then fail closed if the parser is still live.
                measurementFailure ??= setTimeout(() => {
                  if (child.exitCode === null && child.signalCode === null)
                    fail(
                      new ApiError(
                        503,
                        'Parser memory measurement unavailable.',
                      ),
                    );
                }, 50);
                return;
              }
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
            clearTimeout(measurementFailure);
            clearInterval(memory);
            if (failure) {
              reject(failure);
              return;
            }
            try {
              if (dockerImage && code !== 0 && !output.length)
                throw new ApiError(
                  code === 125 ? 503 : 422,
                  code === 125
                    ? 'Offline report parser is not ready.'
                    : 'PDF parser process failed.',
                );
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
        let cleaned = !container || !launched;
        try {
          if (container && launched) {
            try {
              await execute('docker', ['rm', '--force', container], {
                env: dockerEnv(),
                timeout: 5000,
                maxBuffer: 4096,
              });
              cleaned = true;
            } catch {
              // Confirm absence if removal failed; never release a live job silently.
              try {
                const remaining = await execute(
                  'docker',
                  [
                    'ps',
                    '--all',
                    '--quiet',
                    '--filter',
                    `name=^/${container}$`,
                  ],
                  { env: dockerEnv(), timeout: 3000, maxBuffer: 4096 },
                );
                if (remaining.stdout.trim()) throw new Error('Parser remains');
                cleaned = true;
              } catch {
                throw new ApiError(
                  503,
                  'Offline parser cleanup could not be confirmed.',
                );
              }
            }
          }
        } finally {
          if (cleaned) active = false;
        }
      }
    },
  };
}
