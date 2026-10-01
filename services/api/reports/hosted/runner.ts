import { spawn } from 'node:child_process';
import { ApiError } from '../../accounts/types.ts';
import { MAX_PARSER_OUTPUT, parsedReport } from '../hosted-protocol.ts';

/** No child diagnostics or PDF bytes enter logs. Reap the complete group before returning. */
export function runIsolated(
  mode: 'parse' | 'probe',
  bytes: Buffer,
  signal: AbortSignal,
) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn('/usr/local/bin/amr-pdf-sandbox', [mode], {
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        NODE_ENV: 'production',
        LANG: 'C.UTF-8',
      },
    });
    let failure: Error | undefined,
      size = 0;
    const output: Buffer[] = [];
    const kill = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if (!(
            error instanceof Error &&
            'code' in error &&
            error.code === 'ESRCH'
          ))
            failure = new Error('Parser cleanup failed.');
        }
      }
    };
    const abort = () => {
      failure = new ApiError(503, 'Parser deadline exceeded.');
      kill();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    child.on('error', () => {
      failure = new ApiError(503, 'Parser isolation unavailable.');
    });
    child.stdin.on('error', () => {});
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_PARSER_OUTPUT) {
          failure = new ApiError(422, 'Parser output limit exceeded.');
          kill();
        } else if (stream === child.stdout) output.push(chunk);
      });
    child.on('close', (code) => {
      signal.removeEventListener('abort', abort);
      kill();
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new ApiError(code === 78 ? 503 : 422, 'PDF could not be parsed.'),
        );
      else resolve(Buffer.concat(output));
    });
    child.stdin.end(bytes);
  });
}
export async function parseIsolated(bytes: Buffer, signal: AbortSignal) {
  return parsedReport(
    JSON.parse((await runIsolated('parse', bytes, signal)).toString()),
  );
}
